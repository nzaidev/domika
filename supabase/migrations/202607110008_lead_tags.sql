-- Etiquetas (labels) that agents manage and tag onto prospectos/contactos.
-- e.g. AirBNB, Inversionista, Turista, Comprador. Org-scoped, RLS as usual.

create table public.lead_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  color text not null default '#3B82F6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.lead_tag_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  tag_id uuid not null references public.lead_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, lead_id, tag_id)
);

create trigger lead_tags_set_updated_at
  before update on public.lead_tags
  for each row execute function public.set_updated_at();

create index lead_tags_organization_name_idx
  on public.lead_tags (organization_id, name);
create index lead_tag_assignments_lead_idx
  on public.lead_tag_assignments (organization_id, lead_id);
create index lead_tag_assignments_tag_idx
  on public.lead_tag_assignments (organization_id, tag_id);

alter table public.lead_tags enable row level security;
alter table public.lead_tag_assignments enable row level security;

create policy lead_tags_org_all on public.lead_tags
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));

create policy lead_tag_assignments_org_all on public.lead_tag_assignments
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));
