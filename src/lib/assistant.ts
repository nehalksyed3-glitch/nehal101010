import { agentRows, campaignRows, dispositionCounts, kpis, lastDays, dayKey } from "./metrics";
import { visibleCampaigns, visibleLeads } from "./rbac";
import type { DB, Member } from "./types";
import { fmtDuration, money, pct } from "./util";

export interface Answer { title: string; verified: string[]; recommendations: string[]; table?: { head: string[]; rows: (string | number)[][] } }

/**
 * Deterministic assistant: every number comes from a database query over data the member is authorised to see.
 * A server-side LLM (ANTHROPIC_API_KEY, Edge Function) can be layered on top for prose only; it never produces totals.
 */
export function ask(db: DB, me: Member, q: string): Answer {
  const text = q.toLowerCase();
  const camps = visibleCampaigns(db, me);
  const ids = camps.map((c) => c.id);
  const calls = db.calls.filter((c) => ids.includes(c.campaignId));
  const leads = visibleLeads(db, me);
  const rows = campaignRows(db, ids);
  if (!camps.length) return { title: "No data in scope", verified: ["You have no campaigns in your scope yet."], recommendations: ["Ask an administrator to add you to a campaign."] };

  if (/(most|top|best).*(sale|revenue)|sales this week|generated the most/.test(text)) {
    const wk = new Set(lastDays(7));
    const wkRows = camps.map((c) => ({ c, k: kpis(calls.filter((x) => x.campaignId === c.id && wk.has(dayKey(x.startedAt))), []) })).sort((a, b) => b.k.sales - a.k.sales);
    return {
      title: "Sales by campaign, last 7 days",
      verified: [`${wkRows.reduce((s, r) => s + r.k.sales, 0)} sales and ${money(wkRows.reduce((s, r) => s + r.k.revenue, 0))} revenue across ${camps.length} campaigns.`],
      table: { head: ["Campaign", "Sales", "Revenue", "Calls"], rows: wkRows.map((r) => [r.c.name, r.k.sales, money(r.k.revenue), r.k.attempts]) },
      recommendations: wkRows[0]?.k.sales ? [`${wkRows[0].c.name} leads; review its script and staffing for lessons to reuse.`] : ["No sales were recorded this week."],
    };
  }
  if (/team|agent|yesterday|activity/.test(text)) {
    const y = lastDays(2)[0];
    const dayCalls = calls.filter((c) => dayKey(c.startedAt) === y);
    const by = agentRows({ ...db, calls: dayCalls }, ids);
    return {
      title: "Call activity yesterday",
      verified: [`${dayCalls.length} calls, ${dayCalls.filter((c) => c.connected).length} connected.`],
      table: { head: ["Agent", "Calls", "Connected", "Talk time", "Sales"], rows: by.map((r) => [r.member.name, r.attempts, r.connected, fmtDuration(r.talkSec), r.sales]) },
      recommendations: by.length ? [] : ["No call activity recorded yesterday."],
    };
  }
  if (/declin|conversion|convert/.test(text)) {
    const half = (from: number, to: number) => { const d = new Set(lastDays(to).slice(0, to - from)); return d; };
    const prev = half(7, 14), cur = new Set(lastDays(7));
    const t = camps.map((c) => {
      const a = kpis(calls.filter((x) => x.campaignId === c.id && prev.has(dayKey(x.startedAt))), []);
      const b = kpis(calls.filter((x) => x.campaignId === c.id && cur.has(dayKey(x.startedAt))), []);
      const ra = a.attempts ? a.sales / a.attempts : 0, rb = b.attempts ? b.sales / b.attempts : 0;
      return { c, ra, rb };
    });
    const declining = t.filter((x) => x.rb < x.ra);
    return {
      title: "Call-to-sale rate: this week vs previous week",
      verified: [`${declining.length} of ${t.length} campaigns declined.`],
      table: { head: ["Campaign", "Previous 7d", "Last 7d", "Trend"], rows: t.map((x) => [x.c.name, pct(x.ra), pct(x.rb), x.rb < x.ra ? "▼ declining" : x.rb > x.ra ? "▲ improving" : "flat"]) },
      recommendations: declining.map((x) => `Review ${x.c.name}: sales per call fell from ${pct(x.ra)} to ${pct(x.rb)}.`),
    };
  }
  if (/objection|note/.test(text)) {
    const notes = db.notes.filter((n) => n.campaignId && ids.includes(n.campaignId));
    const words: Record<string, number> = {};
    notes.forEach((n) => n.body.toLowerCase().match(/price|cost|budget|timing|competitor|contract|trust|busy|already/g)?.forEach((w) => (words[w] = (words[w] ?? 0) + 1)));
    const top = Object.entries(words).sort((a, b) => b[1] - a[1]);
    return { title: "Common objection keywords in authorised notes", verified: [`${notes.length} notes scanned.`], table: top.length ? { head: ["Keyword", "Mentions"], rows: top } : undefined, recommendations: top.length ? [`"${top[0][0]}" appears most; prepare a rebuttal in the call script.`] : ["No objection keywords found yet."] };
  }
  if (/report|month|summary|management/.test(text)) {
    const k = kpis(calls, leads);
    return {
      title: "Management summary (all time, authorised scope)",
      verified: [`${k.attempts} calls, ${k.connected} connected (${pct(k.contactRate)}), ${fmtDuration(k.talkSec)} talk time.`, `${k.leads} leads, ${k.converted} converted (${pct(k.conversion)}).`, `${k.sales} sales, ${money(k.revenue)} revenue.`],
      table: { head: ["Campaign", "Calls", "Sales", "Revenue"], rows: rows.map((r) => [r.campaign.name, r.attempts, r.sales, money(r.revenue)]) },
      recommendations: [`Top dispositions: ${dispositionCounts(calls).slice(0, 3).map(([d, n]) => `${d} (${n})`).join(", ") || "none yet"}.`, "Revenue and ROI are reported only from recorded sales; add campaign costs to enable ROI."],
    };
  }
  return {
    title: "I can answer from your authorised data",
    verified: [`In scope: ${camps.length} campaigns, ${leads.length} leads, ${calls.length} calls.`],
    recommendations: ["Try: “Which campaigns generated the most sales this week?”, “Show my team's call activity yesterday”, “Which campaigns have declining conversion?”, “Summarize common objections”, or “Generate the management summary”."],
  };
}
