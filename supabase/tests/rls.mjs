import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import assert from "node:assert/strict";
let failed = 0;
const FAIL = (...a) => { failed++; console.log("FAIL", ...a); };
const check = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(ok ? "ok  " : "FAIL", label, ok ? "" : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const db = new PGlite();
await db.exec(`
 create schema auth; create table auth.users(id uuid primary key default gen_random_uuid());
 create role authenticated; create role anon;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
 grant usage on schema auth to authenticated;
`);
await db.exec(fs.readFileSync(new URL("../migrations/0001_core_schema.sql", import.meta.url),"utf8"));
await db.exec(`grant usage on schema public, private to authenticated; grant all on all tables in schema public to authenticated; grant execute on all functions in schema private to authenticated;`);
console.log("migration applied");

const U = async () => (await db.query("insert into auth.users default values returning id")).rows[0].id;
const [a1, b1, agent, portal] = [await U(), await U(), await U(), await U()];
const as = async (uid, sql, params) => { await db.exec(`set role authenticated; select set_config('request.jwt.sub','${uid}',false)`); try { return await db.query(sql, params); } finally { await db.exec("reset role"); } };

const orgA = (await as(a1, "select public.create_organization('Org A')")).rows[0].create_organization;
const orgB = (await as(b1, "select public.create_organization('Org B')")).rows[0].create_organization;
const vA = (await as(a1, "insert into business_verticals(organization_id,name) values ($1,'V') returning id", [orgA])).rows[0].id;
const cl = (await as(a1, "insert into clients(organization_id,name) values ($1,'Client') returning id", [orgA])).rows[0].id;
const campA = (await as(a1, "insert into campaigns(organization_id,vertical_id,name,status) values ($1,$2,'Camp A','active') returning id", [orgA, vA])).rows[0].id;
const campC = (await as(a1, "insert into campaigns(organization_id,client_id,name) values ($1,$2,'Client camp') returning id", [orgA, cl])).rows[0].id;

// owner constraint
for (const [name, sql, p] of [["both owners", "insert into campaigns(organization_id,vertical_id,client_id,name) values ($1,$2,$3,'x')", [orgA, vA, cl]], ["no owner", "insert into campaigns(organization_id,name) values ($1,'x')", [orgA]]]) {
  try { await as(a1, sql, p); FAIL("", name); } catch { console.log("ok  rejected:", name); }
}
// cross-tenant FK: org B admin cannot create a campaign under org A's vertical
try { await as(b1, "insert into campaigns(organization_id,vertical_id,name) values ($1,$2,'x')", [orgB, vA]); FAIL("cross-tenant fk"); } catch { console.log("ok  rejected: cross-tenant vertical reference"); }

// org isolation on reads
check("org B sees none of org A campaigns", (await as(b1, "select count(*)::int n from campaigns where organization_id=$1", [orgA])).rows[0].n, 0);
check("org A admin sees both campaigns", (await as(a1, "select count(*)::int n from campaigns")).rows[0].n, 2);

// add agent + portal members (service-level insert), agent on campA only
await db.query("insert into organization_members(organization_id,user_id,role) values ($1,$2,'sales_agent')", [orgA, agent]);
await db.query("insert into organization_members(organization_id,user_id,role,client_id) values ($1,$2,'client_portal',$3)", [orgA, portal, cl]);
await db.query("insert into campaign_members(campaign_id,organization_id,user_id) values ($1,$2,$3)", [campA, orgA, agent]);
check("agent sees only assigned campaign", (await as(agent, "select name from campaigns")).rows.map(r=>r.name), ["Camp A"]);
check("portal user sees only own client campaign", (await as(portal, "select name from campaigns")).rows.map(r=>r.name), ["Client camp"]);
try { await as(agent, "insert into clients(organization_id,name) values ($1,'Evil')", [orgA]); FAIL("agent created client"); } catch { console.log("ok  agent cannot create client"); }
check("agent cannot read verticals", (await as(agent, "select count(*)::int n from business_verticals")).rows[0].n, 0);
check("portal user cannot read leads", (await as(portal, "select count(*)::int n from leads")).rows[0].n, 0);

// leads + dedupe + agent lead visibility + call_sessions write blocked
const ct = (await as(a1, "insert into contacts(organization_id,name,email,consent_calls) values ($1,'Zed','z@x.co',true) returning id", [orgA])).rows[0].id;
try { await as(a1, "insert into contacts(organization_id,name,email) values ($1,'Zed2','Z@x.co')", [orgA]); FAIL("dup contact"); } catch { console.log("ok  duplicate contact email rejected"); }
await as(a1, "insert into leads(organization_id,campaign_id,contact_id,assignee_id) values ($1,$2,$3,$4)", [orgA, campA, ct, agent]);
check("agent sees own assigned lead", (await as(agent, "select count(*)::int n from leads")).rows[0].n, 1);
try { await as(agent, "insert into call_sessions(organization_id,campaign_id,lead_id,agent_id,provider) select organization_id,campaign_id,id,$1,'x' from leads", [agent]); FAIL("agent wrote call_sessions"); } catch { console.log("ok  clients cannot write call_sessions directly"); }
check("webhook_events invisible to users", (await as(agent, "select count(*)::int n from webhook_events")).rows[0].n, 0);
if (failed) { console.error(failed + " RLS check(s) failed"); process.exit(1); }
await db.close();
