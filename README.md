# Assorted Group Operations Platform

A multi-tenant operations platform for Assorted Group: **business verticals, external clients, campaigns, CRM, calling, integrations, AI assistant, reporting and documents**, with role-based access.

Built with React, TypeScript, Vite and Tailwind CSS v4. It is a normal code project in this repository (no Lovable, no generated lock-in) and it is ready to move to Supabase.

## Current status (honest summary)

| Area | State |
|---|---|
| Phase 1: org, roles, verticals, clients, campaigns, dashboard | **Working** in the browser, with permission checks in the data layer |
| Phase 2: contacts, leads, assignment, tasks, notes, timeline, URL registry, duplicate detection | **Working** in the browser |
| Phase 3: calling console, dispositions, follow-ups, call history | **Working in simulated demo mode only.** No real call can be placed until Twilio is configured |
| Phase 4: integration hub, documents | Hub UI, setup requirements and truthful connection tests. **No provider is connected** |
| Phase 5: AI + reports | Rule-based assistant (all numbers come from queries), CSV reports, schedule definitions. **No LLM or scheduled delivery yet** |
| Backend | **Schema + RLS written and tested** (`supabase/migrations`). The UI does not talk to Supabase yet |

Until the backend is wired in, data lives in `localStorage`. That is per browser, not shared between users and **not a security boundary**. The security model that matters is the Postgres RLS in `supabase/migrations/0001_core_schema.sql`.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # rule tests (permissions, duplicates, calling rules, URL safety, KPIs)
npm run test:rls     # applies the SQL to a real Postgres (PGlite) and checks tenant isolation
npm run build
```

Open the app and choose **Open demo** (fictional data, every role; switch user from the avatar menu) or **Create workspace** to start empty as Super Administrator.

## Design

Deep blue as the base, orange for emphasis and action, green for success and progress, all used sparingly on a calm neutral canvas. Bento-grid layout, Space Grotesk headings, Inter body, accessible focus states, reduced-motion support, responsive down to phone width.

## Architecture

```
src/lib/types.ts       domain model and roles
src/lib/rbac.ts        capability matrix and per-role campaign/lead visibility (mirrors RLS)
src/lib/store.ts       persisted store; every mutation checks permissions, validates, writes an audit log
src/lib/telephony.ts   provider adapter (LiveTwilioAdapter refuses until configured; SimulatedAdapter is demo-only)
src/lib/assistant.ts   verified-metric answers; recommendations are labelled separately
src/lib/metrics.ts     KPIs from persisted records, de-duplicated by provider event id
src/lib/url.ts         blocks localhost, private ranges, credentials, non-http(s)
supabase/migrations    Postgres schema, constraints, RLS, create_organization()
supabase/tests         RLS isolation test
docs/INTEGRATIONS.md   everything still needed to go live
```

Rules enforced in code: exactly one campaign owner (vertical xor client); duplicate contact detection by email/phone; calls blocked without consent, on Do Not Contact, for inactive campaigns, or outside the calling window; call recording is idempotent per provider event; integration tests never report success without credentials.

## Moving to Supabase

1. Create a Supabase project and run `supabase/migrations/0001_core_schema.sql`.
2. Copy `.env.example` to `.env` and set the URL and anon key.
3. Replace the store's persistence with Supabase queries (the action names map 1:1 to tables) and use Supabase Auth.
4. Build the Edge Functions listed in `docs/INTEGRATIONS.md`.

## Deploy (Vercel)

1. In Vercel choose **Add New → Project** and import `nehalksyed3-glitch/NKS`.
2. Keep the detected settings (Vite, `npm ci`, `npm run build`, output `dist`); they are also set in `vercel.json`. Set the production branch to `main`.
3. Deploy. Every push to `main` redeploys; other branches and pull requests get preview URLs.

The app is a static site with hash routing, so no rewrites are needed. When Supabase is connected, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Project Settings → Environment Variables (public values only).

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and build on every push. This repository previously held the NKS Current brand site; it remains available in git history.
