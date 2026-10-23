import type { Campaign, DB, Lead, Member, Role } from "./types";

export type Cap =
  | "org.manage" | "member.manage" | "vertical.write" | "client.write" | "campaign.write" | "lead.write" | "lead.assign"
  | "call.place" | "integration.manage" | "asset.write" | "doc.write" | "report.run" | "report.schedule" | "audit.read"
  | "ai.use" | "inbox.use" | "settings.read";

const ALL: Cap[] = ["org.manage","member.manage","vertical.write","client.write","campaign.write","lead.write","lead.assign","call.place","integration.manage","asset.write","doc.write","report.run","report.schedule","audit.read","ai.use","inbox.use","settings.read"];

export const CAPS: Record<Role, Cap[]> = {
  super_admin: ALL,
  executive: ["report.run","report.schedule","ai.use","audit.read","settings.read"],
  vertical_manager: ["vertical.write","campaign.write","lead.write","lead.assign","asset.write","doc.write","report.run","report.schedule","ai.use","inbox.use"],
  client_manager: ["client.write","campaign.write","lead.write","lead.assign","asset.write","doc.write","report.run","report.schedule","ai.use","inbox.use"],
  campaign_manager: ["campaign.write","lead.write","lead.assign","call.place","asset.write","doc.write","report.run","ai.use","inbox.use"],
  supervisor: ["lead.write","lead.assign","call.place","report.run","ai.use","inbox.use"],
  sales_agent: ["lead.write","call.place","inbox.use","ai.use"],
  marketing_manager: ["asset.write","doc.write","campaign.write","report.run","ai.use","inbox.use","integration.manage"],
  reporting_analyst: ["report.run","report.schedule","ai.use"],
  client_portal: ["report.run"],
};

export const can = (m: Member | undefined, cap: Cap) => !!m && CAPS[m.role].includes(cap);

const wide = (r: Role) => r === "super_admin" || r === "executive" || r === "reporting_analyst" || r === "marketing_manager";

/** Campaigns a member may see. Mirrors the RLS policy in supabase/migrations. */
export function visibleCampaigns(db: DB, m: Member | undefined): Campaign[] {
  if (!m) return [];
  if (wide(m.role)) return db.campaigns;
  if (m.role === "client_portal") return db.campaigns.filter((c) => c.clientId && c.clientId === m.clientId);
  if (m.role === "vertical_manager") return db.campaigns.filter((c) => c.verticalId && m.verticalIds.includes(c.verticalId));
  if (m.role === "client_manager") return db.campaigns.filter((c) => c.clientId && db.clients.find((x) => x.id === c.clientId)?.managerId === m.id);
  return db.campaigns.filter((c) => c.memberIds.includes(m.id));
}

export function visibleLeads(db: DB, m: Member | undefined): Lead[] {
  const ids = new Set(visibleCampaigns(db, m).map((c) => c.id));
  const all = db.leads.filter((l) => ids.has(l.campaignId));
  return m?.role === "sales_agent" ? all.filter((l) => l.assigneeId === m.id || !l.assigneeId) : all;
}

export const canSeeClients = (m?: Member) => !!m && m.role !== "sales_agent" && m.role !== "client_portal";
export const canSeeVerticals = (m?: Member) => !!m && !["sales_agent", "client_portal"].includes(m.role);
export const canSeeCrm = (m?: Member) => !!m && m.role !== "client_portal";
