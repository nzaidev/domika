-- SECURITY FIX (found by tests/rls-exposure.test.ts):
-- properties_network_safe was readable by the anon role via PostgREST,
-- exposing every org's inventory (title/price/zone/status) to anyone with
-- the public anon key. Two problems: (1) a normal view runs as its owner and
-- bypasses the base table's RLS; (2) default grants exposed it to anon.
--
-- The app only ever reads this view server-side through the service-role
-- client, so it needs no anon/authenticated access at all. Lock it down and
-- make it honor RLS as defense in depth.

alter view public.properties_network_safe set (security_invoker = on);

revoke all on public.properties_network_safe from anon;
revoke all on public.properties_network_safe from authenticated;
revoke all on public.properties_network_safe from public;

grant select on public.properties_network_safe to service_role;
