export interface CatalogItem { provider: string; category: string; setup: string; permissions: string; secrets: string[] }

export const CATEGORIES = ["Communication", "Telephony", "CRM", "Marketing", "Social Media", "Cloud Storage", "Analytics", "Automation", "AI"] as const;

export const INTEGRATION_CATALOG: CatalogItem[] = [
  { provider: "Twilio Voice", category: "Telephony", setup: "Create a Twilio account, a TwiML App, an API key and a verified caller ID.", permissions: "Place and receive calls, status webhooks", secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET", "TWILIO_TWIML_APP_SID", "TWILIO_AUTH_TOKEN (webhook signature)"] },
  { provider: "WhatsApp Business", category: "Communication", setup: "Meta Business verification, WhatsApp Business Platform number and webhook subscription.", permissions: "Send/receive messages via approved templates", secrets: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_APP_SECRET"] },
  { provider: "Zoom", category: "Communication", setup: "Create a Zoom OAuth (or Server-to-Server) app and authorise the account.", permissions: "Meetings, recordings metadata", secrets: ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_ACCOUNT_ID"] },
  { provider: "Business Email (IMAP/Gmail/Microsoft 365)", category: "Communication", setup: "OAuth with Google Workspace or Microsoft 365, or an IMAP/SMTP mailbox.", permissions: "Read/send mail for connected mailboxes", secrets: ["GOOGLE_OAUTH_CLIENT_ID/SECRET or MS_OAUTH_CLIENT_ID/SECRET"] },
  { provider: "Microsoft Teams", category: "Communication", setup: "Register an Azure AD app with Graph permissions.", permissions: "Chat and meeting metadata", secrets: ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"] },
  { provider: "Slack", category: "Communication", setup: "Create a Slack app, install to workspace, enable event subscriptions.", permissions: "Channel messages, notifications", secrets: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"] },
  { provider: "HubSpot", category: "CRM", setup: "Private app or OAuth app with CRM scopes.", permissions: "Contacts, deals sync", secrets: ["HUBSPOT_ACCESS_TOKEN"] },
  { provider: "Salesforce", category: "CRM", setup: "Connected app with OAuth and API access.", permissions: "Leads, opportunities sync", secrets: ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"] },
  { provider: "Website Forms / Lead API", category: "Marketing", setup: "Post leads to the signed lead webhook (Edge Function) from your forms.", permissions: "Create leads in a campaign", secrets: ["LEAD_WEBHOOK_SIGNING_SECRET"] },
  { provider: "Meta (Facebook / Instagram)", category: "Social Media", setup: "Meta app with page access and Lead Ads permission.", permissions: "Page insights, lead ads", secrets: ["META_APP_ID", "META_APP_SECRET"] },
  { provider: "LinkedIn", category: "Social Media", setup: "LinkedIn Marketing/Community Management API approval.", permissions: "Page analytics, lead gen forms", secrets: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] },
  { provider: "Google Drive", category: "Cloud Storage", setup: "Google OAuth client with Drive scope.", permissions: "Read selected folders", secrets: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"] },
  { provider: "Microsoft OneDrive / SharePoint", category: "Cloud Storage", setup: "Azure AD app with Files.Read.", permissions: "Read selected libraries", secrets: ["MS_CLIENT_ID", "MS_CLIENT_SECRET"] },
  { provider: "Google Analytics 4", category: "Analytics", setup: "Service account or OAuth with Analytics Data API.", permissions: "Read reports", secrets: ["GA4_SERVICE_ACCOUNT_JSON"] },
  { provider: "Zapier / Make", category: "Automation", setup: "Create outbound webhooks to the platform's signed endpoints.", permissions: "Trigger and receive events", secrets: ["AUTOMATION_WEBHOOK_SECRET"] },
  { provider: "Claude (Anthropic API)", category: "AI", setup: "Create an API key and store it as a backend secret; the assistant calls it server-side only.", permissions: "Summaries and drafts over authorised data", secrets: ["ANTHROPIC_API_KEY"] },
];
