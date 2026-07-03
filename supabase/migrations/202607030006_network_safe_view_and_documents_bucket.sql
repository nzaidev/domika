-- 1) Structural PII guarantee for cross-org reads.
--
-- Cross-org code paths (Domika network feed, network listing detail,
-- non-"full" shares) must read through this view instead of the properties
-- table. It physically excludes owner_* and address, so no query through it
-- can leak owner PII regardless of application-code mistakes. Only a "full"
-- permission share may read owner fields, via an explicit separate query.

create or replace view public.properties_network_safe as
select
  id,
  organization_id,
  created_by,
  assigned_to,
  title,
  description,
  property_type,
  operation,
  status,
  price,
  currency,
  city,
  zone,
  latitude,
  longitude,
  bedrooms,
  bathrooms,
  parking_spaces,
  area_sqm,
  lot_sqm,
  amenities,
  legal_status,
  video_url,
  virtual_tour_url,
  created_at,
  updated_at
from public.properties;

-- Not granted to anon: the network is for signed-in agents only.
grant select on public.properties_network_safe to authenticated, service_role;

-- 2) Private bucket for non-marketing documents (contracts, signed PDFs,
-- property document attachments). Unlike property-media, this bucket is NOT
-- public: files are served via short-lived signed URLs from the server.
-- Phase 3 (contracts/documents) must use this bucket, never property-media.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = excluded.public;
