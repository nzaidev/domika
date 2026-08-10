-- Desired operation (buy / rent / invest) for a lead, captured from the
-- WhatsApp conversation. Kept separate from business_unit so matching and
-- the capture flow have a clean, constrained field. See docs/adr/0001.

alter table public.leads
  add column if not exists desired_operation text;

alter table public.leads
  drop constraint if exists leads_desired_operation_check;

alter table public.leads
  add constraint leads_desired_operation_check
  check (desired_operation is null
    or desired_operation in ('buy', 'rent', 'invest'));
