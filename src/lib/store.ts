import { useSyncExternalStore } from "react";
import { can, type Cap } from "./rbac";
import { uid, now } from "./util";
import { validateUrl } from "./url";
import {
  type Asset, type Campaign, type CallSession, type Client, type DB, type Disposition, type Doc, type Integration,
  type Lead, type LeadStatus, type Member, type Message, type Role, type Vertical, type ReportRun, type ScheduledReport,
} from "./types";
import { INTEGRATION_CATALOG } from "./integrations";

const KEY = "assorted-group.db.v1";
const SESSION = "assorted-group.session.v1";

export const emptyDB = (): DB => ({
  org: null, demo: false, members: [], verticals: [], clients: [], campaigns: [], contacts: [], leads: [], tasks: [], notes: [],
  interactions: [], calls: [], assets: [], integrations: [], messages: [], docs: [], notifications: [], audit: [], reports: [], schedules: [],
});

function load(): DB {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...emptyDB(), ...JSON.parse(raw) }; } catch { /* storage unavailable */ }
  return emptyDB();
}
function loadSession(): string | null { try { return localStorage.getItem(SESSION); } catch { return null; } }

let state: DB = load();
let userId: string | null = loadSession();
let snapshot = { db: state, userId };
const listeners = new Set<() => void>();

function commit(next: DB) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota or private mode */ }
  snapshot = { db: state, userId };
  listeners.forEach((l) => l());
}
function setUser(id: string | null) {
  userId = id;
  try { id ? localStorage.setItem(SESSION, id) : localStorage.removeItem(SESSION); } catch { /* ignore */ }
  snapshot = { db: state, userId };
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function useStore() {
  const snap = useSyncExternalStore(subscribe, () => snapshot);
  const me = snap.db.members.find((m) => m.id === snap.userId);
  return { db: snap.db, me };
}
export const getDB = () => state;
export const getMe = () => state.members.find((m) => m.id === userId);

export class Denied extends Error {}
function actor(cap?: Cap): Member {
  const me = getMe();
  if (!me) throw new Denied("Sign in required.");
  if (cap && !can(me, cap)) throw new Denied(`Your role (${me.role.replace("_", " ")}) is not permitted to do this.`);
  return me;
}
function base(org: string, by?: string) { const t = now(); return { id: uid(), organizationId: org, createdAt: t, updatedAt: t, createdBy: by }; }
function orgId() { return state.org!.id; }
function log(db: DB, by: Member, action: string, target: string): DB {
  return { ...db, audit: [{ ...base(orgId(), by.id), actorId: by.id, action, target }, ...db.audit].slice(0, 500) };
}
function notify(db: DB, level: "info" | "warn" | "error" | "success", title: string, userIdTo?: string): DB {
  return { ...db, notifications: [{ ...base(orgId()), userId: userIdTo, level, title, read: false }, ...db.notifications].slice(0, 100) };
}

/* ---------- session / org ---------- */
export const session = {
  /** Creates a brand-new, empty workspace with its first Super Administrator. */
  createWorkspace(orgName: string, adminName: string, adminEmail: string) {
    if (!orgName.trim() || !adminName.trim() || !/^\S+@\S+\.\S+$/.test(adminEmail)) throw new Error("Organization, name and a valid email are required.");
    const db = emptyDB();
    const org = { id: uid(), name: orgName.trim(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, createdAt: now() };
    db.org = org;
    const admin: Member = { ...base(org.id), name: adminName.trim(), email: adminEmail.trim().toLowerCase(), role: "super_admin", verticalIds: [], status: "active" };
    db.members = [admin];
    db.integrations = INTEGRATION_CATALOG.map((c) => ({ ...base(org.id), provider: c.provider, category: c.category, status: "not_connected" as const, errors: [] }));
    state = db; userId = admin.id;
    commit(log(db, admin, "organization.created", org.name));
    setUser(admin.id);
  },
  loadDemo(seed: DB, asUserId: string) { commit(seed); setUser(asUserId); },
  signInAs(id: string) { if (state.members.some((m) => m.id === id && m.status === "active")) setUser(id); },
  signOut() { setUser(null); },
  reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(SESSION); } catch { /* ignore */ } state = emptyDB(); userId = null; commit(state); setUser(null); },
};

/* ---------- members ---------- */
export const actions = {
  invite(name: string, email: string, role: Role, extra: { clientId?: string; verticalIds?: string[] } = {}) {
    const me = actor("member.manage");
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Name and a valid email are required.");
    if (state.members.some((m) => m.email === email.toLowerCase())) throw new Error("That email is already a member.");
    if (role === "client_portal" && !extra.clientId) throw new Error("Client portal users must be linked to a client.");
    if (role === "super_admin" && me.role !== "super_admin") throw new Denied("Only a Super Administrator can grant that role.");
    const m: Member = { ...base(orgId(), me.id), name: name.trim(), email: email.toLowerCase(), role, clientId: extra.clientId, verticalIds: extra.verticalIds ?? [], status: "invited" };
    commit(log({ ...state, members: [...state.members, m] }, me, "member.invited", `${m.email} as ${role}`));
    return m;
  },
  setRole(memberId: string, role: Role) {
    const me = actor("member.manage");
    const target = state.members.find((m) => m.id === memberId);
    if (!target) throw new Error("Member not found.");
    if (target.id === me.id) throw new Denied("You cannot change your own role.");
    if (role === "super_admin" && me.role !== "super_admin") throw new Denied("Only a Super Administrator can grant that role.");
    commit(log({ ...state, members: state.members.map((m) => (m.id === memberId ? { ...m, role, updatedAt: now() } : m)) }, me, "member.role_changed", `${target.email} → ${role}`));
  },
  setMemberStatus(memberId: string, status: "active" | "invited") {
    const me = actor("member.manage");
    commit(log({ ...state, members: state.members.map((m) => (m.id === memberId ? { ...m, status, updatedAt: now() } : m)) }, me, "member.status_changed", memberId));
  },

  /* ---------- verticals / clients ---------- */
  saveVertical(v: Partial<Vertical> & { name: string }) {
    const me = actor("vertical.write");
    if (!v.name.trim()) throw new Error("Name is required.");
    if (v.id) commit(log({ ...state, verticals: state.verticals.map((x) => (x.id === v.id ? { ...x, ...v, updatedAt: now() } : x)) }, me, "vertical.updated", v.name));
    else commit(log({ ...state, verticals: [...state.verticals, { ...base(orgId(), me.id), name: v.name.trim(), description: v.description ?? "", color: v.color ?? "blue", managerId: v.managerId }] }, me, "vertical.created", v.name));
  },
  saveClient(c: Partial<Client> & { name: string }) {
    const me = actor("client.write");
    if (!c.name.trim()) throw new Error("Name is required.");
    if (c.website) { const r = validateUrl(c.website); if (!r.ok) throw new Error(r.error); }
    if (c.id) commit(log({ ...state, clients: state.clients.map((x) => (x.id === c.id ? { ...x, ...c, updatedAt: now() } : x)) }, me, "client.updated", c.name));
    else commit(log({ ...state, clients: [...state.clients, { ...base(orgId(), me.id), name: c.name.trim(), industry: c.industry ?? "", website: c.website ?? "", contactName: c.contactName ?? "", contactEmail: c.contactEmail ?? "", managerId: c.managerId, status: c.status ?? "active" }] }, me, "client.created", c.name));
  },

  /* ---------- campaigns ---------- */
  saveCampaign(c: Partial<Campaign> & { name: string; ownerType: "vertical" | "client" }) {
    const me = actor("campaign.write");
    if (!c.name.trim()) throw new Error("Campaign name is required.");
    // Exactly one valid owner (mirrors the CHECK constraint in the database schema).
    if (c.ownerType === "vertical") {
      if (!c.verticalId || !state.verticals.some((v) => v.id === c.verticalId)) throw new Error("Choose a valid business vertical.");
      c = { ...c, clientId: undefined };
    } else {
      if (!c.clientId || !state.clients.some((v) => v.id === c.clientId)) throw new Error("Choose a valid client.");
      c = { ...c, verticalId: undefined };
    }
    if (c.callWindowStart && c.callWindowEnd && c.callWindowStart >= c.callWindowEnd) throw new Error("Calling window must end after it starts.");
    if (c.id) commit(log({ ...state, campaigns: state.campaigns.map((x) => (x.id === c.id ? { ...x, ...c, updatedAt: now() } as Campaign : x)) }, me, "campaign.updated", c.name));
    else {
      const camp: Campaign = {
        ...base(orgId(), me.id), name: c.name.trim(), objective: c.objective ?? "", status: c.status ?? "draft", ownerType: c.ownerType, verticalId: c.verticalId, clientId: c.clientId,
        startDate: c.startDate ?? now().slice(0, 10), endDate: c.endDate, targetLeads: c.targetLeads ?? 0, targetSales: c.targetSales ?? 0, leadSource: c.leadSource ?? "Manual",
        callingProvider: c.callingProvider ?? "Not configured", callWindowStart: c.callWindowStart ?? "09:00", callWindowEnd: c.callWindowEnd ?? "18:00", script: c.script ?? "",
        memberIds: c.memberIds ?? [me.id], bulkCallingEnabled: false,
      };
      commit(log({ ...state, campaigns: [...state.campaigns, camp] }, me, "campaign.created", camp.name));
    }
  },
  setCampaignMembers(campaignId: string, memberIds: string[]) {
    const me = actor("campaign.write");
    commit(log({ ...state, campaigns: state.campaigns.map((c) => (c.id === campaignId ? { ...c, memberIds, updatedAt: now() } : c)) }, me, "campaign.team_changed", campaignId));
  },

  /* ---------- leads / contacts ---------- */
  addLead(input: { campaignId: string; name: string; email?: string; phone?: string; company?: string; segment?: string; source?: string; value?: number; consentCalls: boolean; assigneeId?: string }) {
    const me = actor("lead.write");
    if (!input.name.trim()) throw new Error("Name is required.");
    if (!input.email && !input.phone) throw new Error("Provide an email or phone number.");
    if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) throw new Error("Email looks invalid.");
    if (!state.campaigns.some((c) => c.id === input.campaignId)) throw new Error("Campaign not found.");
    const phone = normPhone(input.phone);
    const email = input.email?.trim().toLowerCase() ?? "";
    // Duplicate detection: reuse an existing contact matched by email or phone.
    let contact = state.contacts.find((c) => (email && c.email === email) || (phone && normPhone(c.phone) === phone));
    let db = state;
    if (contact && state.leads.some((l) => l.contactId === contact!.id && l.campaignId === input.campaignId)) throw new Error(`Duplicate: ${contact.name} is already a lead in this campaign.`);
    if (!contact) {
      contact = { ...base(orgId(), me.id), name: input.name.trim(), email, phone: input.phone?.trim() ?? "", company: input.company ?? "", segment: input.segment ?? "", tags: [], consentCalls: input.consentCalls };
      db = { ...db, contacts: [...db.contacts, contact] };
    }
    const lead: Lead = { ...base(orgId(), me.id), campaignId: input.campaignId, contactId: contact.id, status: input.assigneeId ? "Assigned" : "New", assigneeId: input.assigneeId, source: input.source || "Manual", value: input.value ?? 0 };
    db = { ...db, leads: [...db.leads, lead] };
    if (input.assigneeId) db = notify(db, "info", `New lead assigned: ${contact.name}`, input.assigneeId);
    commit(log(db, me, "lead.created", contact.name));
    return lead;
  },
  setLeadStatus(leadId: string, status: LeadStatus) {
    const me = actor("lead.write");
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("Lead not found.");
    let db = { ...state, leads: state.leads.map((l) => (l.id === leadId ? { ...l, status, updatedAt: now() } : l)) };
    if (status === "Do Not Contact") db = { ...db, contacts: db.contacts.map((c) => (c.id === lead.contactId ? { ...c, consentCalls: false } : c)) };
    commit(log(db, me, "lead.status_changed", `${leadId} → ${status}`));
  },
  assignLead(leadId: string, assigneeId?: string) {
    const me = actor("lead.assign");
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("Lead not found.");
    const camp = state.campaigns.find((c) => c.id === lead.campaignId);
    if (assigneeId && !camp?.memberIds.includes(assigneeId)) throw new Error("Assignee must be on the campaign team.");
    let db: DB = { ...state, leads: state.leads.map((l) => (l.id === leadId ? { ...l, assigneeId, status: assigneeId && l.status === "New" ? "Assigned" as const : l.status, updatedAt: now() } : l)) };
    if (assigneeId) db = notify(db, "info", `New lead assigned to you`, assigneeId);
    commit(log(db, me, "lead.assigned", `${leadId} → ${assigneeId ?? "unassigned"}`));
  },
  addNote(leadId: string, body: string) {
    const me = actor("lead.write");
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead || !body.trim()) throw new Error("Write a note first.");
    commit({ ...state, notes: [{ ...base(orgId(), me.id), leadId, campaignId: lead.campaignId, body: body.trim(), authorId: me.id }, ...state.notes] });
  },
  addTask(t: { leadId?: string; campaignId?: string; title: string; dueAt: string; assigneeId?: string }) {
    const me = actor("lead.write");
    if (!t.title.trim()) throw new Error("Task title is required.");
    commit({ ...state, tasks: [{ ...base(orgId(), me.id), ...t, assigneeId: t.assigneeId ?? me.id, done: false }, ...state.tasks] });
  },
  toggleTask(id: string) { actor("lead.write"); commit({ ...state, tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, updatedAt: now() } : t)) }); },

  /* ---------- calling ---------- */
  recordCall(input: { leadId: string; durationSec: number; connected: boolean; disposition: Disposition; notes?: string; provider: string; providerEventId: string; simulated: boolean; revenue?: number; followUpAt?: string }) {
    const me = actor("call.place");
    const lead = state.leads.find((l) => l.id === input.leadId);
    if (!lead) throw new Error("Lead not found.");
    if (state.calls.some((c) => c.providerEventId === input.providerEventId)) return; // idempotent
    const elig = callEligibility(state, lead.id, new Date());
    if (!elig.ok) throw new Denied(elig.reason);
    const contact = state.contacts.find((c) => c.id === lead.contactId)!;
    const call: CallSession = { ...base(orgId(), me.id), leadId: lead.id, campaignId: lead.campaignId, agentId: me.id, status: input.connected ? "completed" : "no_answer", startedAt: new Date(Date.now() - input.durationSec * 1000).toISOString(), durationSec: input.durationSec, connected: input.connected, disposition: input.disposition, notes: input.notes, provider: input.provider, providerEventId: input.providerEventId, simulated: input.simulated, revenue: input.disposition === "Sale" ? input.revenue ?? lead.value : 0 };
    const next: Record<Disposition, LeadStatus> = { Interested: "Qualified", Callback: "Callback Required", "Not Interested": "Disqualified", "No Answer": "Attempting Contact", Voicemail: "Attempting Contact", "Wrong Number": "Disqualified", Sale: "Converted", "Do Not Contact": "Do Not Contact" };
    let db: DB = {
      ...state, calls: [call, ...state.calls],
      leads: state.leads.map((l) => (l.id === lead.id ? { ...l, status: next[input.disposition], lastContactAt: now(), assigneeId: l.assigneeId ?? me.id, updatedAt: now() } : l)),
      interactions: [{ ...base(orgId(), me.id), leadId: lead.id, campaignId: lead.campaignId, kind: "call", summary: `${input.disposition}${input.notes ? ` — ${input.notes}` : ""}`, at: now(), actorId: me.id }, ...state.interactions],
    };
    if (input.disposition === "Do Not Contact") db = { ...db, contacts: db.contacts.map((c) => (c.id === contact.id ? { ...c, consentCalls: false } : c)) };
    if (input.notes?.trim()) db = { ...db, notes: [{ ...base(orgId(), me.id), leadId: lead.id, campaignId: lead.campaignId, body: input.notes.trim(), authorId: me.id }, ...db.notes] };
    if (input.disposition === "Callback" && input.followUpAt) db = { ...db, tasks: [{ ...base(orgId(), me.id), leadId: lead.id, campaignId: lead.campaignId, assigneeId: me.id, title: `Call back ${contact.name}`, dueAt: input.followUpAt, done: false }, ...db.tasks] };
    commit(log(db, me, "call.recorded", `${contact.name} (${input.disposition})`));
  },

  /* ---------- assets / docs / integrations / messages ---------- */
  addAsset(a: { url: string; label: string; description?: string; category: Asset["category"]; campaignId?: string; clientId?: string; verticalId?: string; intendedUse?: string }) {
    const me = actor("asset.write");
    const r = validateUrl(a.url);
    if (!r.ok) throw new Error(r.error);
    if (!a.label.trim()) throw new Error("Label is required.");
    if (state.assets.some((x) => x.url === r.url && x.campaignId === a.campaignId && x.clientId === a.clientId)) throw new Error("That URL is already registered here.");
    commit(log({ ...state, assets: [...state.assets, { ...base(orgId(), me.id), ...a, url: r.url, label: a.label.trim(), description: a.description ?? "", intendedUse: a.intendedUse ?? "", connection: "registered" }] }, me, "asset.registered", r.url));
  },
  removeAsset(id: string) { const me = actor("asset.write"); commit(log({ ...state, assets: state.assets.filter((a) => a.id !== id) }, me, "asset.removed", id)); },
  addDoc(d: Omit<Doc, keyof ReturnType<typeof base>>) {
    const me = actor("doc.write");
    if (!d.title.trim() || !d.reference.trim()) throw new Error("Title and reference are required.");
    if (d.storage === "external") { const r = validateUrl(d.reference); if (!r.ok) throw new Error(r.error); }
    commit(log({ ...state, docs: [...state.docs, { ...base(orgId(), me.id), ...d }] }, me, "document.added", d.title));
  },
  /** Connection state is never faked: without provider credentials the test fails truthfully. */
  testIntegration(id: string) {
    const me = actor("integration.manage");
    const it = state.integrations.find((i) => i.id === id)!;
    const entry = { at: now(), message: "Connection test failed: no credentials configured. Add them as backend secrets (see docs/INTEGRATIONS.md)." };
    let db: DB = { ...state, integrations: state.integrations.map((i) => (i.id === id ? { ...i, status: "error", errors: [entry, ...i.errors].slice(0, 20), updatedAt: now() } as Integration : i)) };
    db = notify(db, "error", `${it.provider}: connection test failed`, me.id);
    commit(log(db, me, "integration.tested", it.provider));
  },
  resetIntegration(id: string) {
    const me = actor("integration.manage");
    commit(log({ ...state, integrations: state.integrations.map((i) => (i.id === id ? { ...i, status: "not_connected", errors: [], updatedAt: now() } as Integration : i)) }, me, "integration.disconnected", id));
  },
  logMessage(m: { leadId: string; channel: Message["channel"]; direction: "in" | "out"; body: string }) {
    const me = actor("inbox.use");
    if (!m.body.trim()) throw new Error("Message is empty.");
    const lead = state.leads.find((l) => l.id === m.leadId);
    commit({ ...state, messages: [...state.messages, { ...base(orgId(), me.id), ...m, campaignId: lead?.campaignId, at: now(), actorId: me.id }] });
  },

  /* ---------- reports / notifications ---------- */
  saveReportRun(r: Pick<ReportRun, "name" | "period" | "campaignId" | "csv" | "rows">) {
    const me = actor("report.run");
    commit(log({ ...state, reports: [{ ...base(orgId(), me.id), ...r }, ...state.reports] }, me, "report.generated", r.name));
  },
  scheduleReport(s: Pick<ScheduledReport, "name" | "period" | "timezone" | "recipients" | "campaignId">) {
    const me = actor("report.schedule");
    if (!s.recipients.trim()) throw new Error("Add at least one recipient.");
    commit(log({ ...state, schedules: [...state.schedules, { ...base(orgId(), me.id), ...s }] }, me, "report.scheduled", s.name));
  },
  markAllRead() { commit({ ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }); },
};

export const normPhone = (p?: string) => (p ?? "").replace(/[^\d+]/g, "").replace(/^00/, "+");

/** Pure rule check used by the UI and re-checked inside recordCall. */
export function callEligibility(db: DB, leadId: string, at: Date): { ok: true } | { ok: false; reason: string } {
  const lead = db.leads.find((l) => l.id === leadId);
  const contact = lead && db.contacts.find((c) => c.id === lead.contactId);
  const camp = lead && db.campaigns.find((c) => c.id === lead.campaignId);
  if (!lead || !contact || !camp) return { ok: false, reason: "Lead not found." };
  if (lead.status === "Do Not Contact") return { ok: false, reason: "Contact is on the Do Not Contact list." };
  if (!contact.consentCalls) return { ok: false, reason: "No call consent recorded for this contact." };
  if (!normPhone(contact.phone)) return { ok: false, reason: "Contact has no phone number." };
  if (camp.status !== "active") return { ok: false, reason: `Campaign is ${camp.status}; only active campaigns can call.` };
  const hm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  if (hm < camp.callWindowStart || hm > camp.callWindowEnd) return { ok: false, reason: `Outside the campaign calling window (${camp.callWindowStart}–${camp.callWindowEnd}).` };
  return { ok: true };
}
