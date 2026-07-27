-- Canonical, human-readable property URLs: /properties/<slug>.
-- Adds a stable slug generated from the title, unique per organization.
-- The route still resolves a raw UUID too, so existing links keep working.

alter table public.properties
  add column if not exists slug text;

-- Backfill existing rows: slugify the title, then de-duplicate within each
-- organization by appending -2, -3, … to collisions. Stable thereafter.
with slugged as (
  select
    id,
    organization_id,
    left(
      nullif(
        regexp_replace(
          regexp_replace(
            lower(translate(
              coalesce(title, ''),
              'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
              'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC'
            )),
            '[^a-z0-9]+', '-', 'g'
          ),
          '(^-+|-+$)', '', 'g'
        ),
        ''
      ),
      60
    ) as base
  from public.properties
  where slug is null
),
numbered as (
  select
    id,
    coalesce(base, 'propiedad') as base,
    row_number() over (
      partition by organization_id, coalesce(base, 'propiedad')
      order by id
    ) as rn
  from slugged
)
update public.properties p
set slug = case when n.rn = 1 then n.base else n.base || '-' || n.rn end
from numbered n
where p.id = n.id
  and p.slug is null;

-- One slug per name within an organization.
create unique index if not exists properties_org_slug_key
  on public.properties (organization_id, slug)
  where slug is not null;
