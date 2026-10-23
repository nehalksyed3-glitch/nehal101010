import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CalendarClock, PhoneCall, Plus, TrendingUp } from "lucide-react";
import { Badge, Bars, Card, CardTitle, Empty, Progress, Stat } from "../components/ui";
import { useStore } from "../lib/store";
import { can, visibleCampaigns, visibleLeads } from "../lib/rbac";
import { agentRows, callsByDay, campaignRows, dispositionCounts, kpis, pipelineCounts } from "../lib/metrics";
import { fmtDateTime, fmtDuration, money, pct } from "../lib/util";
import { LEAD_STATUSES } from "../lib/types";

export default function Overview() {
  const { db, me } = useStore();
  if (!me) return null;
  const camps = visibleCampaigns(db, me);
  const ids = camps.map((c) => c.id);
  const calls = db.calls.filter((c) => ids.includes(c.campaignId));
  const leads = visibleLeads(db, me);
  const k = kpis(calls, leads);
  const rows = campaignRows(db, ids);
  const agents = agentRows(db, ids).slice(0, 4);
  const overdue = db.tasks.filter((t) => !t.done && new Date(t.dueAt) < new Date() && (t.assigneeId === me.id || can(me, "lead.assign")) && (!t.campaignId || ids.includes(t.campaignId)));
  const errors = db.integrations.filter((i) => i.status === "error");
  const pipe = pipelineCounts(leads);

  if (!db.campaigns.length) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <Card hero className="p-8"><h1 className="text-3xl font-bold">Welcome to {db.org?.name}</h1><p className="mt-2 text-white/75">Start with the hierarchy: add a business vertical or client, then create a campaign.</p>
          <div className="relative z-10 mt-5 flex flex-wrap gap-2"><Link to="/verticals" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-navy-900">Add a vertical</Link><Link to="/clients" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-medium text-white">Add a client</Link></div></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="text-2xl font-bold sm:text-[28px]">Good day, {me.name.split(" ")[0]}</h1></div>
        {can(me, "campaign.write") && <Link to="/campaigns?new=1" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-navy-900 px-3.5 py-2 text-sm font-medium text-white"><Plus size={16} /> New campaign</Link>}
      </div>

      <div className="grid auto-rows-min gap-4 md:grid-cols-4 xl:grid-cols-6">
        <Card hero className="md:col-span-4 xl:col-span-3 xl:row-span-2">
          <p className="text-sm text-white/70">Revenue from recorded sales</p>
          <p className="font-display mt-1 text-5xl font-bold">{money(k.revenue)}</p>
          <p className="mt-2 text-sm text-white/75">{k.sales} sales across {camps.length} campaigns</p>
          <div className="relative z-10 mt-6 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-white/60">Calls</p><p className="text-xl font-semibold">{k.attempts}</p></div>
            <div><p className="text-white/60">Contact rate</p><p className="text-xl font-semibold">{pct(k.contactRate)}</p></div>
            <div><p className="text-white/60">Talk time</p><p className="text-xl font-semibold">{fmtDuration(k.talkSec)}</p></div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4 md:col-span-4 md:grid-cols-4 xl:col-span-3 xl:row-span-2 xl:grid-cols-2">
          <Stat label="Leads" value={k.leads} sub={`${k.converted} converted`} />
          <Stat label="Conversion" value={pct(k.conversion)} sub="Leads converted" tone="green" />
          <Stat label="Overdue follow-ups" value={overdue.length} sub={overdue.length ? "Needs attention" : "All clear"} tone="orange" />
          <Stat label="Integration errors" value={errors.length} sub={errors.length ? "See Integrations" : "None reported"} tone={errors.length ? "orange" : "green"} />

        </div>

        <Card className="md:col-span-4 xl:col-span-3">
          <CardTitle action={<span className="flex items-center gap-3 text-xs text-muted"><i className="inline-block h-2 w-2 rounded-sm bg-blue-100" /> Attempts <i className="inline-block h-2 w-2 rounded-sm bg-blue-600" /> Connected</span>}>Call activity · 14 days</CardTitle>
          <Bars height={190} data={callsByDay(calls).map((d) => ({ label: d.day, a: d.attempts, b: d.connected }))} />
        </Card>

        <Card className="md:col-span-2 xl:col-span-3">
          <CardTitle action={<Link to="/campaigns" className="text-xs font-medium text-blue-600">All <ArrowUpRight className="inline" size={12} /></Link>}>Campaign progress</CardTitle>
          <div className="space-y-3">
            {rows.slice(0, 5).map((r) => (
              <Link key={r.campaign.id} to={`/campaigns/${r.campaign.id}`} className="block">
                <div className="mb-1 flex items-center justify-between text-sm"><span className="truncate font-medium">{r.campaign.name}</span><span className="text-xs text-muted">{r.sales}/{r.campaign.targetSales} sales</span></div>
                <Progress value={r.progress} tone={r.progress > 0.6 ? "green" : "orange"} />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="md:col-span-2 xl:col-span-3">
          <CardTitle>Lead pipeline</CardTitle>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {LEAD_STATUSES.map((s, i) => pipe[s] ? <span key={s} title={`${s}: ${pipe[s]}`} style={{ width: `${(pipe[s] / Math.max(1, leads.length)) * 100}%` }} className={["bg-slate-300", "bg-blue-100", "bg-blue-500", "bg-blue-600", "bg-green-500", "bg-orange-500", "bg-green-600", "bg-slate-400", "bg-red-400"][i]} /> : null)}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">{LEAD_STATUSES.map((s) => <li key={s} className="flex justify-between"><span className="text-muted">{s}</span><b>{pipe[s] ?? 0}</b></li>)}</ul>
        </Card>

        <Card className="md:col-span-2 xl:col-span-2">
          <CardTitle>Top agents</CardTitle>
          {agents.length ? <ul className="space-y-2">{agents.map((a, i) => <li key={a.member.id} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Badge tone={(["orange", "blue", "green", "gray"] as const)[i]}>{i + 1}</Badge>{a.member.name}</span><span className="text-muted">{a.sales} sales · {a.attempts} calls</span></li>)}</ul> : <Empty title="No calls yet" />}
        </Card>

        <Card className="md:col-span-2 xl:col-span-2">
          <CardTitle>Outcomes</CardTitle>
          {calls.length ? <ul className="space-y-1.5 text-sm">{dispositionCounts(calls).slice(0, 5).map(([d, n]) => <li key={d} className="flex items-center gap-2"><span className="w-28 text-muted">{d}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${(n / calls.length) * 100}%` }} /></span><b className="w-8 text-right">{n}</b></li>)}</ul> : <Empty title="No outcomes recorded" />}
        </Card>

        <Card className="md:col-span-4 xl:col-span-2">
          <CardTitle>Needs attention</CardTitle>
          <ul className="space-y-2 text-sm">
            {overdue.slice(0, 3).map((t) => <li key={t.id} className="flex gap-2"><CalendarClock size={16} className="mt-0.5 text-orange-500" /><span>{t.title}<span className="block text-xs text-muted">Due {fmtDateTime(t.dueAt)}</span></span></li>)}
            {errors.slice(0, 2).map((i) => <li key={i.id} className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 text-red-500" />{i.provider} failed its connection test</li>)}
            {db.demo && <li className="flex gap-2"><PhoneCall size={16} className="mt-0.5 text-blue-600" />Calling runs in simulated demo mode.</li>}
            {!overdue.length && !errors.length && !db.demo && <li className="flex gap-2"><TrendingUp size={16} className="mt-0.5 text-green-600" />Nothing needs attention.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
