import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Card, CardTitle, PageHeader, useToast } from "../components/ui";
import { LeadsPanel } from "../components/LeadsPanel";
import { actions, useStore } from "../lib/store";
import { fmtDateTime } from "../lib/util";
import { visibleCampaigns } from "../lib/rbac";

export default function Crm() {
  const [sp] = useSearchParams();
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [tab, setTab] = useState<"leads" | "tasks">("leads");
  const ids = new Set(visibleCampaigns(db, me).map((c) => c.id));
  const tasks = db.tasks.filter((t) => (!t.campaignId || ids.has(t.campaignId)) && (me?.role !== "sales_agent" || t.assigneeId === me.id));
  return (
    <>
      <PageHeader title="CRM & Contacts" sub="Lead pipeline, duplicate-safe contacts, notes and follow-ups." />
      <div className="mb-4 inline-flex rounded-2xl bg-white p-1 ring-1 ring-line">{(["leads", "tasks"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`focus-ring rounded-xl px-4 py-2 text-sm font-medium capitalize ${tab === t ? "bg-navy-900 text-white" : "text-muted"}`}>{t === "leads" ? "Leads & contacts" : `Follow-ups (${tasks.filter((x) => !x.done).length})`}</button>)}</div>
      {tab === "leads" ? <Card><LeadsPanel openId={sp.get("lead")} /></Card> : (
        <Card>
          <CardTitle>Follow-ups and reminders</CardTitle>
          {tasks.length === 0 ? <p className="text-sm text-muted">No follow-ups yet. Create them from a lead or when a call outcome is "Callback".</p> : (
            <ul className="divide-y divide-line">{tasks.map((t) => { const late = !t.done && new Date(t.dueAt) < new Date(); return (
              <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm"><input type="checkbox" aria-label={t.title} checked={t.done} onChange={() => run(() => actions.toggleTask(t.id))} /><span className={t.done ? "text-muted line-through" : ""}>{t.title}</span><span className={`ml-auto text-xs ${late ? "font-semibold text-orange-600" : "text-muted"}`}>{late ? "Overdue · " : ""}{fmtDateTime(t.dueAt)}</span></li>); })}</ul>
          )}
        </Card>
      )}
      {node}
    </>
  );
}
