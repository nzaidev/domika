-- Batch: prospect↔property interest links, property availability toggle,
-- and a Google Maps URL field.

-- 1) Availability on/off. When off, the property is hidden from the network,
-- public link, and demand matching (enforced in app queries).
alter table public.properties
  add column if not exists active boolean not null default true;

-- 2) Optional Google Maps URL (pasted link). Address + lat/lng already exist
-- and drive a keyless embedded map; this is an explicit override.
alter table public.properties
  add column if not exists map_url text;

-- Expose `active` through the owner-safe view so the network feed, public
-- pages, and matching can respect the availability toggle.
--
-- Must DROP + CREATE (not CREATE OR REPLACE): replace can only append columns
-- at the end, and inserting `active` mid-list reads as a column rename.
-- Nothing depends on this view (app reads it via the service-role client),
-- so a drop is safe. Grants/options are re-applied below.
drop view if exists public.properties_network_safe;

create view public.properties_network_safe as
select
  id, organization_id, created_by, assigned_to, title, description,
  property_type, operation, status, price, currency, city, zone,
  latitude, longitude, bedrooms, bathrooms, parking_spaces, area_sqm,
  lot_sqm, amenities, legal_status, video_url, virtual_tour_url,
  active, created_at, updated_at
from public.properties;

alter view public.properties_network_safe set (security_invoker = on);
revoke all on public.properties_network_safe from anon;
revoke all on public.properties_network_safe from authenticated;
grant select on public.properties_network_safe to service_role;

-- 3) Buyer interest: which prospectos are potential buyers of which property.
-- Optional, many-to-many, org-scoped.
create table public.lead_property_interests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, lead_id, property_id)
);

create index lead_property_interests_lead_idx
  on public.lead_property_interests (organization_id, lead_id);
create index lead_property_interests_property_idx
  on public.lead_property_interests (organization_id, property_id);

alter table public.lead_property_interests enable row level security;

create policy lead_property_interests_org_all on public.lead_property_interests
  for all using (public.is_same_org(organization_id))
  with check (public.is_same_org(organization_id));
