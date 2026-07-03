-- Domika local seed data.
-- Profiles are intentionally not inserted here because Clerk owns users.
-- Create/sign in with a Clerk user, then attach its Clerk user ID to the demo org.

insert into public.organizations (id, name, slug, plan, max_users, brand_color)
values (
  '00000000-0000-4000-8000-000000000001',
  'SAILE Business Group',
  'saile-demo',
  'domika_v1',
  100,
  '#0B1B3A'
)
on conflict (slug) do update set
  name = excluded.name,
  plan = excluded.plan,
  max_users = excluded.max_users,
  brand_color = excluded.brand_color;

insert into public.pipeline_stages (id, organization_id, business_unit, name, position, color, is_closed)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'general', 'Nuevo', 1, '#3B82F6', false),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'general', 'Contactado', 2, '#6366F1', false),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'general', 'Visito', 3, '#8B5CF6', false),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'general', 'Negociacion', 4, '#EC4899', false),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'general', 'Cierre', 5, '#10B981', true),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'general', 'Perdido', 6, '#EF4444', true)
on conflict (organization_id, business_unit, position) do update set
  name = excluded.name,
  color = excluded.color,
  is_closed = excluded.is_closed;

insert into public.leads (
  id,
  organization_id,
  stage_id,
  full_name,
  phone,
  email,
  source,
  business_unit,
  desired_property_type,
  desired_zone,
  budget_min,
  budget_max
)
values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  'Sofia Rojas',
  '+59170000001',
  'sofia.rojas@example.com',
  'manual',
  'casas',
  'Casa',
  'Equipetrol',
  250000,
  380000
)
on conflict (id) do nothing;

insert into public.properties (
  id,
  organization_id,
  title,
  description,
  property_type,
  operation,
  status,
  price,
  currency,
  city,
  zone,
  address,
  bedrooms,
  bathrooms,
  parking_spaces,
  area_sqm,
  lot_sqm,
  amenities,
  legal_status,
  owner_name,
  owner_phone
)
values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000001',
  'Casa familiar en Equipetrol',
  'Propiedad demo para validar inventario, publicacion y privacidad de datos del propietario.',
  'Casa',
  'sale',
  'available',
  325000,
  'USD',
  'Santa Cruz de la Sierra',
  'Equipetrol',
  'Direccion privada visible solo para la organizacion',
  4,
  3,
  2,
  260,
  420,
  '["Piscina", "Parrillero", "Jardin"]'::jsonb,
  'Folio real verificado',
  'Propietario Demo',
  '+59170000999'
)
on conflict (id) do nothing;

insert into public.listing_publications (
  id,
  organization_id,
  property_id,
  channel,
  status,
  public_slug,
  published_at,
  options
)
values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000301',
  'public_link',
  'published',
  'casa-equipetrol-demo',
  now(),
  '{"hide_owner": true}'::jsonb
)
on conflict (organization_id, property_id, channel) do update set
  status = excluded.status,
  public_slug = excluded.public_slug,
  published_at = excluded.published_at,
  options = excluded.options;

insert into public.brochure_templates (id, organization_id, name, layout)
values (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000001',
  'Flyer vertical WhatsApp',
  '{"format": "vertical", "sections": ["cover", "price", "specs", "agent"]}'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  layout = excluded.layout;

insert into public.contract_templates (id, organization_id, name, contract_type, body)
values (
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000001',
  'Reserva de inmueble',
  'reserva',
  'Contrato de reserva para {{lead_name}} sobre {{property_title}}.'
)
on conflict (id) do update set
  name = excluded.name,
  contract_type = excluded.contract_type,
  body = excluded.body;

insert into public.automation_rules (id, organization_id, name, trigger, conditions, actions)
values (
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000001',
  'Seguimiento despues de nuevo lead',
  'stage_change',
  '{"to_stage": "Nuevo"}'::jsonb,
  '[{"type": "create_task", "delay_days": 1, "task_type": "follow_up"}]'::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  trigger = excluded.trigger,
  conditions = excluded.conditions,
  actions = excluded.actions;
