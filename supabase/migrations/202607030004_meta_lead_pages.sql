-- Meta (Facebook/Instagram) Lead Ads page registry per organization.
-- The leadgen webhook is shared across all tenants; events are routed to an
-- organization by the Facebook page_id that owns the lead form.

create table public.meta_lead_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null unique,
  page_name text,
  access_token text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger meta_lead_pages_set_updated_at
  before update on public.meta_lead_pages
  for each row execute function public.set_updated_at();

create index meta_lead_pages_organization_idx
  on public.meta_lead_pages (organization_id);

alter table public.meta_lead_pages enable row level security;

-- access_token is only ever read server-side via the service-role client;
-- org members may see page metadata, only admins may manage it.
create policy meta_lead_pages_read_org on public.meta_lead_pages
  for select using (public.is_same_org(organization_id));
create policy meta_lead_pages_admin_write on public.meta_lead_pages
  for insert with check (public.is_same_org(organization_id) and public.current_profile_is_admin());
create policy meta_lead_pages_admin_update on public.meta_lead_pages
  for update using (public.is_same_org(organization_id) and public.current_profile_is_admin())
  with check (public.is_same_org(organization_id) and public.current_profile_is_admin());
create policy meta_lead_pages_admin_delete on public.meta_lead_pages
  for delete using (public.is_same_org(organization_id) and public.current_profile_is_admin());
