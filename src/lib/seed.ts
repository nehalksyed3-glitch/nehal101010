import { INTEGRATION_CATALOG } from "./integrations";
import type { Base, CallSession, Campaign, Contact, DB, Disposition, Lead, LeadStatus, Member, Role } from "./types";
import { LEAD_STATUSES } from "./types";
import { emptyDB } from "./store";
import { daysAgo } from "./util";

/** Clearly-labelled demo workspace: all records are fictional and flagged by db.demo. */
export function buildDemo(): { db: DB; adminId: string; agentId: string } {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  let n = 0;
  const org = "org-assorted";
  const base = (prefix: string, at = daysAgo(30)): Base => ({ id: `${prefix}-${++n}`, organizationId: org, createdAt: at, updatedAt: at });
  const db = emptyDB();
  db.demo = true;
  db.org = { id: org, name: "Assorted Group", timezone: "UTC", createdAt: daysAgo(60) };

  const mk = (name: string, role: Role, extra: Partial<Member> = {}): Member => ({ ...base("m"), name, email: `${name.split(" ")[0].toLowerCase()}@assortedgroup.demo`, role, verticalIds: [], status: "active", ...extra });
  const admin = mk("Amira Rahman", "super_admin");
  const exec = mk("Daniel Okafor", "executive");
  const vm = mk("Priya Nair", "vertical_manager");
  const cm = mk("Marcus Lee", "client_manager");
  const cam = mk("Sofia Alvarez", "campaign_manager");
  const sup = mk("Tariq Hassan", "supervisor");
  const a1 = mk("Chloe Bennett", "sales_agent"), a2 = mk("Omar Farouk", "sales_agent"), a3 = mk("Hannah Cole", "sales_agent");
  const mkt = mk("Lena Fischer", "marketing_manager");
  const ana = mk("Ravi Menon", "reporting_analyst");

  db.verticals = [
    { ...base("v"), name: "Assorted Realty", description: "Residential and commercial property lead generation.", color: "blue", managerId: vm.id },
    { ...base("v"), name: "Assorted Talent", description: "Staffing and recruitment outsourcing.", color: "green" },
    { ...base("v"), name: "Assorted Digital", description: "Marketing services and SaaS onboarding.", color: "orange" },
  ];
  vm.verticalIds = [db.verticals[0].id, db.verticals[2].id];
  db.clients = [
    { ...base("c"), name: "Northwind Solar", industry: "Renewable energy", website: "https://northwind-solar.example.com", contactName: "Jane Holt", contactEmail: "jane@northwind-solar.example.com", managerId: cm.id, status: "active" },
    { ...base("c"), name: "BrightPath Education", industry: "Education", website: "https://brightpath.example.com", contactName: "Sam Ortiz", contactEmail: "sam@brightpath.example.com", managerId: cm.id, status: "active" },
    { ...base("c"), name: "Helix Health Clinics", industry: "Healthcare", website: "https://helixhealth.example.com", contactName: "Dr. Mei Tan", contactEmail: "mei@helixhealth.example.com", status: "prospect" },
  ];
  const clientPortal = mk("Jane Holt", "client_portal", { clientId: db.clients[0].id, email: "jane@northwind-solar.example.com" });
  db.members = [admin, exec, vm, cm, cam, sup, a1, a2, a3, mkt, ana, clientPortal];

  const team = [cam.id, sup.id, a1.id, a2.id, a3.id, vm.id];
  const camp = (name: string, objective: string, status: Campaign["status"], owner: { verticalId?: string; clientId?: string }, tl: number, ts: number, src: string, members = team): Campaign => ({
    ...base("k"), name, objective, status, ownerType: owner.verticalId ? "vertical" : "client", ...owner, startDate: daysAgo(40).slice(0, 10), targetLeads: tl, targetSales: ts, leadSource: src,
    callingProvider: "Twilio Voice (not configured)", callWindowStart: "00:00", callWindowEnd: "23:59", script: "Introduce yourself, confirm consent, qualify need, propose next step, log disposition.", memberIds: members, bulkCallingEnabled: false,
  });
  db.campaigns = [
    camp("Q4 Premium Listings", "Book valuations for premium property owners.", "active", { verticalId: db.verticals[0].id }, 120, 14, "Website form"),
    camp("Tech Recruiter Outreach", "Place mid-level engineers with SME clients.", "active", { verticalId: db.verticals[1].id }, 90, 10, "LinkedIn"),
    camp("SaaS Onboarding Push", "Convert trial users to paid plans.", "active", { verticalId: db.verticals[2].id }, 150, 20, "Product trials"),
    camp("Northwind Rooftop Solar", "Qualify homeowners for rooftop solar surveys.", "active", { clientId: db.clients[0].id }, 200, 25, "Meta lead ads", [...team, cm.id]),
    camp("BrightPath Enrolment", "Fill the January cohort.", "paused", { clientId: db.clients[1].id }, 100, 12, "Landing page", [...team, cm.id]),
  ];

  const first = ["Aiden","Bella","Carlos","Dina","Ethan","Fatima","Gavin","Hana","Ivan","Julia","Kofi","Layla","Mateo","Nora","Oscar","Pia","Quinn","Rosa","Sven","Tina"];
  const last = ["Adams","Brooks","Chen","Diaz","Evans","Foster","Gupta","Hughes","Ito","Jones","Khan","Lopez","Morgan","Nash","Owens","Patel"];
  const sources = ["Website form", "Meta lead ads", "LinkedIn", "Referral", "Landing page"];
  const leads: Lead[] = []; const contacts: Contact[] = [];
  const weights: LeadStatus[] = ["New","New","Assigned","Attempting Contact","Attempting Contact","Contacted","Qualified","Callback Required","Converted","Disqualified"];
  db.campaigns.forEach((c) => {
    for (let i = 0; i < 16; i++) {
      const name = `${pick(first)} ${pick(last)}`;
      const contact: Contact = { ...base("p", daysAgo(20)), name, email: `${name.toLowerCase().replace(/\W+/g, ".")}.${n}@mail.example.com`, phone: `+1555${String(1000000 + Math.floor(rnd() * 8999999))}`, company: pick(["Acme","Globex","Initech","Umbrella","Hooli","Stark Ltd","Wayne Co"]), segment: pick(["SMB","Mid-market","Residential","Enterprise"]), tags: [], consentCalls: rnd() > 0.08 };
      contacts.push(contact);
      const status = pick(weights);
      leads.push({ ...base("l", daysAgo(Math.floor(rnd() * 20))), campaignId: c.id, contactId: contact.id, status: contact.consentCalls ? status : "Do Not Contact", assigneeId: status === "New" ? undefined : pick([a1.id, a2.id, a3.id]), source: pick(sources), value: pick([450, 900, 1200, 2400, 3600, 5200]) });
    }
  });
  db.contacts = contacts; db.leads = leads;

  const calls: CallSession[] = [];
  const disp: Disposition[] = ["No Answer","No Answer","Voicemail","Not Interested","Interested","Callback","Sale","Wrong Number"];
  for (let d = 13; d >= 0; d--) {
    const perDay = 8 + Math.floor(rnd() * 8);
    for (let i = 0; i < perDay; i++) {
      const lead = pick(leads.filter((l) => l.status !== "Do Not Contact"));
      const disposition = pick(disp);
      const connected = !["No Answer", "Voicemail", "Wrong Number"].includes(disposition);
      const t = daysAgo(d, 9 + Math.floor(rnd() * 8));
      calls.push({ ...base("call", t), leadId: lead.id, campaignId: lead.campaignId, agentId: pick([a1.id, a2.id, a3.id]), status: connected ? "completed" : "no_answer", startedAt: t, durationSec: connected ? 60 + Math.floor(rnd() * 420) : 8 + Math.floor(rnd() * 20), connected, disposition, provider: "simulated", providerEventId: `demo-${calls.length}`, simulated: true, revenue: disposition === "Sale" ? lead.value : 0 });
    }
  }
  db.calls = calls.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const notes = ["Concerned about price, wants a quote.", "Already working with a competitor, revisit next quarter.", "Timing is bad, busy until January.", "Interested; needs budget approval.", "Asked about the contract length."];
  db.notes = calls.filter((c) => c.connected).slice(0, 18).map((c) => ({ ...base("n", c.startedAt), leadId: c.leadId, campaignId: c.campaignId, body: pick(notes), authorId: c.agentId }));
  db.tasks = leads.filter((l) => l.status === "Callback Required").slice(0, 6).map((l, i) => ({ ...base("t"), leadId: l.id, campaignId: l.campaignId, assigneeId: l.assigneeId, title: "Callback requested", dueAt: daysAgo(i % 2 === 0 ? 1 : -1), done: false }));
  db.assets = [
    { ...base("a"), url: "https://northwind-solar.example.com/rooftop", label: "Rooftop landing page", description: "Primary lead capture page", category: "landing_page", campaignId: db.campaigns[3].id, clientId: db.clients[0].id, intendedUse: "Lead capture", connection: "registered" },
    { ...base("a"), url: "https://www.linkedin.com/company/assorted-group", label: "Company LinkedIn", description: "", category: "social", intendedUse: "Brand presence", connection: "registered" },
  ];
  db.integrations = INTEGRATION_CATALOG.map((c) => ({ ...base("i"), provider: c.provider, category: c.category, status: "not_connected" as const, errors: [] }));
  db.docs = [{ ...base("d"), title: "Solar qualification script", kind: "script", storage: "local", reference: "Local registry entry", campaignId: db.campaigns[3].id, clientId: db.clients[0].id }];
  db.messages = leads.slice(0, 6).map((l, i) => ({ ...base("msg"), leadId: l.id, campaignId: l.campaignId, channel: pick(["whatsapp", "email"] as const), direction: i % 2 ? "out" as const : "in" as const, body: i % 2 ? "Thanks for your interest, can we schedule a quick call?" : "Hi, please call me after 3pm.", at: daysAgo(i % 4) }));
  db.notifications = [{ ...base("nt"), level: "warn", title: "Telephony provider not configured. Calling runs in simulated demo mode.", read: false }];
  void LEAD_STATUSES;
  return { db, adminId: admin.id, agentId: a1.id };
}
