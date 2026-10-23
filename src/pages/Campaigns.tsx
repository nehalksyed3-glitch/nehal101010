import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Avatar, Badge, Bars, Button, Card, CardTitle, Empty, Field, Input, Modal, PageHeader, Progress, Select, Stat, Table, Textarea, useToast } from "../components/ui";
import { LeadsPanel } from "../components/LeadsPanel";
import { AssetsPanel } from "../components/AssetsPanel";
import { actions, useStore } from "../lib/store";
import { can, visibleCampaigns } from "../lib/rbac";
import { callsByDay, campaignRows, dispositionCounts, kpis } from "../lib/metrics";
import { fmtDate, fmtDateTime, fmtDuration, money, pct, toCsv, download } from "../lib/util";
import { ROLE_LABEL, type Campaign } from "../lib/types";

const owner = (db: ReturnType<typeof useStore>["db"], c: Campaign) => c.ownerType === "vertical" ? db.verticals.find((v) => v.id === c.verticalId)?.name : db.clients.find((x) => x.id === c.clientId)?.name;
const stTone = { active: "green", paused: "orange", draft: "gray", completed: "blue" } as const;

export function CampaignList() {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [sp, setSp] = useSearchParams();
  const [creating, setCreating] = useState(sp.get("new") === "1");
  const camps = visibleCampaigns(db, me);
  const rows = campaignRows(db, camps.map((c) => c.id));
  return (
    <>
      <PageHeader title="Campaigns" sub="Internal vertical campaigns and external client campaigns." action={can(me, "campaign.write") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New campaign</Button>} />
      {rows.length === 0 ? <Empty title="No campaigns in your scope" hint={db.verticals.length + db.clients.length ? "Create a campaign under a vertical or client." : "Create a vertical or client first, then add a campaign."} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Link key={r.campaign.id} to={`/campaigns/${r.campaign.id}`} className="focus-ring bento block p-5 transition hover:border-blue-500">
              <div className="flex items-center justify-between"><Badge tone={r.campaign.ownerType === "client" ? "orange" : "blue"}>{r.campaign.ownerType === "client" ? "Client" : "Internal"} · {owner(db, r.campaign)}</Badge><Badge tone={stTone[r.campaign.status]}>{r.campaign.status}</Badge></div>
              <h3 className="mt-3 text-lg font-semibold">{r.campaign.name}</h3><p className="line-clamp-2 text-sm text-muted">{r.campaign.objective}</p>
              <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-muted"><span>Sales target</span><span>{r.sales}/{r.campaign.targetSales}</span></div><Progress value={r.progress} /></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm"><div><b className="block">{r.leads}</b><span className="text-xs text-muted">Leads</span></div><div><b className="block">{r.attempts}</b><span className="text-xs text-muted">Calls</span></div><div><b className="block">{money(r.revenue)}</b><span className="text-xs text-muted">Revenue</span></div></div>
            </Link>
          ))}
        </div>
      )}
      {creating && <CampaignForm onClose={() => { setCreating(false); sp.delete("new"); setSp(sp); }} run={run} />}
      {node}
    </>
  );
}

function CampaignForm({ existing, onClose, run }: { existing?: Campaign; onClose: () => void; run: ReturnType<typeof useToast>["run"] }) {
  const { db } = useStore();
  const [f, setF] = useState<Partial<Campaign> & { ownerType: "vertical" | "client" }>(existing ?? { name: "", objective: "", status: "draft", ownerType: db.verticals.length ? "vertical" : "client", verticalId: db.verticals[0]?.id, clientId: db.clients[0]?.id, targetLeads: 100, targetSales: 10, leadSource: "Website form", callWindowStart: "09:00", callWindowEnd: "18:00", script: "" });
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={existing ? "Edit campaign" : "New campaign"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => actions.saveCampaign({ ...f, name: f.name ?? "" }), "Campaign saved")) onClose(); }}>
        <Field label="Name">{(id) => <Input id={id} required value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />}</Field>
        <Field label="Objective">{(id) => <Textarea id={id} value={f.objective ?? ""} onChange={(e) => set("objective", e.target.value)} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner type">{(id) => <Select id={id} disabled={!!existing} value={f.ownerType} onChange={(e) => setF({ ...f, ownerType: e.target.value as "vertical" | "client" })}><option value="vertical">Internal vertical</option><option value="client">External client</option></Select>}</Field>
          {f.ownerType === "vertical"
            ? <Field label="Vertical">{(id) => <Select id={id} value={f.verticalId ?? ""} onChange={(e) => set("verticalId", e.target.value)}><option value="">Select…</option>{db.verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>}</Field>
            : <Field label="Client">{(id) => <Select id={id} value={f.clientId ?? ""} onChange={(e) => set("clientId", e.target.value)}><option value="">Select…</option>{db.clients.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>}</Field>}
          <Field label="Status">{(id) => <Select id={id} value={f.status} onChange={(e) => set("status", e.target.value as Campaign["status"])}><option>draft</option><option>active</option><option>paused</option><option>completed</option></Select>}</Field>
          <Field label="Lead source">{(id) => <Input id={id} value={f.leadSource ?? ""} onChange={(e) => set("leadSource", e.target.value)} />}</Field>
          <Field label="Target leads">{(id) => <Input id={id} type="number" min={0} value={f.targetLeads ?? 0} onChange={(e) => set("targetLeads", Number(e.target.value))} />}</Field>
          <Field label="Target sales">{(id) => <Input id={id} type="number" min={0} value={f.targetSales ?? 0} onChange={(e) => set("targetSales", Number(e.target.value))} />}</Field>
          <Field label="Calls allowed from">{(id) => <Input id={id} type="time" value={f.callWindowStart ?? "09:00"} onChange={(e) => set("callWindowStart", e.target.value)} />}</Field>
          <Field label="Calls allowed until">{(id) => <Input id={id} type="time" value={f.callWindowEnd ?? "18:00"} onChange={(e) => set("callWindowEnd", e.target.value)} />}</Field>
        </div>
        <Field label="Call script">{(id) => <Textarea id={id} value={f.script ?? ""} onChange={(e) => set("script", e.target.value)} />}</Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Save campaign</Button></div>
      </form>
    </Modal>
  );
}

const TABS = ["Overview", "Leads", "Calling", "Conversations", "Assets", "Integrations", "Team", "Reports"] as const;

export function CampaignDetail() {
  const { id } = useParams();
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [editing, setEditing] = useState(false);
  const c = visibleCampaigns(db, me).find((x) => x.id === id);
  if (!c) return <Empty title="Campaign not found" hint="It may not exist, or it is outside your access." action={<Link className="text-blue-600" to="/campaigns">Back to campaigns</Link>} />;
  const leads = db.leads.filter((l) => l.campaignId === c.id);
  const calls = db.calls.filter((x) => x.campaignId === c.id);
  const k = kpis(calls, leads);
  const tabs = me?.role === "client_portal" ? (["Overview", "Reports"] as const) : TABS;

  return (
    <>
      <PageHeader title={c.name} sub={`${c.ownerType === "client" ? "Client" : "Vertical"}: ${owner(db, c)} · ${fmtDate(c.startDate)}${c.endDate ? ` → ${fmtDate(c.endDate)}` : ""}`}
        action={<div className="flex items-center gap-2"><Badge tone={stTone[c.status]}>{c.status}</Badge>{can(me, "campaign.write") && <Button variant="ghost" onClick={() => setEditing(true)}>Edit</Button>}</div>} />
      <div role="tablist" className="scroll-thin mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 ring-1 ring-line">
        {tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t as typeof tab)} className={`focus-ring whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium ${tab === t ? "bg-navy-900 text-white" : "text-muted hover:bg-blue-50"}`}>{t}</button>)}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Leads" value={k.leads} sub={`Target ${c.targetLeads}`} /><Stat label="Calls" value={k.attempts} sub={`${pct(k.contactRate)} contact rate`} tone="green" /><Stat label="Sales" value={`${k.sales}/${c.targetSales}`} sub="vs target" tone="orange" /><Stat label="Revenue" value={money(k.revenue)} sub="From recorded sales" />
          <Card className="md:col-span-3"><CardTitle>Call activity · 14 days</CardTitle><Bars data={callsByDay(calls).map((d) => ({ label: d.day, a: d.attempts, b: d.connected }))} /></Card>
          <Card><CardTitle>Dispositions</CardTitle>{calls.length ? <ul className="space-y-1 text-sm">{dispositionCounts(calls).map(([d, n]) => <li key={d} className="flex justify-between"><span className="text-muted">{d}</span><b>{n}</b></li>)}</ul> : <p className="text-sm text-muted">No calls yet.</p>}</Card>
          <Card className="md:col-span-4"><CardTitle>Objective & script</CardTitle><p className="text-sm">{c.objective || "—"}</p><p className="mt-2 rounded-xl bg-canvas p-3 text-sm text-muted">{c.script || "No script yet."}</p></Card>
        </div>
      )}
      {tab === "Leads" && <Card><LeadsPanel campaignId={c.id} /></Card>}
      {tab === "Calling" && (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 text-sm"><div className="rounded-xl bg-canvas p-3"><p className="text-xs text-muted">Provider</p>{c.callingProvider}</div><div className="rounded-xl bg-canvas p-3"><p className="text-xs text-muted">Allowed window</p>{c.callWindowStart}–{c.callWindowEnd}</div><div className="rounded-xl bg-canvas p-3"><p className="text-xs text-muted">Bulk calling</p>{c.bulkCallingEnabled ? "Enabled" : "Off (explicit authorisation required)"}</div></div>
          {can(me, "call.place") && <Link to={`/calling?campaign=${c.id}`} className="inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white">Open Calling Center</Link>}
          {calls.length ? <Table head={["When", "Agent", "Result", "Duration", "Mode"]}>{calls.slice(0, 15).map((x) => <tr key={x.id}><td className="px-3 py-2">{fmtDateTime(x.startedAt)}</td><td className="px-3 py-2">{db.members.find((m) => m.id === x.agentId)?.name}</td><td className="px-3 py-2">{x.disposition}</td><td className="px-3 py-2">{fmtDuration(x.durationSec)}</td><td className="px-3 py-2">{x.simulated ? <Badge tone="orange">Simulated</Badge> : <Badge tone="green">Live</Badge>}</td></tr>)}</Table> : <Empty title="No call history" />}
        </Card>
      )}
      {tab === "Conversations" && <Card>{db.messages.filter((m) => m.campaignId === c.id).length ? <ul className="space-y-2 text-sm">{db.messages.filter((m) => m.campaignId === c.id).map((m) => { const l = db.leads.find((x) => x.id === m.leadId); const ct = db.contacts.find((x) => x.id === l?.contactId); return <li key={m.id} className="rounded-xl bg-canvas p-3"><span className="text-xs text-muted">{m.channel} · {m.direction === "in" ? "from" : "to"} {ct?.name} · {fmtDateTime(m.at)}</span><br />{m.body}</li>; })}</ul> : <Empty title="No conversations" hint="Messages appear here once a channel is connected or logged from the Unified Inbox." />}</Card>}
      {tab === "Assets" && <Card><AssetsPanel campaignId={c.id} /></Card>}
      {tab === "Integrations" && <Card className="text-sm"><p>Lead source: <b>{c.leadSource}</b></p><p className="mt-2 text-muted">Connect providers in the <Link className="text-blue-600" to="/integrations">Integration Hub</Link>. Lead capture arrives through the signed lead webhook once configured.</p></Card>}
      {tab === "Team" && (
        <Card>
          <ul className="space-y-1">{db.members.filter((m) => m.status === "active" && m.role !== "client_portal").map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5"><input type="checkbox" aria-label={`${m.name} on team`} disabled={!can(me, "campaign.write")} checked={c.memberIds.includes(m.id)} onChange={(e) => run(() => actions.setCampaignMembers(c.id, e.target.checked ? [...c.memberIds, m.id] : c.memberIds.filter((x) => x !== m.id)))} /><Avatar name={m.name} size={26} /><span className="text-sm">{m.name}</span><Badge tone="gray">{ROLE_LABEL[m.role]}</Badge></li>
          ))}</ul>
        </Card>
      )}
      {tab === "Reports" && (
        <Card className="space-y-3 text-sm">
          <p>Export this campaign's persisted lead and call data.</p>
          <Button disabled={!can(me, "report.run")} onClick={() => run(() => {
            const rows = [["Lead", "Status", "Source", "Value"], ...leads.map((l) => [db.contacts.find((x) => x.id === l.contactId)?.name ?? "", l.status, l.source, l.value])];
            const csv = toCsv(rows); actions.saveReportRun({ name: `${c.name} leads`, period: "daily", campaignId: c.id, csv, rows: rows.length - 1 }); download(`${c.name}-leads.csv`, csv);
          }, "Report generated")}>Download leads CSV</Button>
        </Card>
      )}
      {editing && <CampaignForm existing={c} onClose={() => setEditing(false)} run={run} />}
      {node}
    </>
  );
}
