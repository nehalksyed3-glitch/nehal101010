# Outstanding work and activation requirements

Nothing below is connected today. The app never shows a provider as connected unless a real check succeeded.

## 1. Backend wiring (required before multi-user use)
- Apply `supabase/migrations/0001_core_schema.sql`; enable email/password or SSO in Supabase Auth.
- Replace browser persistence in `src/lib/store.ts` with Supabase calls. RLS already enforces isolation.
- Not yet in SQL (later migrations): `social_accounts`, `conversation_threads`, `messages`, `sync_jobs`, `ai_runs`, `ai_insights`, `sales_opportunities`, `call_recordings`, `telephony_providers`, and a private storage bucket for reports and recordings.
- Member invitations: use Supabase Auth invite from an Edge Function (the UI only records the invite today).

## 2. Edge Functions to build
| Function | Purpose |
|---|---|
| `calling-token` | Authenticate caller, verify campaign membership, consent, calling window and destination, then issue a short-lived Twilio Voice token |
| `twilio-webhook` | Verify `X-Twilio-Signature`, write `webhook_events` (unique provider event id) and `call_events`, update `call_sessions` |
| `lead-webhook` | Signed endpoint for website forms / Meta lead ads; validate, de-duplicate, create contact + lead |
| `ai-assistant` | Run authorised SQL for numbers, then (optionally) call Claude for narrative only |
| `run-scheduled-reports` | Cron: build CSV/PDF from persisted data, store privately, insert `report_runs` (unique per period) |
| `integration-test` | Real provider health checks that update `integration_connections` |

All privileged functions use the service role, so each one must authenticate the user and re-check organization, campaign and role before acting.

## 3. Credentials per integration
Store as Supabase secrets (or Vault), never in the frontend or normal tables.

| Integration | Needed |
|---|---|
| Twilio Voice | `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID`, `TWILIO_AUTH_TOKEN` (signature check), a verified caller ID, bundle `@twilio/voice-sdk`, set `window.__AG_TELEPHONY__.tokenEndpoint` |
| WhatsApp Business | Meta Business verification, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, approved templates |
| Zoom | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID` |
| Email / Teams / Slack | Google or Microsoft OAuth app; `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` |
| CRM (HubSpot, Salesforce) | Private app token / connected app |
| Social (Meta, LinkedIn) | App review and OAuth; URL registration works without it |
| Cloud storage | Google / Microsoft OAuth with read scopes |
| AI | `ANTHROPIC_API_KEY` (server-side only) |

The full list with setup notes is shown in-app under **Integrations**.

## 4. Compliance before real calling
- Confirm consent capture, suppression/Do-Not-Call list checks and jurisdiction calling hours (the app checks consent, DNC status and a per-campaign window; timezone-of-recipient rules still need a policy).
- Recording only when configured, legally permitted and approved.
- Define retention and deletion policy for recordings, transcripts and personal data.
- Bulk/auto-dialling stays off (`bulk_calling_enabled=false`) until explicitly authorised per campaign.

## 5. Hardening checklist
Rate limiting on sensitive endpoints, backup/restore drill, audit-log retention, penetration test of RLS with real Supabase roles, accessibility audit, load test on report queries.
