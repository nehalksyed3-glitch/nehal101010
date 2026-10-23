import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Plus, Search } from "lucide-react";
import { Avatar, Badge, Button, Empty, Field, Input, Modal, Select, Table, Textarea, useToast, type Tone } from "./ui";
import { actions, callEligibility, useStore } from "../lib/store";
import { can, visibleCampaigns, visibleLeads } from "../lib/rbac";
import { LEAD_STATUSES, type LeadStatus } from "../lib/types";
import { fmtDateTime, money } from "../lib/util";

export const statusTone = (s: LeadStatus): Tone => ({ New: "gray", Assigned: "blue", "Attempting Contact": "blue", Contacted: "blue", Qualified: "green", "Callback Required": "orange", Converted: "green", Disqualified: "gray", "Do Not Contact": "red" } as Record<LeadStatus, Tone>)[s];

export function LeadsPanel({ campaignId, openId }: { campaignId?: string; openId?: string | null }) {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string | null>(openId ?? null);
  const camps = visibleCampaigns(db, me);

  const rows = useMemo(() => visibleLeads(db, me).filter((l) => !campaignId || l.campaignId === campaignId).map((l) => ({ lead: l, contact: db.contacts.find((c) => c.id === l.contactId)!, camp: db.campaigns.find((c) => c.id === l.campaignId)! }))
    .filter((r) => r.contact && (!status || r.lead.status === status) && (!q || (r.contact.name + r.contact.email + r.contact.company + r.contact.phone).toLowerCase().includes(q.toLowerCase()))), [db, me, campaignId, q, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input aria-label="Search leads" className="pl-9" placeholder="Search name, email, phone, company" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Filter by status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
        {can(me, "lead.write") && <Button onClick={() => setAdding(true)} disabled={!camps.length}><Plus size={16} /> Add lead</Button>}
      </div>
      {rows.length === 0 ? <Empty title="No leads match" hint="Add a lead, or adjust the search and filters." /> : (
        <Table head={["Lead", "Company", "Campaign", "Status", "Owner", "Value"]}>
          {rows.slice(0, 200).map(({ lead, contact, camp }) => {
            const owner = db.members.find((m) => m.id === lead.assigneeId);
            return (
              <tr key={lead.id} className="cursor-pointer hover:bg-blue-50/60" onClick={() => setSel(lead.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(lead.id)}>
                <td className="px-3 py-2.5"><b className="block">{contact.name}</b><span className="text-xs text-muted">{contact.email || contact.phone}</span></td>
                <td className="px-3 py-2.5">{contact.company}</td>
                <td className="px-3 py-2.5 text-muted">{camp.name}</td>
                <td className="px-3 py-2.5"><Badge tone={statusTone(lead.status)}>{lead.status}</Badge></td>
                <td className="px-3 py-2.5">{owner ? <span className="flex items-center gap-2"><Avatar name={owner.name} size={22} />{owner.name.split(" ")[0]}</span> : <span className="text-muted">Unassigned</span>}</td>
                <td className="px-3 py-2.5">{money(lead.value)}</td>
              </tr>
            );
          })}
        </Table>
      )}
      {adding && <AddLead campaignId={campaignId} onClose={() => setAdding(false)} run={run} />}
      {sel && <LeadDrawer id={sel} onClose={() => setSel(null)} run={run} />}
      {node}
    </div>
  );
}

function AddLead({ campaignId, onClose, run }: { campaignId?: string; onClose: () => void; run: ReturnType<typeof useToast>["run"] }) {
  const { db, me } = useStore();
  const camps = visibleCampaigns(db, me);
  const [f, setF] = useState({ campaignId: campaignId ?? camps[0]?.id ?? "", name: "", email: "", phone: "", company: "", source: "Manual", value: "0", consent: false, assigneeId: "" });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const team = db.members.filter((m) => db.campaigns.find((c) => c.id === f.campaignId)?.memberIds.includes(m.id));
  return (
    <Modal title="Add lead" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => actions.addLead({ campaignId: f.campaignId, name: f.name, email: f.email, phone: f.phone, company: f.company, source: f.source, value: Number(f.value) || 0, consentCalls: f.consent, assigneeId: f.assigneeId || undefined }), "Lead added")) onClose(); }}>
        <Field label="Campaign">{(id) => <Select id={id} value={f.campaignId} onChange={(e) => set("campaignId", e.target.value)}>{camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">{(id) => <Input id={id} value={f.name} onChange={(e) => set("name", e.target.value)} required />}</Field>
          <Field label="Company">{(id) => <Input id={id} value={f.company} onChange={(e) => set("company", e.target.value)} />}</Field>
          <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />}</Field>
          <Field label="Phone (E.164)">{(id) => <Input id={id} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+14155550123" />}</Field>
          <Field label="Source">{(id) => <Input id={id} value={f.source} onChange={(e) => set("source", e.target.value)} />}</Field>
          <Field label="Est. value (USD)">{(id) => <Input id={id} type="number" min={0} value={f.value} onChange={(e) => set("value", e.target.value)} />}</Field>
        </div>
        {can(me, "lead.assign") && <Field label="Assign to">{(id) => <Select id={id} value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}><option value="">Unassigned</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}</Field>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} /><span>Contact has given consent to be called. Calls are blocked without it.</span></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Save lead</Button></div>
      </form>
    </Modal>
  );
}

function LeadDrawer({ id, onClose, run }: { id: string; onClose: () => void; run: ReturnType<typeof useToast>["run"] }) {
  const { db, me } = useStore();
  const lead = db.leads.find((l) => l.id === id);
  const contact = db.contacts.find((c) => c.id === lead?.contactId);
  const camp = db.campaigns.find((c) => c.id === lead?.campaignId);
  const [note, setNote] = useState("");
  const [task, setTask] = useState({ title: "", due: "" });
  if (!lead || !contact || !camp) return null;
  const writable = can(me, "lead.write");
  const elig = callEligibility(db, lead.id, new Date());
  const timeline = [...db.interactions.filter((i) => i.leadId === id).map((i) => ({ at: i.at, text: `${i.kind}: ${i.summary}` })), ...db.notes.filter((n) => n.leadId === id).map((n) => ({ at: n.createdAt, text: `Note: ${n.body}` }))].sort((a, b) => b.at.localeCompare(a.at));
  const tasks = db.tasks.filter((t) => t.leadId === id);
  return (
    <Modal title={contact.name} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-canvas p-3"><div><p className="text-xs text-muted">Company</p>{contact.company || "—"}</div><div><p className="text-xs text-muted">Campaign</p><Link className="text-blue-600" to={`/campaigns/${camp.id}`}>{camp.name}</Link></div><div><p className="text-xs text-muted">Email</p>{contact.email || "—"}</div><div><p className="text-xs text-muted">Phone</p>{contact.phone || "—"}</div><div><p className="text-xs text-muted">Call consent</p>{contact.consentCalls ? <Badge tone="green">Granted</Badge> : <Badge tone="red">None</Badge>}</div><div><p className="text-xs text-muted">Source · value</p>{lead.source} · {money(lead.value)}</div></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Status">{(i) => <Select id={i} disabled={!writable} value={lead.status} onChange={(e) => run(() => actions.setLeadStatus(lead.id, e.target.value as LeadStatus), "Status updated")}>{LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>}</Field>
          {can(me, "lead.assign") && <Field label="Owner">{(i) => <Select id={i} value={lead.assigneeId ?? ""} onChange={(e) => run(() => actions.assignLead(lead.id, e.target.value || undefined), "Assignment updated")}><option value="">Unassigned</option>{db.members.filter((m) => camp.memberIds.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}</Field>}
        </div>
        {can(me, "call.place") && <div className="flex items-center gap-3"><Link to={`/calling?lead=${lead.id}`} className={`focus-ring inline-flex items-center gap-2 rounded-xl px-3.5 py-2 font-medium text-white ${elig.ok ? "bg-green-600" : "pointer-events-none bg-slate-300"}`}><Phone size={16} /> Open in Calling Center</Link>{!elig.ok && <span className="text-xs text-orange-600">{elig.reason}</span>}</div>}
        {writable && <>
          <div className="flex gap-2"><Input aria-label="New note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" /><Button variant="soft" onClick={() => run(() => { actions.addNote(lead.id, note); setNote(""); })}>Add</Button></div>
          <div className="flex gap-2"><Input aria-label="Task title" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Follow-up task" /><Input aria-label="Due" type="datetime-local" className="w-48" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} /><Button variant="soft" onClick={() => run(() => { if (!task.due) throw new Error("Pick a due date."); actions.addTask({ leadId: lead.id, campaignId: camp.id, title: task.title, dueAt: new Date(task.due).toISOString() }); setTask({ title: "", due: "" }); }, "Task added")}>Add</Button></div>
        </>}
        {tasks.length > 0 && <ul className="space-y-1">{tasks.map((t) => <li key={t.id} className="flex items-center gap-2"><input type="checkbox" aria-label={t.title} checked={t.done} disabled={!writable} onChange={() => run(() => actions.toggleTask(t.id))} /><span className={t.done ? "text-muted line-through" : ""}>{t.title}</span><span className="ml-auto text-xs text-muted">{fmtDateTime(t.dueAt)}</span></li>)}</ul>}
        <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Timeline</p>{timeline.length ? <ul className="space-y-1.5 border-l-2 border-blue-100 pl-3">{timeline.slice(0, 12).map((t, i) => <li key={i}><span className="text-xs text-muted">{fmtDateTime(t.at)}</span><br />{t.text}</li>)}</ul> : <p className="text-muted">No activity yet.</p>}</div>
      </div>
    </Modal>
  );
}

export { Textarea };
