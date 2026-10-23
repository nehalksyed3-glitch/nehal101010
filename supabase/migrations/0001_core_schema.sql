-- Assorted Group Operations Platform: Phase 1-3 core schema (Postgres / Supabase).
-- Every tenant table carries organization_id; access is derived from membership rows, never from client input.
-- Social, conversations, AI runs, recordings and opportunities arrive in later migrations (see docs/INTEGRATIONS.md).


create type public.app_role as enum (
  'super_admin','executive','vertical_manager','client_manager','campaign_manager',
  'supervisor','sales_agent','marketing_manager','reporting_analyst','client_portal');

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

/* ---------------- organisation and access ---------------- */
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', email text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  client_id uuid,                                  -- required for client_portal
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check (role <> 'client_portal' or client_id is not null));

create table public.business_verticals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, description text not null default '', color text not null default 'blue',
  manager_id uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id), unique (organization_id, name));

create table public.vertical_members (
  vertical_id uuid not null, organization_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  primary key (vertical_id, user_id),
  foreign key (vertical_id, organization_id) references public.business_verticals(id, organization_id) on delete cascade);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, industry text not null default '', website text not null default '',
  contact_name text not null default '', contact_email text not null default '',
  manager_id uuid references auth.users(id),
  status text not null default 'active' check (status in ('active','paused','prospect')),
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id), unique (organization_id, name));

alter table public.organization_members
  add constraint om_client_fk foreign key (client_id, organization_id) references public.clients(id, organization_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id), action text not null, target text not null default '',
  created_at timestamptz not null default now());
create index on public.audit_logs (organization_id, created_at desc);

/* ---------------- campaigns and CRM ---------------- */
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vertical_id uuid, client_id uuid,
  name text not null, objective text not null default '',
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  start_date date not null default current_date, end_date date,
  target_leads int not null default 0 check (target_leads >= 0), target_sales int not null default 0 check (target_sales >= 0),
  lead_source text not null default '', calling_provider text not null default '',
  call_window_start time not null default '09:00', call_window_end time not null default '18:00',
  call_timezone text not null default 'UTC', script text not null default '',
  bulk_calling_enabled boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (vertical_id, organization_id) references public.business_verticals(id, organization_id),
  foreign key (client_id, organization_id) references public.clients(id, organization_id),
  -- exactly one owner type
  constraint campaigns_single_owner check ((vertical_id is not null)::int + (client_id is not null)::int = 1),
  check (call_window_start < call_window_end));
create index on public.campaigns (organization_id, status);

create table public.campaign_members (
  campaign_id uuid not null, organization_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  primary key (campaign_id, user_id),
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete cascade);
create index on public.campaign_members (user_id);

create table public.campaign_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid, client_id uuid, vertical_id uuid,
  url text not null check (url ~* '^https?://'), label text not null, description text not null default '',
  category text not null default 'website' check (category in ('website','landing_page','social','form','other')),
  intended_use text not null default '', connection text not null default 'registered' check (connection in ('registered','authenticated','operational')),
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete cascade,
  foreign key (client_id, organization_id) references public.clients(id, organization_id) on delete cascade,
  foreign key (vertical_id, organization_id) references public.business_verticals(id, organization_id) on delete cascade);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, email text not null default '', phone_e164 text not null default '', company text not null default '',
  segment text not null default '', tags text[] not null default '{}',
  consent_calls boolean not null default false, consent_recorded_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (email <> '' or phone_e164 <> ''));
create unique index contacts_email_uq on public.contacts (organization_id, lower(email)) where email <> '' and deleted_at is null;
create unique index contacts_phone_uq on public.contacts (organization_id, phone_e164) where phone_e164 <> '' and deleted_at is null;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null, contact_id uuid not null,
  status text not null default 'New' check (status in ('New','Assigned','Attempting Contact','Contacted','Qualified','Callback Required','Converted','Disqualified','Do Not Contact')),
  assignee_id uuid references auth.users(id), source text not null default 'Manual', value numeric(12,2) not null default 0,
  last_contact_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id), unique (campaign_id, contact_id),
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete cascade,
  foreign key (contact_id, organization_id) references public.contacts(id, organization_id));
create index on public.leads (organization_id, campaign_id, status);
create index on public.leads (assignee_id);

create table public.lead_assignments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null, assignee_id uuid references auth.users(id), assigned_by uuid references auth.users(id), created_at timestamptz not null default now(),
  foreign key (lead_id, organization_id) references public.leads(id, organization_id) on delete cascade);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid, campaign_id uuid, assignee_id uuid references auth.users(id), title text not null, due_at timestamptz not null, done boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (lead_id, organization_id) references public.leads(id, organization_id) on delete cascade,
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete cascade);
create index on public.tasks (assignee_id, done, due_at);

create table public.notes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid, campaign_id uuid, client_id uuid, body text not null, author_id uuid references auth.users(id), created_at timestamptz not null default now(),
  foreign key (lead_id, organization_id) references public.leads(id, organization_id) on delete cascade,
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete cascade,
  foreign key (client_id, organization_id) references public.clients(id, organization_id) on delete cascade);

create table public.interactions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null, campaign_id uuid not null, kind text not null check (kind in ('call','message','meeting','event')),
  summary text not null default '', occurred_at timestamptz not null default now(), actor_id uuid references auth.users(id),
  foreign key (lead_id, organization_id) references public.leads(id, organization_id) on delete cascade,
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete cascade);
create index on public.interactions (lead_id, occurred_at desc);

/* ---------------- calling ---------------- */
create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid, e164 text not null, provider text not null, provider_ref text not null default '',
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete set null (campaign_id),
  unique (organization_id, e164));

create table public.calling_queues (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null, name text not null, settings jsonb not null default '{}',
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete cascade);

create table public.call_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null, lead_id uuid not null, agent_id uuid not null references auth.users(id),
  provider text not null, provider_call_sid text,                      -- null until the provider assigns one
  status text not null default 'initiated' check (status in ('initiated','ringing','in_progress','completed','no_answer','busy','failed','canceled')),
  connected boolean not null default false, started_at timestamptz not null default now(), ended_at timestamptz, duration_sec int not null default 0,
  disposition text check (disposition in ('Interested','Callback','Not Interested','No Answer','Voicemail','Wrong Number','Sale','Do Not Contact')),
  notes text, revenue numeric(12,2) not null default 0, simulated boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id),
  foreign key (lead_id, organization_id) references public.leads(id, organization_id),
  unique (provider, provider_call_sid));
create index on public.call_sessions (organization_id, campaign_id, started_at desc);

-- Append-only provider events; unique provider_event_id makes webhook processing idempotent.
create table public.call_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  provider_event_id text not null unique, event_type text not null, payload jsonb not null default '{}', occurred_at timestamptz not null default now());

create table public.call_dispositions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null, maps_to_status text not null, unique (organization_id, label));

create table public.agent_presence (
  organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('available','busy','offline','wrap_up')), updated_at timestamptz not null default now(),
  primary key (organization_id, user_id));

/* ---------------- integrations, documents, reporting ---------------- */
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null, category text not null,
  status text not null default 'not_connected' check (status in ('not_connected','connected','error')),
  secret_ref text,                                    -- pointer into Supabase Vault; NEVER the secret itself
  last_sync_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, provider));

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null, provider_event_id text not null, signature_valid boolean not null,
  payload jsonb not null, processed_at timestamptz, error text, received_at timestamptz not null default now(),
  unique (provider, provider_event_id));

create table public.documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid, client_id uuid, vertical_id uuid, title text not null,
  kind text not null check (kind in ('script','sales_material','report','recording','client_doc')),
  storage text not null check (storage in ('local','external')), reference text not null,
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(),
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id) on delete cascade);

create table public.report_definitions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, period text not null check (period in ('daily','weekly','monthly')), timezone text not null default 'UTC',
  recipients text[] not null default '{}', campaign_id uuid, created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now());

create table public.report_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  definition_id uuid references public.report_definitions(id) on delete set null, period_start date not null, period_end date not null,
  storage_path text, row_count int not null default 0, created_at timestamptz not null default now(),
  unique (definition_id, period_start, period_end));         -- prevents duplicate scheduled reports

create table public.notifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id), level text not null default 'info', title text not null, read boolean not null default false, created_at timestamptz not null default now());

/* updated_at triggers */
do $$ declare t text; begin
  foreach t in array array['organizations','profiles','organization_members','business_verticals','clients','campaigns','campaign_assets','contacts','leads','tasks','call_sessions','integration_connections'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop; end $$;

/* ---------------- authorisation helpers (security definer; fixed search_path) ---------------- */
create schema if not exists private;

create or replace function private.org_role(org uuid) returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.organization_members where organization_id = org and user_id = auth.uid() and status = 'active' $$;

create or replace function private.is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$ select private.org_role(org) is not null $$;

create or replace function private.has_role(org uuid, roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(private.org_role(org) = any(roles), false) $$;

-- Mirrors visibleCampaigns() in src/lib/rbac.ts. Row-based so it also works for the row being inserted (INSERT ... RETURNING).
create or replace function private.campaign_visible(org uuid, vid uuid, clid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid() and m.status = 'active' and (
      m.role in ('super_admin','executive','reporting_analyst','marketing_manager')
      or (m.role = 'client_portal' and clid is not null and clid = m.client_id)
      or (m.role = 'vertical_manager' and vid in (select vertical_id from public.vertical_members where user_id = auth.uid()))
      or (m.role = 'client_manager' and clid in (select id from public.clients where manager_id = auth.uid()))
      or exists (select 1 from public.campaign_members cm where cm.campaign_id = cid and cm.user_id = auth.uid()))) $$;

create or replace function private.can_see_campaign(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campaigns c where c.id = cid and private.campaign_visible(c.organization_id, c.vertical_id, c.client_id, c.id)) $$;

create or replace function private.can_manage_campaign(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campaigns c where c.id = cid and private.has_role(c.organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','marketing_manager']::public.app_role[]) and private.can_see_campaign(c.id)) $$;

/* ---------------- Row-Level Security ---------------- */
do $$ declare t text; begin
  foreach t in array array['organizations','profiles','organization_members','business_verticals','vertical_members','clients','audit_logs','campaigns','campaign_members','campaign_assets','contacts','leads','lead_assignments','tasks','notes','interactions','phone_numbers','calling_queues','call_sessions','call_events','call_dispositions','agent_presence','integration_connections','webhook_events','documents','report_definitions','report_runs','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop; end $$;

create policy org_read on public.organizations for select using (private.is_member(id));
create policy org_admin on public.organizations for update using (private.has_role(id, array['super_admin']::public.app_role[]));
create policy profile_self on public.profiles for select using (id = auth.uid());
create policy profile_self_upd on public.profiles for update using (id = auth.uid());

create policy om_read on public.organization_members for select using (private.is_member(organization_id));
create policy om_admin on public.organization_members for all using (private.has_role(organization_id, array['super_admin']::public.app_role[])) with check (private.has_role(organization_id, array['super_admin']::public.app_role[]));

create policy v_read on public.business_verticals for select using (private.is_member(organization_id) and private.org_role(organization_id) not in ('sales_agent','client_portal'));
create policy v_write on public.business_verticals for all using (private.has_role(organization_id, array['super_admin','vertical_manager']::public.app_role[])) with check (private.has_role(organization_id, array['super_admin','vertical_manager']::public.app_role[]));
create policy vm_read on public.vertical_members for select using (private.is_member(organization_id));
create policy vm_admin on public.vertical_members for all using (private.has_role(organization_id, array['super_admin']::public.app_role[])) with check (private.has_role(organization_id, array['super_admin']::public.app_role[]));

create policy c_read on public.clients for select using (
  private.is_member(organization_id) and (private.org_role(organization_id) not in ('sales_agent','client_portal') or id = (select client_id from public.organization_members where organization_id = clients.organization_id and user_id = auth.uid())));
create policy c_write on public.clients for all using (private.has_role(organization_id, array['super_admin','client_manager']::public.app_role[])) with check (private.has_role(organization_id, array['super_admin','client_manager']::public.app_role[]));

create policy audit_read on public.audit_logs for select using (private.has_role(organization_id, array['super_admin','executive']::public.app_role[]));
create policy audit_insert on public.audit_logs for insert with check (private.is_member(organization_id) and actor_id = auth.uid());

create policy camp_read on public.campaigns for select using (private.campaign_visible(organization_id, vertical_id, client_id, id));
create policy camp_insert on public.campaigns for insert with check (private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','marketing_manager']::public.app_role[]));
create policy camp_update on public.campaigns for update using (private.can_manage_campaign(id)) with check (private.can_manage_campaign(id));
create policy cm_read on public.campaign_members for select using (private.can_see_campaign(campaign_id));
create policy cm_write on public.campaign_members for all using (private.can_manage_campaign(campaign_id)) with check (private.can_manage_campaign(campaign_id));

create policy ca_read on public.campaign_assets for select using (private.is_member(organization_id) and (campaign_id is null and private.org_role(organization_id) <> 'client_portal' or private.can_see_campaign(campaign_id)));
create policy ca_write on public.campaign_assets for all using (private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','marketing_manager']::public.app_role[])) with check (private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','marketing_manager']::public.app_role[]));

-- Contacts are visible when the user can see at least one campaign lead for them.
create policy ct_read on public.contacts for select using (created_by = auth.uid() or exists (select 1 from public.leads l where l.contact_id = contacts.id and private.can_see_campaign(l.campaign_id)) or private.has_role(organization_id, array['super_admin']::public.app_role[]));
create policy ct_write on public.contacts for all using (private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','supervisor','sales_agent']::public.app_role[])) with check (private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','supervisor','sales_agent']::public.app_role[]));

create policy l_read on public.leads for select using (private.can_see_campaign(campaign_id) and (private.org_role(organization_id) <> 'sales_agent' or assignee_id = auth.uid() or assignee_id is null) and private.org_role(organization_id) <> 'client_portal');
create policy l_write on public.leads for all using (private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','supervisor','sales_agent']::public.app_role[]) and private.can_see_campaign(campaign_id)) with check (private.can_see_campaign(campaign_id));
create policy la_read on public.lead_assignments for select using (private.is_member(organization_id));
create policy la_ins on public.lead_assignments for insert with check (private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','supervisor']::public.app_role[]));

create policy t_all on public.tasks for all using (private.is_member(organization_id) and (assignee_id = auth.uid() or private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','supervisor']::public.app_role[]))) with check (private.is_member(organization_id));
create policy n_read on public.notes for select using (private.org_role(organization_id) <> 'client_portal' and (campaign_id is null or private.can_see_campaign(campaign_id)));
create policy n_ins on public.notes for insert with check (author_id = auth.uid() and private.is_member(organization_id));
create policy i_read on public.interactions for select using (private.org_role(organization_id) <> 'client_portal' and private.can_see_campaign(campaign_id));

create policy pn_read on public.phone_numbers for select using (private.has_role(organization_id, array['super_admin','campaign_manager','supervisor']::public.app_role[]));
create policy cq_read on public.calling_queues for select using (private.can_see_campaign(campaign_id));
-- Call rows are written ONLY by the Edge Function (service role) after it validates consent, hours and assignment.
create policy cs_read on public.call_sessions for select using (private.can_see_campaign(campaign_id) and (private.org_role(organization_id) <> 'sales_agent' or agent_id = auth.uid()) and private.org_role(organization_id) <> 'client_portal');
create policy ce_read on public.call_events for select using (exists (select 1 from public.call_sessions s where s.id = call_session_id and private.can_see_campaign(s.campaign_id)));
create policy cd_read on public.call_dispositions for select using (private.is_member(organization_id));
create policy ap_read on public.agent_presence for select using (private.is_member(organization_id));
create policy ap_self on public.agent_presence for all using (user_id = auth.uid()) with check (user_id = auth.uid() and private.is_member(organization_id));

create policy ic_read on public.integration_connections for select using (private.org_role(organization_id) not in ('client_portal'));
create policy ic_write on public.integration_connections for all using (private.has_role(organization_id, array['super_admin','marketing_manager']::public.app_role[])) with check (private.has_role(organization_id, array['super_admin','marketing_manager']::public.app_role[]));
-- webhook_events: no policies => only the service role can read/write.

create policy d_read on public.documents for select using (private.is_member(organization_id) and (campaign_id is null or private.can_see_campaign(campaign_id)));
create policy d_write on public.documents for all using (private.has_role(organization_id, array['super_admin','vertical_manager','client_manager','campaign_manager','marketing_manager']::public.app_role[])) with check (private.is_member(organization_id));
create policy rd_read on public.report_definitions for select using (private.is_member(organization_id));
create policy rd_write on public.report_definitions for all using (private.has_role(organization_id, array['super_admin','executive','vertical_manager','client_manager','reporting_analyst']::public.app_role[])) with check (private.is_member(organization_id));
create policy rr_read on public.report_runs for select using (private.is_member(organization_id));
create policy nt_self on public.notifications for select using (user_id = auth.uid() or (user_id is null and private.is_member(organization_id)));
create policy nt_upd on public.notifications for update using (user_id = auth.uid());

/* ---------------- bootstrap: create an organisation and become its super_admin ---------------- */
create or replace function public.create_organization(org_name text, tz text default 'UTC') returns uuid
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations(name, timezone) values (org_name, tz) returning id into oid;
  insert into organization_members(organization_id, user_id, role) values (oid, auth.uid(), 'super_admin');
  insert into audit_logs(organization_id, actor_id, action, target) values (oid, auth.uid(), 'organization.created', org_name);
  return oid;
end $$;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
