import { useState } from "react";
import { Badge, Button, Card, Empty, Input, PageHeader, Select, useToast } from "../components/ui";
import { actions, useStore } from "../lib/store";
import { visibleLeads } from "../lib/rbac";
import { fmtDateTime } from "../lib/util";
import type { Message } from "../lib/types";

export default function InboxPage() {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const leads = visibleLeads(db, me);
  const threads = leads.filter((l) => db.messages.some((m) => m.leadId === l.id));
  const [sel, setSel] = useState<string | null>(threads[0]?.id ?? null);
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<Message["channel"]>("email");
  const lead = leads.find((l) => l.id === sel);
  const contact = db.contacts.find((c) => c.id === lead?.contactId);
  const msgs = db.messages.filter((m) => m.leadId === sel).sort((a, b) => a.at.localeCompare(b.at));
  return (
    <>
      <PageHeader title="Unified Inbox" sub="Conversations by lead. Messages are logged records until a channel (WhatsApp, email, Teams, Slack) is connected." />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="max-h-[70vh] overflow-auto !p-2">
          {threads.length === 0 ? <Empty title="No conversations" hint="Log a message from a lead below, or connect a channel." /> : threads.map((l) => { const c = db.contacts.find((x) => x.id === l.contactId); const last = db.messages.filter((m) => m.leadId === l.id).at(-1); return (
            <button key={l.id} onClick={() => setSel(l.id)} className={`focus-ring w-full rounded-xl p-3 text-left ${sel === l.id ? "bg-blue-50" : "hover:bg-canvas"}`}><b className="text-sm">{c?.name}</b><p className="truncate text-xs text-muted">{last?.body}</p></button>); })}
        </Card>
        <Card className="flex min-h-[50vh] flex-col">
          {!lead ? (
            <div className="space-y-3"><Empty title="Select a conversation" /><div className="text-sm"><label className="text-xs font-medium text-muted" htmlFor="start">Start a conversation with a lead</label><Select id="start" value="" onChange={(e) => setSel(e.target.value)}><option value="">Choose lead…</option>{leads.map((l) => <option key={l.id} value={l.id}>{db.contacts.find((c) => c.id === l.contactId)?.name}</option>)}</Select></div></div>
          ) : (<>
            <div className="mb-3 flex items-center justify-between border-b border-line pb-3"><div><b>{contact?.name}</b><p className="text-xs text-muted">{contact?.email || contact?.phone}</p></div><Badge tone="orange">Logged only</Badge></div>
            <ul className="flex-1 space-y-2 overflow-auto">{msgs.length ? msgs.map((m) => <li key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.direction === "out" ? "ml-auto bg-navy-900 text-white" : "bg-canvas"}`}>{m.body}<span className={`mt-1 block text-[11px] ${m.direction === "out" ? "text-white/60" : "text-muted"}`}>{m.channel} · {fmtDateTime(m.at)}</span></li>) : <li className="text-sm text-muted">No messages yet.</li>}</ul>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => { actions.logMessage({ leadId: lead.id, channel, direction: "out", body }); setBody(""); }, "Message logged (not sent)"); }}>
              <Select aria-label="Channel" className="w-32" value={channel} onChange={(e) => setChannel(e.target.value as Message["channel"])}><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></Select>
              <Input aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Log a message…" /><Button type="submit">Log</Button>
            </form>
            <p className="mt-2 text-xs text-muted">Sending requires a connected channel and explicit authorisation. This logs the message to the timeline; nothing is delivered.</p>
          </>)}
        </Card>
      </div>
      {node}
    </>
  );
}
