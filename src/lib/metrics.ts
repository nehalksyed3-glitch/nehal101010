import type { CallSession, DB, Lead } from "./types";

export interface Kpis { attempts: number; connected: number; talkSec: number; sales: number; revenue: number; leads: number; converted: number; contactRate: number; conversion: number }

/** All figures are computed from persisted calls/leads; calls are de-duplicated by provider event id. */
export function kpis(calls: CallSession[], leads: Lead[]): Kpis {
  const seen = new Set<string>();
  const uniq = calls.filter((c) => (seen.has(c.providerEventId) ? false : (seen.add(c.providerEventId), true)));
  const connected = uniq.filter((c) => c.connected);
  const sales = uniq.filter((c) => c.disposition === "Sale");
  const converted = leads.filter((l) => l.status === "Converted").length;
  return {
    attempts: uniq.length, connected: connected.length, talkSec: connected.reduce((s, c) => s + c.durationSec, 0),
    sales: sales.length, revenue: sales.reduce((s, c) => s + c.revenue, 0), leads: leads.length, converted,
    contactRate: uniq.length ? connected.length / uniq.length : 0, conversion: leads.length ? converted / leads.length : 0,
  };
}

export const dayKey = (iso: string) => iso.slice(0, 10);
export function lastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d.toISOString().slice(0, 10); });
}
export function callsByDay(calls: CallSession[], n = 14) {
  const days = lastDays(n);
  return days.map((d) => ({ day: d, attempts: calls.filter((c) => dayKey(c.startedAt) === d).length, connected: calls.filter((c) => dayKey(c.startedAt) === d && c.connected).length }));
}

export function campaignRows(db: DB, campaignIds?: string[]) {
  return db.campaigns.filter((c) => !campaignIds || campaignIds.includes(c.id)).map((c) => {
    const leads = db.leads.filter((l) => l.campaignId === c.id);
    const k = kpis(db.calls.filter((x) => x.campaignId === c.id), leads);
    return { campaign: c, ...k, progress: c.targetSales ? Math.min(1, k.sales / c.targetSales) : 0 };
  });
}

export function agentRows(db: DB, campaignIds: string[]) {
  const ids = new Set(campaignIds);
  return db.members.map((m) => {
    const calls = db.calls.filter((c) => c.agentId === m.id && ids.has(c.campaignId));
    return { member: m, ...kpis(calls, []) };
  }).filter((r) => r.attempts > 0).sort((a, b) => b.sales - a.sales || b.connected - a.connected);
}

export function pipelineCounts(leads: Lead[]) {
  const out: Record<string, number> = {};
  leads.forEach((l) => { out[l.status] = (out[l.status] ?? 0) + 1; });
  return out;
}

export function dispositionCounts(calls: CallSession[]) {
  const out: Record<string, number> = {};
  calls.forEach((c) => { if (c.disposition) out[c.disposition] = (out[c.disposition] ?? 0) + 1; });
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}
