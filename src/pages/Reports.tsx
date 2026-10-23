import { useState } from "react";
import { Download } from "lucide-react";
import { Badge, Button, Card, CardTitle, Empty, Field, Input, PageHeader, Select, Table, useToast } from "../components/ui";
import { actions, useStore } from "../lib/store";
import { can, visibleCampaigns } from "../lib/rbac";
import { agentRows, campaignRows, kpis, lastDays, dayKey } from "../lib/metrics";
import { download, fmtDateTime, fmtDuration, money, pct, toCsv } from "../lib/util";

type Period = "daily" | "weekly" | "monthly";
const SPAN: Record<Period, number> = { daily: 1, weekly: 7, monthly: 30 };

export default function Reports() {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [period, setPeriod] = useState<Period>("weekly");
  const [campaignId, setCampaignId] = useState("");
  const [sch, setSch] = useState({ recipients: "", period: "weekly" as Period });
  const camps = visibleCampaigns(db, me);
  const ids = camps.filter((c) => !campaignId || c.id === campaignId).map((c) => c.id);
  const days = new Set(lastDays(SPAN[period]));
  const calls = db.calls.filter((c) => ids.includes(c.campaignId) && days.has(dayKey(c.startedAt)));
  const leads = db.leads.filter((l) => ids.includes(l.campaignId));
  const k = kpis(calls, leads);
  const rows = campaignRows({ ...db, calls }, ids);
  const agents = agentRows({ ...db, calls }, ids);

  const build = () => {
    const out: (string | number)[][] = [["Campaign", "Calls", "Connected", "Talk time (s)", "Sales", "Revenue (USD)", "Leads", "Converted"], ...rows.map((r) => [r.campaign.name, r.attempts, r.connected, r.talkSec, r.sales, r.revenue, r.leads, r.converted])];
    const csv = toCsv(out);
    run(() => { actions.saveReportRun({ name: `${period} report`, period, campaignId: campaignId || undefined, csv, rows: rows.length }); download(`assorted-${period}-report.csv`, csv); }, "Report generated");
  };
  return (
    <>
      <PageHeader title="Reports & Analytics" sub="Figures are computed from persisted calls and leads; duplicate provider events are counted once." />
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Period">{(id) => <Select id={id} value={period} onChange={(e) => setPeriod(e.target.value as Period)}><option value="daily">Daily (today)</option><option value="weekly">Weekly (7 days)</option><option value="monthly">Monthly (30 days)</option></Select>}</Field>
        <Field label="Campaign">{(id) => <Select id={id} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="">All in scope</option>{camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
        <Button onClick={build} disabled={!ids.length}><Download size={16} /> Generate CSV</Button>
      </Card>
      {ids.length === 0 ? <Empty title="No data in scope" /> : (
        <div className="grid gap-4 md:grid-cols-4">
          {[["Calls attempted", k.attempts], ["Connected", `${k.connected} (${pct(k.contactRate)})`], ["Talk time", fmtDuration(k.talkSec)], ["Revenue", money(k.revenue)]].map(([l, v]) => <Card key={l as string}><p className="text-xs uppercase tracking-wide text-muted">{l}</p><p className="font-display mt-1 text-2xl font-bold">{v}</p></Card>)}
          <Card className="md:col-span-4"><CardTitle>By campaign</CardTitle><Table head={["Campaign", "Calls", "Connected", "Sales", "Revenue", "Conversion"]}>{rows.map((r) => <tr key={r.campaign.id}><td className="px-3 py-2 font-medium">{r.campaign.name}</td><td className="px-3 py-2">{r.attempts}</td><td className="px-3 py-2">{r.connected}</td><td className="px-3 py-2">{r.sales}</td><td className="px-3 py-2">{money(r.revenue)}</td><td className="px-3 py-2">{pct(r.conversion)}</td></tr>)}</Table></Card>
          <Card className="md:col-span-2"><CardTitle>Agent activity</CardTitle>{agents.length ? <Table head={["Agent", "Calls", "Sales"]}>{agents.map((a) => <tr key={a.member.id}><td className="px-3 py-2">{a.member.name}</td><td className="px-3 py-2">{a.attempts}</td><td className="px-3 py-2">{a.sales}</td></tr>)}</Table> : <p className="text-sm text-muted">No calls in this period.</p>}</Card>
          <Card className="md:col-span-2"><CardTitle>Cost & ROI</CardTitle><p className="text-sm text-muted">Cost per lead and ROI are shown only when campaign costs are recorded. No cost data exists yet, so these are intentionally not estimated.</p></Card>
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card><CardTitle>Generated reports</CardTitle>{db.reports.length ? <ul className="divide-y divide-line text-sm">{db.reports.slice(0, 8).map((r) => <li key={r.id} className="flex items-center justify-between py-2"><span>{r.name}<span className="block text-xs text-muted">{fmtDateTime(r.createdAt)} · {r.rows} rows</span></span><Button variant="ghost" onClick={() => download(`${r.name}.csv`, r.csv)}><Download size={14} /></Button></li>)}</ul> : <p className="text-sm text-muted">Nothing generated yet.</p>}</Card>
        <Card><CardTitle>Schedule a report</CardTitle>
          {can(me, "report.schedule") ? <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => actions.scheduleReport({ name: `${sch.period} report`, period: sch.period, timezone: db.org?.timezone ?? "UTC", recipients: sch.recipients, campaignId: campaignId || undefined }), "Schedule saved"); }}>
            <Field label="Recipients (comma separated)">{(id) => <Input id={id} value={sch.recipients} onChange={(e) => setSch({ ...sch, recipients: e.target.value })} placeholder="ops@example.com" />}</Field>
            <Field label="Frequency">{(id) => <Select id={id} value={sch.period} onChange={(e) => setSch({ ...sch, period: e.target.value as Period })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></Select>}</Field>
            <Button type="submit">Save schedule</Button>
          </form> : <p className="text-sm text-muted">Your role cannot schedule reports.</p>}
          {db.schedules.map((s) => <p key={s.id} className="mt-2 text-sm"><Badge tone="blue">{s.period}</Badge> {s.recipients} <span className="text-xs text-muted">({s.timezone})</span></p>)}
          {db.schedules.length > 0 && <p className="mt-2 text-xs text-muted">Schedules are stored. Automated delivery runs from the backend scheduled job (see docs/INTEGRATIONS.md).</p>}
        </Card>
      </div>
      {node}
    </>
  );
}
