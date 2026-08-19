-- Omnichannel inbox: a messaging account connected through Domika via a
-- provider's embedded signup (Zernio → WhatsApp/Instagram/Messenger).
-- One row per connected number/account; used to route inbound events to an org
-- and to know which channels an org has live. Conversations themselves reuse
-- the existing whatsapp_threads / whatsapp_messages tables (channel-aware).

create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'zernio',
  platform text not null default 'whatsapp'
    check (platform in ('whatsapp', 'instagram', 'messenger')),
  -- Provider-side identifier used to route inbound events to this connection.
  external_account_id text not null,
  display_name text,
  phone text,
  status text not null default 'active'
    check (status in ('active', 'disconnected')),
  connected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_account_id)
);

create index if not exists channel_connections_org_idx
  on public.channel_connections (organization_id, status);

alter table public.channel_connections enable row level security;

create policy channel_connections_org_all on public.channel_connections
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

-- Per-agent inbox isolation: which agent owns a conversation (the agent whose
-- connected channel produced it). NULL = unowned/legacy (visible org-wide).
-- The Conversaciones inbox shows an agent only their own + unowned threads.
alter table public.whatsapp_threads
  add column if not exists owner_profile_id uuid
  references public.profiles (id) on delete set null;

create index if not exists whatsapp_threads_owner_idx
  on public.whatsapp_threads (organization_id, owner_profile_id);
