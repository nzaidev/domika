-- Domika V1 baseline schema.
-- This migration establishes the multi-tenant/RLS foundation and the
-- Listing Distribution seam used for publishing, promotion, sharing,
-- engagement tracking, and listing-originated lead attribution.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum ('owner', 'admin', 'agent');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.lead_source as enum ('manual', 'whatsapp', 'meta_ads', 'portal', 'referral', 'listing', 'other');
create type public.lead_activity_type as enum ('note', 'call', 'message', 'email', 'stage_change', 'task', 'property', 'document');
create type public.message_channel as enum ('whatsapp', 'instagram', 'messenger');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.property_operation as enum ('sale', 'rent', 'investment');
create type public.property_status as enum ('draft', 'available', 'reserved', 'sold', 'rented', 'archived');
create type public.listing_channel as enum ('domika_network', 'public_link', 'whatsapp_flyer', 'pdf_brochure', 'waiboom_feed', 'external_portal');
create type public.listing_publication_status as enum ('draft', 'pending', 'published', 'failed', 'unpublished');
create type public.listing_engagement_type as enum ('view', 'click', 'share', 'download', 'whatsapp_send', 'lead');
create type public.share_permission as enum ('view', 'view_without_owner', 'full');
create type public.task_type as enum ('call', 'visit', 'document', 'follow_up', 'meeting', 'other');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.document_status as enum ('draft', 'generated', 'sent', 'signed', 'void');
create type public.signature_status as enum ('not_required', 'pending', 'signed', 'declined', 'expired');
create type public.notification_status as enum ('unread', 'read', 'archived');
create type public.email_account_provider as enum ('google', 'microsoft', 'smtp');
create type public.automation_trigger as enum ('stage_change', 'lead_inactivity', 'new_message', 'new_property', 'new_requirement');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'domika_v1',
  max_users integer not null default 100 check (max_users > 0),
  brand_color text not null default '#0B1B3A',
  logo_url text,
  billing_status text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.app_role not null default 'agent',
  full_name text not null,
  phone text,
  avatar_url text,
  locale text not null default 'es',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email citext not null,
  role public.app_role not null default 'agent',
  token text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_unit text not null default 'general',
  name text not null,
  position integer not null,
  color text,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, business_unit, position)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stage_id uuid references public.pipeline_stages (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  source public.lead_source not null default 'manual',
  source_meta jsonb not null default '{}'::jsonb,
  business_unit text not null default 'general',
  desired_property_type text,
  desired_zone text,
  budget_min numeric(14, 2),
  budget_max numeric(14, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pipeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages (id) on delete set null,
  to_stage_id uuid references public.pipeline_stages (id) on delete set null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  activity_type public.lead_activity_type not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.whatsapp_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  channel public.message_channel not null default 'whatsapp',
  external_thread_id text,
  contact_phone text not null,
  contact_name text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, contact_phone)
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  thread_id uuid not null references public.whatsapp_threads (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  external_message_id text,
  direction public.message_direction not null,
  sender_profile_id uuid references public.profiles (id) on delete set null,
  body text,
  media jsonb not null default '[]'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  title text not null,
  description text,
  property_type text not null,
  operation public.property_operation not null,
  status public.property_status not null default 'draft',
  price numeric(14, 2),
  currency text not null default 'USD',
  city text,
  zone text,
  address text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  bedrooms numeric(4, 1),
  bathrooms numeric(4, 1),
  parking_spaces integer,
  area_sqm numeric(12, 2),
  lot_sqm numeric(12, 2),
  amenities jsonb not null default '[]'::jsonb,
  legal_status text,
  owner_name text,
  owner_phone text,
  owner_email text,
  owner_notes text,
  video_url text,
  virtual_tour_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null,
  public_url text,
  media_type text not null default 'image',
  alt_text text,
  position integer not null default 0,
  is_cover boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.listing_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  channel public.listing_channel not null,
  status public.listing_publication_status not null default 'draft',
  public_slug text unique,
  external_id text,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  unpublished_at timestamptz,
  failure_reason text,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, property_id, channel)
);

create table public.listing_engagement_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  listing_publication_id uuid not null references public.listing_publications (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  event_type public.listing_engagement_type not null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  source text,
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.listing_lead_attributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  listing_publication_id uuid not null references public.listing_publications (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, lead_id, listing_publication_id)
);

create table public.property_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  listing_publication_id uuid references public.listing_publications (id) on delete set null,
  shared_by uuid references public.profiles (id) on delete set null,
  shared_with_profile_id uuid references public.profiles (id) on delete cascade,
  shared_with_organization_id uuid references public.organizations (id) on delete cascade,
  permission public.share_permission not null default 'view_without_owner',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (shared_with_profile_id is not null or shared_with_organization_id is not null)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  task_type public.task_type not null default 'follow_up',
  title text not null,
  description text,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'todo',
  due_at timestamptz,
  reminder_channels text[] not null default '{}'::text[],
  auto_generated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brochure_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  layout jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brochures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  template_id uuid references public.brochure_templates (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  output_format text not null default 'pdf',
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  contract_type text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  template_id uuid references public.contract_templates (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  status public.document_status not null default 'draft',
  signature_status public.signature_status not null default 'not_required',
  title text not null,
  variables jsonb not null default '{}'::jsonb,
  storage_path text,
  signature_external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buyer_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  property_type text,
  operation public.property_operation,
  budget_min numeric(14, 2),
  budget_max numeric(14, 2),
  city text,
  zone text,
  bedrooms_min numeric(4, 1),
  area_min_sqm numeric(12, 2),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demand_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  buyer_requirement_id uuid not null references public.buyer_requirements (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  reasons jsonb not null default '[]'::jsonb,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, buyer_requirement_id, property_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  status public.notification_status not null default 'unread',
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider public.email_account_provider not null,
  email text not null,
  encrypted_tokens jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id, provider, email)
);

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  email_account_id uuid references public.email_accounts (id) on delete set null,
  external_message_id text,
  direction text not null,
  subject text,
  body text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sequence_id uuid not null references public.email_sequences (id) on delete cascade,
  position integer not null,
  delay_days integer not null default 0,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sequence_id, position)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  trigger public.automation_trigger not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations for each row execute function public.set_updated_at();
create trigger pipeline_stages_set_updated_at before update on public.pipeline_stages for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger whatsapp_threads_set_updated_at before update on public.whatsapp_threads for each row execute function public.set_updated_at();
create trigger properties_set_updated_at before update on public.properties for each row execute function public.set_updated_at();
create trigger listing_publications_set_updated_at before update on public.listing_publications for each row execute function public.set_updated_at();
create trigger property_shares_set_updated_at before update on public.property_shares for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger brochure_templates_set_updated_at before update on public.brochure_templates for each row execute function public.set_updated_at();
create trigger brochures_set_updated_at before update on public.brochures for each row execute function public.set_updated_at();
create trigger contract_templates_set_updated_at before update on public.contract_templates for each row execute function public.set_updated_at();
create trigger contracts_set_updated_at before update on public.contracts for each row execute function public.set_updated_at();
create trigger buyer_requirements_set_updated_at before update on public.buyer_requirements for each row execute function public.set_updated_at();
create trigger demand_matches_set_updated_at before update on public.demand_matches for each row execute function public.set_updated_at();
create trigger email_accounts_set_updated_at before update on public.email_accounts for each row execute function public.set_updated_at();
create trigger email_sequences_set_updated_at before update on public.email_sequences for each row execute function public.set_updated_at();
create trigger email_sequence_steps_set_updated_at before update on public.email_sequence_steps for each row execute function public.set_updated_at();
create trigger automation_rules_set_updated_at before update on public.automation_rules for each row execute function public.set_updated_at();

create or replace function public.current_clerk_user_id()
returns text
language plpgsql
stable
as $$
declare
  claims jsonb;
begin
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := '{}'::jsonb;
  end;

  return coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(claims ->> 'sub', '')
  );
end;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.clerk_user_id = public.current_clerk_user_id()
    and p.active = true
  limit 1
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.clerk_user_id = public.current_clerk_user_id()
    and p.active = true
  limit 1
$$;

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = public.current_profile_id()
    and p.active = true
  limit 1
$$;

create or replace function public.current_profile_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('owner', 'admin'), false)
$$;

create or replace function public.is_same_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_organization_id = public.current_organization_id()
$$;

create or replace function public.get_public_listing(p_slug text)
returns table (
  listing_id uuid,
  property_id uuid,
  organization_id uuid,
  channel public.listing_channel,
  status public.listing_publication_status,
  public_slug text,
  title text,
  description text,
  property_type text,
  operation public.property_operation,
  price numeric,
  currency text,
  city text,
  zone text,
  latitude numeric,
  longitude numeric,
  bedrooms numeric,
  bathrooms numeric,
  parking_spaces integer,
  area_sqm numeric,
  lot_sqm numeric,
  amenities jsonb,
  video_url text,
  virtual_tour_url text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    lp.id,
    p.id,
    p.organization_id,
    lp.channel,
    lp.status,
    lp.public_slug,
    p.title,
    p.description,
    p.property_type,
    p.operation,
    p.price,
    p.currency,
    p.city,
    p.zone,
    p.latitude,
    p.longitude,
    p.bedrooms,
    p.bathrooms,
    p.parking_spaces,
    p.area_sqm,
    p.lot_sqm,
    p.amenities,
    p.video_url,
    p.virtual_tour_url,
    lp.published_at
  from public.listing_publications lp
  join public.properties p on p.id = lp.property_id
  where lp.public_slug = p_slug
    and lp.status = 'published'
    and lp.channel in ('public_link', 'domika_network', 'waiboom_feed')
  limit 1
$$;

create index profiles_organization_idx on public.profiles (organization_id);
create index invitations_organization_status_idx on public.invitations (organization_id, status);
create index pipeline_stages_organization_business_position_idx on public.pipeline_stages (organization_id, business_unit, position);
create index leads_organization_stage_idx on public.leads (organization_id, stage_id);
create index leads_organization_source_idx on public.leads (organization_id, source);
create index leads_organization_assignee_idx on public.leads (organization_id, assigned_to);
create index pipeline_events_organization_lead_created_idx on public.pipeline_events (organization_id, lead_id, created_at desc);
create index lead_activities_organization_lead_created_idx on public.lead_activities (organization_id, lead_id, created_at desc);
create index whatsapp_threads_organization_lead_idx on public.whatsapp_threads (organization_id, lead_id);
create index whatsapp_messages_organization_thread_sent_idx on public.whatsapp_messages (organization_id, thread_id, sent_at desc);
create index properties_organization_status_type_city_idx on public.properties (organization_id, status, property_type, city);
create index property_media_property_position_idx on public.property_media (property_id, position);
create index listing_publications_organization_channel_status_idx on public.listing_publications (organization_id, channel, status);
create index listing_publications_property_idx on public.listing_publications (property_id);
create index listing_engagement_organization_property_channel_idx on public.listing_engagement_events (organization_id, property_id, listing_publication_id, created_at desc);
create index listing_lead_attributions_organization_lead_idx on public.listing_lead_attributions (organization_id, lead_id);
create index property_shares_organization_property_idx on public.property_shares (organization_id, property_id);
create index property_shares_recipient_org_idx on public.property_shares (shared_with_organization_id);
create index property_shares_recipient_profile_idx on public.property_shares (shared_with_profile_id);
create index tasks_organization_assignee_due_idx on public.tasks (organization_id, assigned_to, due_at);
create index tasks_organization_status_idx on public.tasks (organization_id, status);
create index buyer_requirements_organization_active_idx on public.buyer_requirements (organization_id, active);
create index demand_matches_organization_requirement_score_idx on public.demand_matches (organization_id, buyer_requirement_id, score desc);
create index notifications_profile_status_idx on public.notifications (profile_id, status, created_at desc);
create index email_messages_organization_lead_created_idx on public.email_messages (organization_id, lead_id, created_at desc);
create index audit_log_organization_created_idx on public.audit_log (organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.leads enable row level security;
alter table public.pipeline_events enable row level security;
alter table public.lead_activities enable row level security;
alter table public.whatsapp_threads enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.properties enable row level security;
alter table public.property_media enable row level security;
alter table public.listing_publications enable row level security;
alter table public.listing_engagement_events enable row level security;
alter table public.listing_lead_attributions enable row level security;
alter table public.property_shares enable row level security;
alter table public.tasks enable row level security;
alter table public.brochure_templates enable row level security;
alter table public.brochures enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.buyer_requirements enable row level security;
alter table public.demand_matches enable row level security;
alter table public.notifications enable row level security;
alter table public.email_accounts enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_sequences enable row level security;
alter table public.email_sequence_steps enable row level security;
alter table public.audit_log enable row level security;
alter table public.automation_rules enable row level security;

create policy organizations_read_own on public.organizations
  for select using (public.is_same_org(id));
create policy organizations_insert_authenticated on public.organizations
  for insert to authenticated with check (true);
create policy organizations_update_admin on public.organizations
  for update using (public.is_same_org(id) and public.current_profile_is_admin())
  with check (public.is_same_org(id) and public.current_profile_is_admin());

create policy profiles_read_own_org on public.profiles
  for select using (id = public.current_profile_id() or public.is_same_org(organization_id));
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (clerk_user_id = public.current_clerk_user_id());
create policy profiles_update_self_or_admin on public.profiles
  for update using (id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()))
  with check (id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()));

create policy invitations_org_admin_all on public.invitations
  for all using (public.is_same_org(organization_id) and public.current_profile_is_admin())
  with check (public.is_same_org(organization_id) and public.current_profile_is_admin());

create policy pipeline_stages_org_all on public.pipeline_stages
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy leads_org_all on public.leads
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy pipeline_events_org_all on public.pipeline_events
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy lead_activities_org_all on public.lead_activities
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy whatsapp_threads_org_all on public.whatsapp_threads
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy whatsapp_messages_org_all on public.whatsapp_messages
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy properties_org_all on public.properties
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy property_media_org_all on public.property_media
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy listing_publications_read_org_or_published on public.listing_publications
  for select using (
    public.is_same_org(organization_id)
    or (status = 'published' and channel in ('public_link', 'domika_network', 'waiboom_feed'))
  );
create policy listing_publications_write_own_org on public.listing_publications
  for insert with check (public.is_same_org(organization_id));
create policy listing_publications_update_own_org on public.listing_publications
  for update using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));
create policy listing_publications_delete_own_org on public.listing_publications
  for delete using (public.is_same_org(organization_id));

create policy listing_engagement_events_org_all on public.listing_engagement_events
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy listing_lead_attributions_org_all on public.listing_lead_attributions
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy property_shares_read_owner_or_recipient on public.property_shares
  for select using (
    public.is_same_org(organization_id)
    or shared_with_profile_id = public.current_profile_id()
    or shared_with_organization_id = public.current_organization_id()
  );
create policy property_shares_write_owner_org on public.property_shares
  for insert with check (public.is_same_org(organization_id));
create policy property_shares_update_owner_org on public.property_shares
  for update using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));
create policy property_shares_delete_owner_org on public.property_shares
  for delete using (public.is_same_org(organization_id));

create policy tasks_org_all on public.tasks
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy brochure_templates_org_all on public.brochure_templates
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy brochures_org_all on public.brochures
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy contract_templates_org_all on public.contract_templates
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy contracts_org_all on public.contracts
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy buyer_requirements_org_all on public.buyer_requirements
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy demand_matches_org_all on public.demand_matches
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy notifications_profile_or_admin on public.notifications
  for all using (profile_id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()))
  with check (profile_id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()));

create policy email_accounts_owner_or_admin on public.email_accounts
  for all using (profile_id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()))
  with check (profile_id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()));

create policy email_messages_org_all on public.email_messages
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy email_sequences_org_all on public.email_sequences
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy email_sequence_steps_org_all on public.email_sequence_steps
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy audit_log_read_admin on public.audit_log
  for select using (public.is_same_org(organization_id) and public.current_profile_is_admin());
create policy audit_log_insert_own_org on public.audit_log
  for insert with check (organization_id is null or public.is_same_org(organization_id));

create policy automation_rules_org_admin_all on public.automation_rules
  for all using (public.is_same_org(organization_id) and public.current_profile_is_admin())
  with check (public.is_same_org(organization_id) and public.current_profile_is_admin());

grant execute on function public.get_public_listing(text) to anon, authenticated;
