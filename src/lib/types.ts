export type Role =
  | "super_admin" | "executive" | "vertical_manager" | "client_manager" | "campaign_manager"
  | "supervisor" | "sales_agent" | "marketing_manager" | "reporting_analyst" | "client_portal";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Administrator", executive: "Executive", vertical_manager: "Vertical Manager",
  client_manager: "Client Manager", campaign_manager: "Campaign Manager", supervisor: "Supervisor",
  sales_agent: "Sales Agent", marketing_manager: "Marketing Manager", reporting_analyst: "Reporting Analyst",
  client_portal: "Client Portal User",
};

export interface Base { id: string; organizationId: string; createdAt: string; updatedAt: string; createdBy?: string }
export interface Organization { id: string; name: string; timezone: string; createdAt: string }
export interface Member extends Base { name: string; email: string; role: Role; clientId?: string; verticalIds: string[]; status: "active" | "invited" }
export interface Vertical extends Base { name: string; description: string; color: "blue" | "orange" | "green"; managerId?: string }
export interface Client extends Base { name: string; industry: string; website: string; contactName: string; contactEmail: string; managerId?: string; status: "active" | "paused" | "prospect" }

export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export interface Campaign extends Base {
  name: string; objective: string; status: CampaignStatus;
  ownerType: "vertical" | "client"; verticalId?: string; clientId?: string;
  startDate: string; endDate?: string; targetLeads: number; targetSales: number; leadSource: string;
  callingProvider: string; callWindowStart: string; callWindowEnd: string; script: string; memberIds: string[];
  bulkCallingEnabled: boolean;
}

export const LEAD_STATUSES = ["New", "Assigned", "Attempting Contact", "Contacted", "Qualified", "Callback Required", "Converted", "Disqualified", "Do Not Contact"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Contact extends Base { name: string; email: string; phone: string; company: string; segment: string; tags: string[]; consentCalls: boolean }
export interface Lead extends Base { campaignId: string; contactId: string; status: LeadStatus; assigneeId?: string; source: string; value: number; lastContactAt?: string }
export interface Task extends Base { leadId?: string; campaignId?: string; assigneeId?: string; title: string; dueAt: string; done: boolean }
export interface Note extends Base { leadId?: string; campaignId?: string; clientId?: string; body: string; authorId: string }
export interface Interaction extends Base { leadId: string; campaignId: string; kind: "call" | "message" | "meeting" | "event"; summary: string; at: string; actorId?: string }

export const DISPOSITIONS = ["Interested", "Callback", "Not Interested", "No Answer", "Voicemail", "Wrong Number", "Sale", "Do Not Contact"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];
export interface CallSession extends Base {
  leadId: string; campaignId: string; agentId: string; status: "completed" | "no_answer" | "failed";
  startedAt: string; durationSec: number; connected: boolean; disposition?: Disposition; notes?: string;
  provider: string; providerEventId: string; simulated: boolean; revenue: number;
}
export interface Asset extends Base { url: string; label: string; description: string; category: "website" | "landing_page" | "social" | "form" | "other"; campaignId?: string; clientId?: string; verticalId?: string; intendedUse: string; connection: "registered" | "authenticated" | "operational" }
export interface Integration extends Base { provider: string; category: string; status: "not_connected" | "connected" | "error"; lastSyncAt?: string; errors: { at: string; message: string }[] }
export interface Message extends Base { leadId?: string; campaignId?: string; channel: "whatsapp" | "email" | "zoom" | "teams" | "slack" | "sms"; direction: "in" | "out"; body: string; at: string; actorId?: string }
export interface Doc extends Base { title: string; kind: "script" | "sales_material" | "report" | "recording" | "client_doc"; storage: "local" | "external"; reference: string; campaignId?: string; clientId?: string; verticalId?: string }
export interface Notification extends Base { userId?: string; level: "info" | "warn" | "error" | "success"; title: string; read: boolean }
export interface AuditLog extends Base { actorId: string; action: string; target: string }
export interface ReportRun extends Base { name: string; period: "daily" | "weekly" | "monthly"; campaignId?: string; csv: string; rows: number }
export interface ScheduledReport extends Base { name: string; period: "daily" | "weekly" | "monthly"; timezone: string; recipients: string; campaignId?: string }

export interface DB {
  org: Organization | null;
  demo: boolean;
  members: Member[]; verticals: Vertical[]; clients: Client[]; campaigns: Campaign[]; contacts: Contact[]; leads: Lead[];
  tasks: Task[]; notes: Note[]; interactions: Interaction[]; calls: CallSession[]; assets: Asset[]; integrations: Integration[];
  messages: Message[]; docs: Doc[]; notifications: Notification[]; audit: AuditLog[]; reports: ReportRun[]; schedules: ScheduledReport[];
}
