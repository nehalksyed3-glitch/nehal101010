import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Badge, Button, Card, Input, PageHeader, Table } from "../components/ui";
import { useStore } from "../lib/store";
import { ask, type Answer } from "../lib/assistant";

const PROMPTS = ["Which campaigns generated the most sales this week?", "Show my team's call activity yesterday", "Which campaigns have declining conversion?", "Summarize common objections from campaign notes", "Generate the management summary"];

export default function Assistant() {
  const { db, me } = useStore();
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: Answer }[]>([]);
  if (!me) return null;
  const go = (text: string) => { if (!text.trim()) return; setLog((l) => [{ q: text, a: ask(db, me, text) }, ...l]); setQ(""); };
  return (
    <>
      <PageHeader title="AI Assistant" sub="Answers use only data you are authorised to see. Totals come from database queries, never from a model's guess." />
      <Card className="mb-4"><form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(q); }}><Input aria-label="Ask a question" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about campaigns, calls, teams…" /><Button type="submit"><Send size={16} /> Ask</Button></form>
        <div className="mt-3 flex flex-wrap gap-2">{PROMPTS.map((p) => <button key={p} onClick={() => go(p)} className="focus-ring rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-blue-100">{p}</button>)}</div></Card>
      <p className="mb-3 text-xs text-muted">Current mode: rule-based analysis of your data. Connect <code>ANTHROPIC_API_KEY</code> in a backend function to add narrative drafting; the assistant will never send messages or place calls without your explicit approval.</p>
      <div className="space-y-4">
        {log.map((r, i) => (
          <Card key={i}><p className="mb-2 flex items-center gap-2 text-sm text-muted"><Bot size={15} className="text-orange-500" />{r.q}</p><h3 className="text-lg font-semibold">{r.a.title}</h3>
            <div className="mt-2"><Badge tone="green">Verified metrics</Badge><ul className="mt-1 list-disc pl-5 text-sm">{r.a.verified.map((v, k) => <li key={k}>{v}</li>)}</ul></div>
            {r.a.table && <div className="mt-3"><Table head={r.a.table.head}>{r.a.table.rows.map((row, k) => <tr key={k}>{row.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}</Table></div>}
            {r.a.recommendations.length > 0 && <div className="mt-3"><Badge tone="orange">Recommendations</Badge><ul className="mt-1 list-disc pl-5 text-sm">{r.a.recommendations.map((v, k) => <li key={k}>{v}</li>)}</ul></div>}
          </Card>
        ))}
      </div>
    </>
  );
}
