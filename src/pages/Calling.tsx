import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Badge, Button, Card, CardTitle, Empty, Field, Input, PageHeader, Select, Table, Textarea, useToast } from "../components/ui";
import { actions, callEligibility, useStore } from "../lib/store";
import { visibleLeads } from "../lib/rbac";
import { DISPOSITIONS, type Disposition } from "../lib/types";
import { LiveTwilioAdapter, SimulatedAdapter, type CallState, type TelephonyAdapter } from "../lib/telephony";
import { fmtDateTime, fmtDuration, uid } from "../lib/util";

export default function Calling() {
  const { db, me } = useStore();
  const [sp] = useSearchParams();
  const { run, node, toast } = useToast();
  const adapter = useMemo<TelephonyAdapter>(() => (db.demo ? new SimulatedAdapter() : new LiveTwilioAdapter()), [db.demo]);
  const campaignFilter = sp.get("campaign");
  const queue = visibleLeads(db, me).filter((l) => (!campaignFilter || l.campaignId === campaignFilter) && !["Converted", "Disqualified", "Do Not Contact"].includes(l.status));
  const [sel, setSel] = useState<string | null>(sp.get("lead") ?? queue[0]?.id ?? null);
  const [state, setState] = useState<CallState>("idle");
  const [info, setInfo] = useState("");
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [wrap, setWrap] = useState<{ connected: boolean; secs: number } | null>(null);
  const [f, setF] = useState({ disposition: "No Answer" as Disposition, notes: "", followUp: "", revenue: "" });
  const eventId = useRef(uid());
  const lead = db.leads.find((l) => l.id === sel);
  const contact = db.contacts.find((c) => c.id === lead?.contactId);
  const camp = db.campaigns.find((c) => c.id === lead?.campaignId);
  const elig = lead ? callEligibility(db, lead.id, new Date()) : null;

  useEffect(() => { if (state !== "in-call") return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [state]);
  useEffect(() => () => adapter.hangup(), [adapter]);

  const onState = (s: CallState, i?: string) => { setState(s); if (i) setInfo(i); };
  const dial = async () => {
    if (!lead || !contact || !elig?.ok) return;
    eventId.current = uid(); setSecs(0); setMuted(false); setInfo("");
    await adapter.start(contact.phone, onState);
  };
  const end = () => { adapter.hangup(); setWrap({ connected: state === "in-call", secs }); setF((p) => ({ ...p, disposition: state === "in-call" ? "Interested" : "No Answer" })); setState("ended"); };
  const save = () => {
    if (!lead || !wrap) return;
    const ok = run(() => {
      if (f.disposition === "Callback" && !f.followUp) throw new Error("Pick a follow-up time for a callback.");
      actions.recordCall({ leadId: lead.id, durationSec: wrap.secs, connected: wrap.connected, disposition: f.disposition, notes: f.notes, provider: adapter.id, providerEventId: `${adapter.id}-${eventId.current}`, simulated: !adapter.live, revenue: f.revenue ? Number(f.revenue) : undefined, followUpAt: f.followUp ? new Date(f.followUp).toISOString() : undefined });
    }, "Call saved");
    if (ok) { setWrap(null); setState("idle"); setF({ disposition: "No Answer", notes: "", followUp: "", revenue: "" }); toast("Call saved", "ok"); }
  };

  const busy = state === "connecting" || state === "ringing" || state === "in-call";
  const history = db.calls.filter((c) => (me?.role === "sales_agent" ? c.agentId === me.id : true)).slice(0, 8);
  return (
    <>
      <PageHeader title="Calling Center" sub="Click-to-call with consent, suppression and calling-hour checks." action={adapter.live ? <Badge tone={adapter.configured ? "green" : "red"}>{adapter.configured ? "Live" : "Provider not configured"}</Badge> : <Badge tone="orange">Simulated demo mode</Badge>} />
      {!db.demo && !adapter.configured && (
        <div role="alert" className="mb-4 flex gap-3 rounded-2xl border border-orange-500/40 bg-orange-100 p-4 text-sm"><AlertTriangle className="shrink-0 text-orange-500" size={18} /><p><b>Live calling is disabled.</b> No telephony provider is configured, so no calls can be placed. Add Twilio credentials as backend secrets and set the token endpoint. See <code>docs/INTEGRATIONS.md</code>.</p></div>
      )}
      {db.demo && <div className="mb-4 rounded-2xl border border-orange-500/40 bg-orange-100 p-4 text-sm"><b>Demo mode.</b> Calls are simulated in the browser, no phone is dialled, and every record is flagged “Simulated”.</div>}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="max-h-[72vh] overflow-auto !p-2">
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">Queue ({queue.length})</p>
          {queue.length === 0 ? <Empty title="No callable leads" /> : queue.slice(0, 80).map((l) => { const c = db.contacts.find((x) => x.id === l.contactId); const ok = callEligibility(db, l.id, new Date()).ok; return (
            <button key={l.id} disabled={busy} onClick={() => { setSel(l.id); setWrap(null); setState("idle"); }} className={`focus-ring flex w-full items-center justify-between gap-2 rounded-xl p-3 text-left disabled:opacity-60 ${sel === l.id ? "bg-blue-50" : "hover:bg-canvas"}`}><span className="min-w-0"><b className="block truncate text-sm">{c?.name}</b><span className="text-xs text-muted">{c?.company}</span></span><span className={`h-2 w-2 shrink-0 rounded-full ${ok ? "bg-green-500" : "bg-orange-500"}`} title={ok ? "Callable" : "Blocked by a rule"} /></button>); })}
        </Card>
        <div className="space-y-4">
          {!lead || !contact || !camp ? <Empty title="Select a lead to call" /> : (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{contact.name}</h2><p className="text-sm text-muted">{contact.company} · {camp.name}</p><p className="mt-1 font-mono text-sm">{contact.phone || "No phone"}</p></div>
                <div className="text-right"><p className="font-display text-4xl font-bold tabular-nums">{fmtDuration(secs)}</p><p className="text-xs capitalize text-muted" aria-live="polite">{state === "idle" ? "Ready" : state}</p></div></div>
              {elig && !elig.ok && <p className="rounded-xl bg-orange-100 px-3 py-2 text-sm text-[#9a4d00]">Blocked: {elig.reason}</p>}
              {info && <p role="alert" className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">{info}</p>}
              {camp.script && <p className="rounded-xl bg-canvas p-3 text-sm"><b className="text-xs uppercase tracking-wide text-muted">Script</b><br />{camp.script}</p>}
              <div className="flex flex-wrap gap-2">
                {!busy && state !== "ended" && <Button variant="primary" className="!bg-green-600" disabled={!elig?.ok || (adapter.live && !adapter.configured)} onClick={dial}><Phone size={16} /> {adapter.live ? "Call" : "Simulate call"}</Button>}
                {busy && <><Button variant="danger" onClick={end}><PhoneOff size={16} /> Hang up</Button><Button variant="ghost" onClick={() => { setMuted(!muted); adapter.mute(!muted); }} aria-pressed={muted}>{muted ? <MicOff size={16} /> : <Mic size={16} />} {muted ? "Unmute" : "Mute"}</Button></>}
                {state === "failed" && <Button variant="ghost" onClick={() => setState("idle")}>Dismiss</Button>}
              </div>
              {state === "ended" && wrap && (
                <div className="space-y-3 rounded-2xl border border-line p-4">
                  <p className="text-sm font-medium">Wrap-up · {fmtDuration(wrap.secs)} · {wrap.connected ? "connected" : "not connected"}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Disposition">{(id) => <Select id={id} value={f.disposition} onChange={(e) => setF({ ...f, disposition: e.target.value as Disposition })}>{DISPOSITIONS.map((d) => <option key={d}>{d}</option>)}</Select>}</Field>
                    {f.disposition === "Callback" && <Field label="Follow-up at">{(id) => <Input id={id} type="datetime-local" value={f.followUp} onChange={(e) => setF({ ...f, followUp: e.target.value })} />}</Field>}
                    {f.disposition === "Sale" && <Field label="Sale value (USD)" hint={`Default ${lead.value}`}>{(id) => <Input id={id} type="number" min={0} value={f.revenue} onChange={(e) => setF({ ...f, revenue: e.target.value })} />}</Field>}
                  </div>
                  <Field label="Notes">{(id) => <Textarea id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
                  <Button onClick={save}>Save call</Button>
                </div>
              )}
            </Card>
          )}
          <Card><CardTitle>Recent calls</CardTitle>{history.length ? <Table head={["When", "Lead", "Result", "Length", "Mode"]}>{history.map((c) => <tr key={c.id}><td className="px-3 py-2">{fmtDateTime(c.startedAt)}</td><td className="px-3 py-2">{db.contacts.find((x) => x.id === db.leads.find((l) => l.id === c.leadId)?.contactId)?.name}</td><td className="px-3 py-2">{c.disposition}</td><td className="px-3 py-2">{fmtDuration(c.durationSec)}</td><td className="px-3 py-2">{c.simulated ? <Badge tone="orange">Simulated</Badge> : <Badge tone="green">Live</Badge>}</td></tr>)}</Table> : <p className="text-sm text-muted">No calls yet.</p>}</Card>
        </div>
      </div>
      {node}
    </>
  );
}
