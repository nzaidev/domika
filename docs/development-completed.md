# Domika — Development Completed

Status of implemented work against [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md), with UI test steps for each feature.

Last updated: July 3, 2026 · Current state: **Phase 0 complete, Phase 1 complete, Phase 2 complete** (inventory, tasks + automation, collaboration network, brochures). Next: Phase 3 — contracts, email, demand matching, notifications feed.

> **Deployment status:** all work is committed and pushed to `github.com/nzaidev/domika` (main). It has **not** been verified in production — a Vercel project (`domika`) is linked, but whether pushes auto-deploy depends on the Vercel Git integration, and migrations `…0003`–`…0006` still need `supabase db push` against the production project. Treat everything below as verified locally (typecheck, lint, build) plus the UI test steps documented per feature.

---

## Setup prerequisites (once)

Everything below assumes a running local environment:

1. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Webhooks (optional until testing them): `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`
   - Internal panel (optional): `SUPER_ADMIN_EMAILS`
2. **Migrations** — apply all six, in order, to the Supabase project (`supabase db push` or run each file in the SQL editor):
   - `202606300001_initial_schema.sql` — full multi-tenant schema + RLS
   - `202606300002_clerk_identity.sql` — Clerk-based identity functions/policies
   - `202607030003_whatsapp_accounts.sql` — WhatsApp routing + message idempotency
   - `202607030004_meta_lead_pages.sql` — Meta Lead Ads page routing
   - `202607030005_property_media_bucket.sql` — public storage bucket for property photos
   - `202607030006_network_safe_view_and_documents_bucket.sql` — cross-org safe view + private documents bucket
3. **Seed (optional)** — `supabase/seed.sql` creates a demo org (SAILE), stages, one lead, one property, one published listing.
4. **Run** — `npm run dev`, open `http://localhost:3000`.

If Clerk/Supabase env vars are missing, every app route renders a "Configuración del backend" setup screen instead of crashing — that itself is testable.

---

## Phase 0 — Backend foundation ✅

| Item | Where |
|---|---|
| Full schema (29+ tables), RLS on every table, org-scoped policies | `supabase/migrations/202606300001_initial_schema.sql` |
| Identity: Clerk (not Supabase Auth — plan divergence, recorded here) | `202606300002_clerk_identity.sql`, `src/lib/auth/session.ts` |
| Supabase clients (browser / server / service-role admin) | `src/lib/supabase/` |
| Typed DB layer + domain modules | `src/lib/database.types.ts`, `src/lib/domain/` |
| App Router pattern proven (route group `(app)`, auth middleware via `src/proxy.ts`) | `src/app/(app)/` |
| Listing Distribution seam (publications, engagement, attribution, public listing API) | `/api/listings/[slug]`, `src/lib/domain/listing-distribution.ts` |

**How to test:** sign up at `/sign-up`, complete onboarding (below), and confirm the dashboard shows live counts (leads/properties/published/tasks) from your Supabase project rather than mock numbers.

---

## Phase 1 — Foundation + CRM Core ✅

### 1. Org onboarding

New Clerk users have no org; they are routed to create one.

**Test:**
1. Sign up at `/sign-up` with a new email.
2. Visit `/dashboard` → you are redirected to `/onboarding`.
3. Enter an organization name + your name (phone optional) → "Crear organización".
4. You land on `/dashboard` as **owner**. Settings → the pipeline shows the six seeded stages (Nuevo → Contactado → Visito → Negociacion → Cierre → Perdido).

### 2. Team invitations (roles + seat limit)

**Test:**
1. As owner/admin, go to `/settings` → "Agregar un agente al equipo".
2. Enter an email + role → "Invitar al equipo" → a 7-day invite link appears; "Copiar enlace de invitación".
3. Open the link in an incognito window → Clerk forces sign-in/sign-up → the invite page shows org + role → "Aceptar invitación" → lands on the dashboard as a member.
4. Negative checks: accepting with a different email than invited fails with a clear error; a second pending invite to the same email is blocked; invites beyond the org's `max_users` are blocked; agents (role) see no invite form; "Revocar" kills a pending invite.

### 3. Leads board (real data) + manual capture

**Test:**
1. `/leads` shows one column per pipeline stage with live counts.
2. "Nuevo prospecto" (right rail): name, phone, email, zone, notes → the lead appears in the first stage instantly.
3. Phone normalization: enter `70000001` → open the lead → phone shows `+59170000001` (default +591 prefix; `+`-prefixed international numbers are kept as-is).

### 4. Search & filters

**Test:** on `/leads`, use the filter bar — text search (name/phone/email), source, agent, business unit. Filters live in the URL (shareable); "Limpiar" resets.

### 5. Drag-and-drop pipeline (with audit trail)

**Test:**
1. On `/leads`, drag a card to another column → it moves instantly (optimistic) and persists on reload.
2. Open the lead → the timeline shows "Movido a {etapa}"; the DB gains a `pipeline_events` row per move.
3. Touch devices: use the stage selector on the lead detail page instead (HTML5 DnD is desktop-only by design).

### 6. Lead detail page

**Test:** click any card → `/leads/{id}`:
- Facts rail: phone, email, zone, budget, assignee, created date.
- Stage selector ("Mover de etapa") — same audited write as drag-and-drop.
- "Agregar nota" → appears at the top of the timeline.
- WhatsApp panel: chat bubbles if the lead has a linked thread (see §8), otherwise an explanatory empty state.
- A lead ID from another org returns 404 (tenant isolation).

### 7. CSV import (mapping + dedupe preview)

**Test:**
1. `/leads` → "Importar contactos" → upload a CSV whose first row is headers, e.g.:
   ```csv
   Nombre,Celular,Correo,Zona
   Ana Suárez,70011122,ana@mail.com,Equipetrol
   Luis Rocha,+59170033344,luis@mail.com,Urubó
   Ana Suárez,70011122,ana@mail.com,Equipetrol
   ```
2. Column mapping is auto-guessed from headers (nombre/cel/correo/zona…); adjust with the dropdowns.
3. "Verificar duplicados" → per-row verdict: Nuevo / Ya existe (teléfono) / Ya existe (email) / Repetido en el archivo / Sin nombre. Row 3 above shows "Repetido en el archivo".
4. "Importar N prospectos" → only new rows import, into the first stage, phones normalized to +591. Re-importing the same file → everything is a duplicate, 0 created.
5. Limit: 2,000 rows per file.

### 8. WhatsApp lead capture (Meta Cloud API)

Inbound messages auto-create leads and threads. Requires a row in `whatsapp_accounts` mapping your Meta `phone_number_id` → organization.

**Test without Meta (simulated webhook):**
1. Insert an account row in Supabase:
   ```sql
   insert into whatsapp_accounts (organization_id, phone_number_id, display_phone_number)
   values ('<your-org-id>', '1234567890', '+59170000000');
   ```
2. Send a signed payload (uses `META_APP_SECRET` from `.env.local`):
   ```bash
   BODY='{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"1234567890"},"contacts":[{"profile":{"name":"Carlos Prueba"},"wa_id":"59171234567"}],"messages":[{"id":"wamid.test1","from":"59171234567","timestamp":"1751500000","type":"text","text":{"body":"Hola, vi la casa en Equipetrol"}}]}}]}]}'
   SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" -hex | sed 's/^.*= /sha256=/')
   curl -s -X POST http://localhost:3000/api/webhooks/whatsapp \
     -H "content-type: application/json" -H "x-hub-signature-256: $SIG" -d "$BODY"
   ```
3. Expect `{"ok":true,"received":1,"stored":1,...,"leadsCreated":1}`. On `/leads`, "Carlos Prueba" is in the first stage with source WhatsApp; open it → the message shows as a chat bubble.
4. Idempotency: re-run the same curl → `duplicates:1`, no second lead/message.
5. Verification handshake: `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<META_WEBHOOK_VERIFY_TOKEN>&hub.challenge=123` returns `123`. A bad signature on POST returns 401.

**Live:** point the Meta app's webhook at `https://<host>/api/webhooks/whatsapp` after Meta app review + WABA verification (external track).

### 9. Meta Lead Ads capture

Same shape as WhatsApp: requires a `meta_lead_pages` row (`page_id` → org). With a page `access_token` stored, the ingest pulls name/email/phone from the Graph API; without one it creates a placeholder lead carrying the `leadgen_id`.

**Test (simulated):** same curl pattern against `/api/webhooks/meta-leads` with body `{"object":"page","entry":[{"changes":[{"field":"leadgen","value":{"leadgen_id":"L1","page_id":"<page_id>","form_id":"F1","ad_id":"A1","campaign_id":"C1"}}]}]}`. Expect a new lead with source Meta Ads and campaign IDs in `source_meta`. Re-sending the same `leadgen_id` → duplicate, no new lead. A submission matching an existing phone/email folds into that lead's timeline instead of duplicating.

### 10. Pipeline customization

**Test:** `/settings` → "Etapas del pipeline" (owner/admin only; agents see read-only):
- Add a stage ("Agregar etapa") → new column appears on `/leads`.
- Rename inline → board updates.
- Reorder with ↑ / ↓.
- Delete → its leads reparent to the first remaining stage (nothing disappears); deleting the last stage is blocked.

### 11. Super-admin panel (internal)

**Test:**
1. Add your Clerk email to `SUPER_ADMIN_EMAILS` in `.env.local`, restart dev.
2. Visit `/admin` → all orgs with member/lead/property counts; edit plan, max users, billing status → "Guardar".
3. With an email not on the list, `/admin` returns 404 (panel existence hidden).

---

## Phase 2 — Inventory + Productivity + Collaboration ✅ (locally complete — production gate pending)

### 12. Property inventory (real data) ✅

Full CRUD with private owner data and a photo pipeline that normalizes images on ingest (EXIF rotation, max 1600px, WebP) via sharp, stored in the `property-media` bucket under `{org}/{property}/` paths.

**Test — create a property with photos in one step:**
1. `/properties` → "Nueva propiedad" → fill the form (title required; type, operation, estado, precio USD/BOB, ciudad/zona/dirección, dormitorios/baños/parqueos, superficies, amenidades separadas por coma, situación legal, video/tour URLs).
2. Owner section (amber panel): nombre, teléfono, email, notas — the owner phone gets +591 normalization like leads.
3. Photo section: select up to **20 images** (JPG/PNG/WebP/HEIC) → previews appear; the first is marked "Portada". Selecting more than 20 warns and keeps the first 20.
4. Rearrange: **drag a thumbnail onto another** to reorder, or use ↑/↓; ✕ removes; click a thumbnail for **inline zoom** (lightbox with ←/→ navigation, Esc closes).
5. "Crear propiedad y subir N fotos" → progress shows "Subiendo foto X de N…", each image is converted to WebP (máx. 1600px) server-side, then you land on `/properties/{id}`. If some photos fail, you land on the edit page with per-file errors so you can retry.

**Test — photos after creation:**
1. On the detail page → "Editar ficha" → the right panel is the photo manager (same 20-photo cap, enforced server-side).
2. Verify normalization: open an uploaded photo's URL — it's a `.webp` capped at 1600px regardless of the original size/format.
3. "Hacer portada" on another photo → the list card on `/properties` switches its cover. Reorder with ↑/↓; "Eliminar" removes the row *and* the storage object.
4. Invalid file (e.g. a PDF renamed .jpg or a 20 MB image) → a per-file error message, other files still upload.
5. On the detail page, click any gallery photo → inline zoom lightbox with keyboard navigation.

**Test — list, filters, dashboard:**
1. `/properties` → search by title/city/zone/address; filter by estado, operación, tipo; combined filters live in the URL; "Limpiar" resets.
2. Cards show cover, price ("Precio a consultar" when unset), status pill; clicking opens the detail.
3. `/dashboard` → "Inventario reciente" shows the 3 newest properties with covers (previously mock data).
4. Tenant isolation: a property URL from another org returns 404.

### 13. Task management + automation + reminders ✅

Background-job decision (plan §12): **Vercel Cron + route handlers** (`vercel.json` schedules `/api/cron/reminders` every 15 minutes, authenticated with `CRON_SECRET`).

**Test — manual tasks:**
1. `/tasks` → "Agendar acción": título, tipo (llamada/visita/documento/seguimiento/reunión), prioridad, fecha límite + hora, responsable, prospecto y propiedad opcionales, descripción.
2. The task appears grouped by due date: Vencidas / Hoy / Esta semana / Más adelante / Sin fecha / Completadas.
3. Tap the ○ circle → task marked done (moves to Completadas, strikethrough); tap ✓ to reopen.
4. Linked tasks show 👤 prospecto and 🏠 propiedad links that navigate to their pages; creating a lead-linked task also writes a "Tarea creada" entry in the lead's timeline.
5. Filter by responsable and tipo; counts in the header show open + overdue.

**Test — auto-tasks (automation rules):**
1. The seed org includes the rule "Seguimiento despues de nuevo lead" (trigger `stage_change`, condition `to_stage: "Nuevo"`). Move any lead into the **Nuevo** stage (drag or stage selector) → a follow-up task appears in `/tasks` marked "auto", assigned to the lead's agent, due tomorrow.
2. Move the lead out and back into Nuevo → **no duplicate**: only one open auto-task per rule+lead.
3. A new WhatsApp lead (trigger `new_message`) also fires matching rules.
4. Rules live in `automation_rules` (jsonb `conditions`/`actions`) — no UI yet; manage via SQL for now.

**Test — reminders cron:**
1. Set `CRON_SECRET` in `.env.local`. Create a task due within the next hour.
2. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders` → `{"ok":true,"checked":N,"notified":N}`.
3. A row appears in `notifications` for the assignee ("Tarea próxima/vencida: …"); re-running does not re-notify (`reminder_sent_at` marks the task). In production, Vercel Cron calls this automatically every 15 minutes once `CRON_SECRET` is set in the project env. (In-app notification feed UI lands in Phase 3; email/WhatsApp reminder channels attach then too.)

### 14. Agent collaboration network ✅

Two sharing mechanisms, both owner-PII-safe: **direct shares** (`property_shares`: to a specific agent or a whole org, permission levels, optional expiry, view tracking) and the **Domika network** (publish/unpublish to `listing_publications` channel `domika_network`, visible to all other orgs, owner data always hidden).

Testing cross-org features needs **two orgs**: create a second Clerk user in incognito, complete onboarding with a different org name.

**Test — publish to the network:**
1. Org A: property detail → "Colaboración" → **"Publicar en la red Domika"**.
2. Org B: `/network` → the property appears under "Red Domika" with Org A's name, cover, price, and a view counter.
3. Org B clicks it → `/network/listing/{slug}` shows gallery (with zoom), specs, **no owner data** — and the visit increments the view counter (visible to Org A on its detail page and to everyone on the card). The owner viewing their own listing does not inflate the count.
4. Org A: "Quitar de la red Domika" → it disappears from Org B's feed (the slug 404s).

**Test — direct share with permissions:**
1. Org A: property detail → Colaboración → pick a recipient (an org = whole team, or a specific agent), permission (Ver sin propietario / Ver ficha / **Completo**), expiry in days (0 = never) → "Compartir propiedad".
2. Org B: `/network` → "Compartidas conmigo" lists it → opening `/network/shared/{shareId}` shows the property; with "Completo" the owner panel appears, otherwise owner fields are stripped server-side.
3. View tracking: each open by the recipient records who/when (`audit_log`); Org A sees the count next to the share on the property detail and under "Compartidas por mi organización" on `/network`.
4. "Revocar" (property detail or /network) → recipient's link 404s immediately.
5. Expiry: a share created with 0-day... use SQL to set `expires_at` in the past → recipient sees "Este acceso compartido expiró".
6. Isolation: a user from an unrelated org opening someone else's `/network/shared/{shareId}` gets 404.

### 15. Brochure designer (PDF + WhatsApp flyer) ✅

PDF-rendering decision (plan risk 5 / §12): **pdf-lib + sharp — no headless Chromium on serverless.** Both formats pull live property data, the cover photo (WebP → JPEG conversion for PDF embedding), and org branding (`brand_color`, name); layouts are section-based and stored as jsonb in `brochure_templates`.

**Test — generate:**
1. `/brochures` (or property detail → "Generar folleto", which preselects it).
2. Pick property + format: **Folleto PDF (A4)** or **Flyer WhatsApp (1080×1350 vertical)**.
3. Sections are reorderable (↑/↓) and removable/addable: portada, precio, ficha técnica, descripción, amenidades, contacto del agente.
4. "Generar" → PDF opens in a new tab (brand-color header band with org name, cover, title, price in brand color, two-column specs, description, agent footer band); flyer shows an inline preview + "Abrir imagen" — cover on top, branded panel with title/price/specs, footer with agent + org.
5. Output lands in Supabase Storage under `{org}/brochures/{property}/` and is recorded in the **Historial** panel with a reopen link.

**Test — template library:**
1. Arrange sections, type a name → "Guardar plantilla" → it appears under Plantillas.
2. Selecting a template in the generator applies its section layout; "Eliminar" soft-deletes it.
3. Templates and history are org-scoped like everything else.

### Phase 2 — complete ✅

All four modules delivered: property inventory, task management + automation + reminders, collaboration network, brochure designer. This is the **week-4 delivery gate**: the full "agent day-one" flow — add lead → load property with photos → share/publish it → generate brochure → auto/manual follow-up task — is demonstrable end-to-end.

Nice-to-haves pending (non-blocking): realtime updates on shared properties (Supabase Realtime), tasks calendar view, automation-rules management UI.

---

## Cross-cutting behaviors worth spot-checking

- **Tenant isolation** — two orgs never see each other's leads/properties; enforced by RLS *and* org-scoped domain queries. Quick check: create two orgs (two Clerk users), confirm boards are independent and cross-org lead URLs 404.
- **Phone normalization (+591 default)** — applied on every entry path (manual, CSV, WhatsApp, Meta Ads, onboarding), so the same person arriving via CSV (`70011122`) and WhatsApp (`59170011122`) dedupes to one lead.
- **Session states** — every app route degrades cleanly: no env → setup screen; signed out → `/sign-in`; signed in without profile → `/onboarding`.
- **Spanish-first UI** — all new screens ship in Spanish (i18n es/en parity for the prototype screens; new CRM strings are currently es-only — parity pass pending).

---

## Phase 2 deferrals (plan-scope items not shipped in Phase 2)

These are in the plan's Phase 2 scope and were consciously deferred — tracked here, not silently dropped:

| Item | Plan ref | Lands in |
|---|---|---|
| Tasks calendar view (daily/weekly) | §7 Task management | Phase 3 |
| Email/WhatsApp reminder channels (in-app only today) | §7 Reminders | Phase 3 (needs email + WA outbound) |
| Realtime updates on shared properties | §7 Collaboration | Phase 3 (Supabase Realtime subscription) |
| Map view / geocoding | §7 Inventory (open question §12.4) | Blocked on provider decision |
| PDF/document attachments on properties | §7 Inventory | Phase 3 (uses the new private `documents` bucket) |
| Automation-rules management UI (rules run; managed via SQL) | §7 Auto-task rules | Phase 3 |
| Freeform drag-drop brochure canvas (section-based editor shipped) | §7 Brochure designer | Backlog — revisit after client feedback |

## Phase 3 — Documents + Communication + Matching 🔶 (in progress)

### 16. In-app notifications feed ✅

**Test:** the 🔔 bell in the top bar shows the unread count. Create a task due within the hour, run the reminders cron (see §13), reload → badge appears; `/notifications` lists it newest-first with an "Abrir" link, per-item "Marcar leída", and "Marcar todas leídas".

### 17. Contracts ({{variables}} → PDF + signature tracking) ✅

Templates with `{{variable}}` placeholders auto-filled from lead + property + org + agent, rendered to a multi-page A4 PDF, stored in the **private `documents` bucket** and served only via the authed, org-checked `/api/documents` route (never the public media domain).

**Test:**
1. `/contracts` (in the nav) → right panel → create a template: name, type (captación/reserva/alquiler/promesa/comisión), body using variables — the full list is shown under the editor (`{{lead_name}}`, `{{property_title}}`, `{{property_price}}`, `{{owner_name}}`, `{{agent_name}}`, `{{date}}`…).
2. Generator: pick template + prospecto + propiedad → "Generar contrato PDF" → success note reports any fields that had no data (rendered as "________" blanks in the PDF).
3. "Abrir PDF" → multi-page A4 with org header, filled body, and signature lines; the URL is `/api/documents/...` — opening it from another org's session (or signed out) 404s/401s.
4. Status tracking: per contract, set estado (Borrador/Generado/Enviado/Firmado/Anulado) and firma (Pendiente/Firmado/Rechazado/Expirado) → "Actualizar". E-signature vendor integration (DocuSeal or hosted) is pending the §12 decision — statuses are manual until then.
5. Lead-linked contracts write a "Contrato generado" entry in the lead's timeline; the seeded "Reserva de inmueble" template works out of the box.

### 18. Demand matching ✅

Buyer requirements auto-match against your inventory **and** other orgs' Domika-network listings (owner data never included). Scoring is a weighted comparison (operación 15 / tipo 20 / presupuesto 25 con ±10% de tolerancia / zona 15 / ciudad 10 / dormitorios 10 / superficie 5), normalized so only the criteria you specify count; an operation mismatch (alquiler vs venta) disqualifies outright. Matches ≥50% are stored.

**Test:**
1. `/matching` (nav: "Coincidencias") → right panel: pick an optional prospecto, set criteria (tipo, operación, presupuesto, ciudad/zona, dormitorios, superficie) → "Crear requerimiento" → matches compute immediately, sorted by score with reasons ("Precio dentro del presupuesto · Zona coincide…").
2. Auto-match on new supply: create a new property that fits an active requirement → the match appears on `/matching` without re-running anything, and the requirement's creator gets a 🔔 notification ("N nuevas coincidencias"). Editing a property or publishing it to the network also re-matches.
3. Cross-org: a requirement in org A matches org B's network-published listing → the card shows "Red Domika · {org}" and links to the network listing view (owner data stripped); org B's unpublished properties never appear.
4. Lead-linked requirements log to the lead's timeline; "Archivar" retires a requirement.
5. Scorer edge cases are unit-tested (9 cases: tolerance, normalization, accents, disqualification).

### 19. Self-service Meta integrations + WhatsApp media ✅

**Test — connect WhatsApp without SQL:** `/settings` (owner/admin) → "WhatsApp Business" panel → enter the `phone_number_id` (numeric ID from Meta → WhatsApp → API Setup), visible phone, optional WABA ID and access token → save. The token is write-only (never displayed; leave blank on edit to keep it). Same pattern for "Meta Lead Ads" (page_id + page token). Numbers/pages already connected to another org are rejected.

**Inbound media:** with a token saved, incoming WhatsApp photos/documents/audio are downloaded from the Graph API, re-hosted in R2, and render in the lead's conversation (images inline, documents as 📎 links). Without a token, messages still arrive with a media placeholder.

### 20. Public listing pages + social sharing ✅

**Test:**
1. Property detail → "Página pública" → "Crear enlace público" → a consumer-facing page appears at `domika.io/p/{slug}`: gallery with zoom, price, specs, amenities, org branding — **no owner data, no address** (DB-level exclusion), no login required. Each visit records an anonymous view in engagement events.
2. Share buttons appear: **WhatsApp**, **Facebook**, **LinkedIn**, and copy-link (Instagram has no web-share endpoint — use copy link). Shares carry OpenGraph tags (title, price/location description, cover photo), so previews render rich cards.
3. "Desactivar enlace público" → the page 404s immediately.
4. `/listings` (Promoción) counts the "Enlace público" channel with its views.

### 21. Mobile pass ✅

The app now works phone-first: below 1180px the sidebar becomes a sticky horizontal nav strip (previously navigation disappeared entirely on mobile); below 820px the kanban becomes horizontally swipeable with fixed-width columns, filter bars stack, photo/publication rows reflow, chat bubbles widen, and forms go single-column. **Test:** open any page at ~390px width — every tab must be reachable and every form usable.

### 22. Workflow gap fixes ✅

**Lead edit + reassign:** lead detail → "Editar contacto" (collapsible) → fix name/phone/email/zone/type/budget and change the **responsable**. Reassignment writes a timeline entry ("Reasignado a X") and sends the new assignee a 🔔 notification; contact edits log "Datos de contacto actualizados". Phones re-normalize to +591.

**Public-page lead capture:** every `/p/{slug}` page now ends with "¿Te interesa esta propiedad?" — name + phone/email + message. Submissions create a lead in the owning org (source: Publicación, assigned to the publisher, first stage), write the message to the timeline, record the attribution + a "lead" engagement event, and notify the publisher. Repeat inquiries from the same phone/email fold into the existing lead instead of duplicating. Honeypot field filters naive bots.

**Org branding settings:** `/settings` → "Marca" (owner/admin): organization name + brand color picker — drives flyers, brochure PDFs, contracts, and public pages from the next generation onward.

**Profile settings:** `/settings` → "Perfil": any member edits their own name/phone (what prints on brochures and contracts).

### Pending in Phase 3

Email integration (Gmail/Outlook OAuth, sequences), WhatsApp outbound send (incl. match cards por WhatsApp), e-signature vendor integration, Google Chat webhook. Smaller pending: business-unit pipelines UI, Excel (.xlsx) import, invitation emails (needs email provider), org logo upload. Token storage note: Meta access tokens are stored in the DB (server-only access); at-rest encryption is a pre-launch hardening item.

## Testing & security posture

- **Unit tests + CI**: vitest suite (`npm test` — phone normalization, CSV parser, brochure layout sanitizer, PDF/flyer renderers) and a GitHub Actions workflow (lint, typecheck, test, build) run on every push/PR.
- **Cross-org PII**: reads for the network feed, listing detail, and non-"full" shares go through the `properties_network_safe` VIEW (migration 0006), which excludes `owner_*` and `address` at the database level. Only a "full"-permission share fetches owner fields, via an explicit separate query.
- **RLS exposure suite** (`tests/rls-exposure.test.ts`): runs against the live project (auto-skips without `NEXT_PUBLIC_SUPABASE_*` env, so CI stays green) and asserts the **anonymous** role — the public anon key ships in every browser — can reach only what the design allows: no base table, no private bucket, only published listings and the sanctioned `get_public_listing` RPC. **This suite found a real vulnerability** (below).
  - ⚠️ **ACTION REQUIRED — apply migration `202607110007_lock_down_network_safe_view.sql` to production.** The `properties_network_safe` view was readable by `anon` via PostgREST, exposing every org's inventory (title/price/zone/status, though not owner PII/address) to anyone with the public anon key. A Postgres view runs as its owner and bypasses the base table's RLS by default. The migration adds `security_invoker=on` and revokes anon/authenticated/public access (the app reads it only via the service-role client). Until applied, the suite's `properties_network_safe` assertion fails **by design** — that red test is guarding a live leak.
- **Still pending**: authenticated-role RLS simulation (needs the project JWT secret or a local Supabase stack) — the `agents_see_own_org` cross-tenant policies are authored and used only via the service-role client, not yet exercised by tests for the `authenticated` role. Plus the §9 security review, load test, and mobile QA.
- **Observability**: `src/instrumentation.ts` logs uncaught server errors as structured single-line JSON (no bodies/headers, to avoid leaking tokens); swap the sink for Sentry/Logtail when a vendor is chosen.
- **Storage**: `property-media` bucket is public by design (listing photos, brochures = marketing collateral). The private `documents` bucket (signed URLs, migration 0006) is reserved for contracts and property documents in Phase 3.

## Not yet implemented

Phase 3 (contracts, email, matching, notifications feed) and Phase 4 (Waiboom, QA, launch). External tracks pending on the client side: Meta app review, WhatsApp Business verification, applying migrations `…0003`–`…0006` to the production Supabase project, setting Vercel env (`CRON_SECRET`, `SUPER_ADMIN_EMAILS`, Meta secrets, production Clerk keys), and confirming the Vercel production deploy. **Overall status: Phases 0–2 locally complete; production gate pending.**
