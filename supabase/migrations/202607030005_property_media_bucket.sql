-- Storage bucket for property photos/documents (plan §3: single bucket,
-- org-prefixed paths "{organization_id}/{property_id}/{file}").
-- Public read: listing photos are marketing collateral; owner PII lives in
-- table columns, never in media. All writes go through the service-role
-- client in route handlers, so no INSERT/UPDATE/DELETE policies are granted
-- to authenticated users.

insert into storage.buckets (id, name, public)
values ('property-media', 'property-media', true)
on conflict (id) do update set public = excluded.public;
