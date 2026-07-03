-- WhatsApp Business account registry per organization.
-- The Meta Cloud API webhook is shared across all tenants; inbound payloads
-- are routed to an organization by their business phone_number_id.

create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phone_number_id text not null unique,
  display_phone_number text,
  waba_id text,
  access_token text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger whatsapp_accounts_set_updated_at
  before update on public.whatsapp_accounts
  for each row execute function public.set_updated_at();

create index whatsapp_accounts_organization_idx
  on public.whatsapp_accounts (organization_id);

alter table public.whatsapp_accounts enable row level security;

-- access_token is only ever read server-side via the service-role client;
-- org members may see account metadata, only admins may manage it.
create policy whatsapp_accounts_read_org on public.whatsapp_accounts
  for select using (public.is_same_org(organization_id));
create policy whatsapp_accounts_admin_write on public.whatsapp_accounts
  for insert with check (public.is_same_org(organization_id) and public.current_profile_is_admin());
create policy whatsapp_accounts_admin_update on public.whatsapp_accounts
  for update using (public.is_same_org(organization_id) and public.current_profile_is_admin())
  with check (public.is_same_org(organization_id) and public.current_profile_is_admin());
create policy whatsapp_accounts_admin_delete on public.whatsapp_accounts
  for delete using (public.is_same_org(organization_id) and public.current_profile_is_admin());

-- Webhook deliveries can repeat; make message ingestion idempotent.
create unique index whatsapp_messages_external_unique
  on public.whatsapp_messages (organization_id, external_message_id)
  where external_message_id is not null;
