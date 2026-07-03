-- Switch Domika identity from Supabase Auth UUIDs to Clerk user IDs.
-- Run this after 202606300001_initial_schema.sql in databases that already
-- applied the original Supabase Auth-oriented baseline.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id set default gen_random_uuid();

alter table public.profiles
  add column if not exists clerk_user_id text;

create unique index if not exists profiles_clerk_user_id_unique
  on public.profiles (clerk_user_id)
  where clerk_user_id is not null;

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

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = public.current_profile_id()
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

drop policy if exists profiles_read_own_org on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists property_shares_read_owner_or_recipient on public.property_shares;
drop policy if exists notifications_profile_or_admin on public.notifications;
drop policy if exists email_accounts_owner_or_admin on public.email_accounts;

create policy profiles_read_own_org on public.profiles
  for select using (id = public.current_profile_id() or public.is_same_org(organization_id));

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (clerk_user_id = public.current_clerk_user_id());

create policy profiles_update_self_or_admin on public.profiles
  for update using (id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()))
  with check (id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()));

create policy property_shares_read_owner_or_recipient on public.property_shares
  for select using (
    public.is_same_org(organization_id)
    or shared_with_profile_id = public.current_profile_id()
    or shared_with_organization_id = public.current_organization_id()
  );

create policy notifications_profile_or_admin on public.notifications
  for all using (profile_id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()))
  with check (profile_id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()));

create policy email_accounts_owner_or_admin on public.email_accounts
  for all using (profile_id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()))
  with check (profile_id = public.current_profile_id() or (public.is_same_org(organization_id) and public.current_profile_is_admin()));

