# Domika — Development Plan (V1)

**Engineering implementation plan**
Product: Domika — Real Estate Solution (PropFlow prototype → production CRM suite)
Client: SAILE Business Group · Vendor: OneUpAI Solutions Inc.
Target market: Bolivia → México, Perú, Colombia (Spanish-first, WhatsApp-centric)
Date of plan: June 30, 2026

---

## 1. Executive summary

Domika is a multi-tenant SaaS CRM and operations suite for LATAM real-estate agents. The signed proposal commits to a V1 of **seven critical modules** delivered across **4 phases / 8 weeks**, on a shared-database Supabase architecture with row-level security, for USD $397/mo (up to 100 users).

**Where we are today:** the repository is a high-fidelity, client-rendered UI prototype only. The visual design, branding, i18n (es/en), and the main screens (landing, dashboard, leads kanban, properties, property detail) are built in Next.js 16 / React 19 with mock data. There is **no backend, database, authentication, persistence, or App Router page structure** yet. Tasks, Network, Brochures, and Settings are placeholder screens.

**What this plan does:** it re-baselines the proposal's scope against the actual code, then sequences the remaining work — backend foundation first, then module-by-module — so the team can build toward the committed 8-week target while keeping the system integrated end-to-end (the proposal's explicit "fracaso a evitar": do not build disconnected pieces).

The plan treats the existing prototype as the **design source of truth for the UI** and the technical proposal as the **source of truth for data model and scope**.

---

## 2. Current state assessment

### 2.1 What exists

| Area | State |
|------|-------|
| Framework | Next.js **16.2.9**, React **19.2.4**, TypeScript 5, Turbopack |
| Routing | Client-side state machine in `src/components/PropFlowApp.tsx` (`Route` union). No App Router routes beyond `/`. |
| Styling | Global CSS migrated from `legacy/index.html`; Rand brand identity (navy `#0B1B3A`/`#06112A`, accent `#3B82F6`, fonts Bricolage Grotesque + Plus Jakarta Sans). |
| i18n | `src/lib/i18n.ts` — full es/en string maps; Spanish default. |
| Data | `src/lib/data.ts` — hardcoded mock leads/properties/photos. No fetching layer. |
| Types | `src/lib/types.ts` — UI-only shapes (`Property`, `Lead` with display strings like `price: "$485,000"`), not domain models. |
| Screens built | Landing, Dashboard, Leads (kanban, no real DnD), Properties (tab filters), Property Detail (gallery, specs, share controls). |
| Screens stubbed | Tasks, Network, Brochures, Settings → "Sección en construcción". |
| Backend | **None.** No Supabase client, API routes, server actions, auth, or migrations. |
| `scripts/migrate.mjs` | One-time script that generated the modular structure from the legacy single-file prototype. Not part of the build. |

### 2.2 Gap analysis (prototype → V1)

The prototype proves UX for ~5 of the V1 screens. To reach V1 we must add, in rough order of effort:

1. **Backend foundation** — Supabase project, full schema + RLS, auth, org onboarding, role model, super-admin. (None exists.)
2. **Data layer** — replace mock `data.ts` with typed queries/mutations; introduce real domain types (decouple from display-formatted UI types).
3. **App Router migration** — move from client-state routing to real routes (`/dashboard`, `/leads`, `/properties/[id]`, etc.) with server components where possible.
4. **Integrations** — WhatsApp (Meta Cloud API), Meta Lead Ads, Gmail/Outlook, PDF generation, e-signature.
5. **Missing modules** — Tasks, Collaboration Network, Brochure Designer, Contracts, Demand Matching, Waiboom.
6. **Cross-cutting** — file uploads + image processing, realtime, notifications, reminders, background jobs.

### 2.3 Key constraint: Next.js 16 is non-standard

`AGENTS.md` warns this Next.js version has breaking changes vs. what training data assumes. **Before writing any framework code, read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `03-architecture`).** Validate App Router conventions, server actions, route handlers, caching, and `params`/`searchParams` shapes against those docs rather than assuming. This applies to every phase below.

---

## 3. Target architecture

Per the proposal, confirmed and unchanged:

```
Agent (browser)
   → Next.js 16 App (Vercel Pro)
      → Clerk Auth → profiles.clerk_user_id → profiles.organization_id
      → Supabase Postgres (shared, multi-tenant, RLS on every table)
      → Supabase Storage (single bucket, org-prefixed paths)
      → Supabase Realtime (shared properties, notifications)
   → External: Meta Cloud API (WhatsApp/IG/Messenger), Meta Lead Ads,
     Gmail/Outlook OAuth + Resend, headless Chromium/pdf-lib, DocuSeal, Waiboom
```

**Decisions baked in:**

- **Multi-tenancy:** shared database, row-level isolation via `profiles.clerk_user_id → profiles.organization_id`. No per-tenant schemas. Next.js server actions/route handlers enforce tenant access with Clerk user IDs; database RLS helper functions also understand Clerk JWT `sub` claims if direct Supabase access is enabled later.
- **Tenant safety:** every table carries `organization_id` and an `agents_see_own_org` RLS policy. Owner PII on properties is **never** exposed cross-org — enforced both by RLS and by excluding owner fields from public queries at the API layer.
- **Listing distribution:** publishing, promotion, agent sharing, public listing links, Waiboom feeds, and listing-lead attribution sit behind one deep module. Callers do not directly toggle property/public/share tables; they use the Listing Distribution interface so privacy, channel status, and engagement tracking stay consistent.
- **Server-first data access:** prefer React Server Components + server actions / route handlers for data, using a server Supabase client bound to the user's session; use the browser client only for realtime and interactive mutations. Keep the service-role key server-only.
- **Type strategy:** generate DB types from Supabase (`supabase gen types`) into `src/lib/database.types.ts`; build domain types on top. Retire the display-string UI types (`price: string`) in favor of numeric domain fields formatted at the view layer.
- **Background work:** scheduled/async jobs (auto-tasks, reminders, demand-match scoring, sequence sends) via Supabase scheduled functions / Edge Functions or Vercel Cron + route handlers. Pick one (see §10 open questions) and standardize.

### 3.1 Proposed repository structure (target)

```
src/
  app/
    (marketing)/                 # public landing
    (auth)/sign-in, /sign-up, /invite/[token]
    (app)/
      dashboard/
      leads/  leads/[id]/
      pipeline/
      properties/  properties/[id]/
      listings/                    # publish/promote/share/measure
      tasks/   calendar/
      network/
      brochures/  brochures/editor/[id]/
      contracts/
      matching/
      settings/  settings/team/  settings/pipeline/  settings/branding/
    admin/                       # super-admin (internal)
    api/
      listings/[slug]/              # public listing read path, no owner PII
      webhooks/whatsapp/         # Meta Cloud API
      webhooks/meta-leads/       # Meta Lead Ads
      oauth/google/  oauth/microsoft/
      pdf/   cron/
  lib/
    supabase/server.ts  supabase/client.ts  supabase/admin.ts
    database.types.ts
    domain/ (leads.ts, properties.ts, listing-distribution.ts, tasks.ts, ...)   # queries + mutations
    integrations/ (whatsapp.ts, meta.ts, email.ts, pdf.ts, signature.ts)
    auth/  rls helpers, role guards
  components/ (existing UI, refactored to consume real data)
supabase/
  migrations/   seed.sql   functions/
```

### 3.2 Listing Distribution module seam

The Listing Distribution module owns the product promise that an agent can publish listings, promote them, share them with other agents, and measure the leads/views created by that activity. Its interface should stay small and intention-based:

- `publishListing(propertyId, channels, options)` — make a listing visible on selected channels (Domika network, public link, Waiboom/feed, future portals).
- `unpublishListing(propertyId, channels)` — withdraw a listing from selected channels without deleting the property record.
- `shareListing(propertyId, audience, permissions)` — grant agent/org access with owner-PII rules enforced centrally.
- `recordListingEngagement(listingId, event)` — track view/click/share/download events by channel.
- `captureListingLead(listingId, source, contact)` — create or link a lead from listing activity and preserve attribution.

**Invariants:** owner PII never leaves the owning org; publication status is channel-specific; all listing events carry `organization_id`; every public/cross-org read goes through a no-owner-data projection; failed external publishes leave an auditable pending/failed state.

---

## 4. Data model

Adopt the proposal's schema verbatim as the migration baseline. Tables, grouped:

- **Core:** `organizations`, `profiles` (with `clerk_user_id`), `invitations`.
- **CRM:** `leads`, `pipeline_stages`, `pipeline_events`, `lead_activities`.
- **WhatsApp:** `whatsapp_threads`, `whatsapp_messages`.
- **Inventory:** `properties` (incl. private `owner_*` fields), `property_media`.
- **Listing distribution:** `listing_publications` (property/channel/status/public slug or external id), `listing_engagement_events` (views/clicks/shares/downloads/leads), `listing_lead_attributions`.
- **Collaboration:** `property_shares` (written through Listing Distribution for cross-agent sharing).
- **Productivity:** `tasks` (with `reminder_channels`, `auto_generated`).
- **Documents:** `brochure_templates`, `brochures`, `contract_templates`, `contracts`.
- **Matching:** `buyer_requirements`, `demand_matches`.
- **Cross-cutting (to add, not in proposal schema):** `notifications`, `email_accounts` (OAuth tokens, encrypted), `email_messages`, `email_sequences` + `email_sequence_steps`, `audit_log`, `automation_rules`. These back the V2/notification scope and should be designed in Phase 1 even if populated later.

**RLS:** enable on every table; apply the `agents_see_own_org` ALL policy; expose public/cross-org listing reads through `listing_publications` plus a no-owner-data property projection; exclude owner PII from any cross-org/public read path at the API layer. Add an admin bypass path for the super-admin panel via the service-role client (server-only).

**Seeding on org creation:** default `pipeline_stages` per business unit (`Nuevo → Contactado → Visitó → Negociación → Cierre → Perdido`), default brochure/contract templates, owner `profile`.

**Indexing:** composite indexes on `(organization_id, ...)` for every hot query path (leads by stage, properties by status/type/city, listing publications by channel/status, listing engagement by property/channel, tasks by assignee/due, messages by thread). Add this as an explicit task in Phase 1, not an afterthought.

---

## 5. Phase 0 — Backend foundation & migration prep (pre-Phase 1, ~3–5 days)

This work is implied by the proposal but absent from the prototype; it must precede Phase 1 features.

- Create Supabase project (dev + prod); wire env vars in Vercel; confirm regions/latency for Bolivia.
- Author the full schema as ordered SQL migrations in `supabase/migrations/`; apply RLS policies; write `seed.sql` (demo org + stages + templates).
- Generate `database.types.ts`; add `src/lib/supabase/{server,client,admin}.ts` clients.
- Establish the **App Router migration pattern** on one vertical slice (e.g. dashboard) — read Next 16 docs, set the route-group layout, auth middleware, and a server-component data fetch — before migrating the rest.
- Introduce domain types and a thin data-access layer; refactor one existing view to consume Supabase instead of `data.ts` as the reference implementation.
- CI: lint + typecheck + build on PR; preview deploys on Vercel.
- **Kick off external-approval tracks now (long lead time, run in parallel):** Meta app review + WhatsApp Business Account verification and phone-number provisioning; Meta Lead Ads permissions; Gmail/Outlook OAuth app verification. These gate Phase 1 (WhatsApp) and Phase 3 (email) features, so they must start on day one — see §11 risk 3 and the tracker reconciliation in §11.1.

**Exit criteria:** a logged-in user, in a seeded org, sees real (empty or seeded) data in the dashboard via App Router + RLS. The pattern for every later module is now proven. WhatsApp/Meta and email OAuth approvals are submitted and in flight.

---

## 6. Phase 1 — Foundation + CRM Core (Weeks 1–2)

**Goal:** working auth, org onboarding, and a functional CRM capturing leads from WhatsApp and Meta Ads.

### Infrastructure & Auth
- Clerk auth; session handling through Clerk middleware/proxy.
- Org creation on first sign-up (creator → `owner`); seed stages/templates.
- Invitation flow: create invite → email link (`/invite/[token]`) → accept → join org with assigned role.
- Role-based access (`owner | admin | agent`) enforced in UI guards **and** RLS/route handlers.
- Super-admin panel (internal route, service-role): manage orgs, users, plan/billing flags.

### CRM — Leads
- Lead CRUD; list with search + filters (stage, business unit, source, assignee).
- Lead detail page: contact info, activity timeline (`lead_activities`), notes, linked tasks/properties, WhatsApp thread.
- CSV/Excel bulk import with column mapping + dedupe preview.
- Source tagging (manual, WhatsApp, Meta Ads, portal, referral).
- Refactor the existing kanban view to real data + real drag-and-drop (writes `pipeline_events`).

### WhatsApp integration (Meta Cloud API)
- Webhook route handler (`/api/webhooks/whatsapp`) with signature verification; inbound routing to the lead's thread.
- Unknown number → auto-create lead + prompt agent to qualify.
- Store + render conversation in lead detail; send outbound from the lead view (respect 24-hour session window / templates).
- Same webhook ingests Instagram DM + Messenger.

### Meta Ads lead capture
- `/api/webhooks/meta-leads` — form submissions auto-create leads.
- Persist campaign/ad set/ad into `source_meta`; dedupe by phone/email.

### Pipeline
- Seed default stages per business unit on org creation.
- Drag-and-drop kanban; stage changes logged to `pipeline_events`.
- Pipeline customization (add/rename/reorder/delete) in settings.
- Business-unit filter (Casas, Deptos, Alquileres, Terrenos, Inversionistas, Premium).

**Exit criteria:** an agent can sign up, create an org, invite a teammate, import/create leads, receive a WhatsApp/Meta-Ads lead automatically, and move it through a customizable pipeline.

**▣ Delivery gate — Phase 1 review (target wk 2):** client walkthrough + sign-off on Foundation + CRM Core before Phase 2 starts.

---

## 7. Phase 2 — Inventory + Productivity + Collaboration (Weeks 3–4)

**Goal:** property inventory, listing distribution, task management, agent collaboration, brochure generation.

### Task management
- Task CRUD linked to lead/property; types (call/visit/document/follow-up/meeting); priority + status; assignment.
- Calendar view (daily/weekly) with task list.
- Reminders via push + email + WhatsApp (`reminder_channels`) — needs the scheduled-job runner from §3.
- Auto-task rules: on stage change, on inactivity (X days no contact), on new WhatsApp message from unknown lead (`automation_rules` + job).
- Team productivity dashboard (tasks by agent, overdue, completion rate).

### Property inventory
- Property CRUD with full spec form (type, operation, price, area, rooms, amenities, legal status).
- Private owner section (`owner_*`) — never exposed cross-org.
- Multi-photo upload to Supabase Storage with **auto-resize + format normalization on ingest** (server-side processing; sharp or equivalent). Photo reorder (drag), cover selection.
- Video URL + virtual tour link + PDF/document attach.
- Map view — lat/long pin or address geocoding ("Mostrar en mapa").
- Status management (available/reserved/sold/rented); search + filters.
- Refactor existing Properties + Detail views onto real data.

### Listing distribution
- Introduce the Listing Distribution module as the only write path for publish/unpublish/share/promote/measure operations.
- Publish/unpublish a property to selected channels: Domika agent network, public listing link, WhatsApp flyer/PDF, Waiboom/feed-ready publication.
- Track channel-specific publication status (`draft`, `published`, `pending`, `failed`, `unpublished`) and show failures/action-needed states in the listing UI.
- Record listing views, brochure downloads, share clicks, WhatsApp sends, and listing-originated leads with source/channel attribution.
- Public listing pages and cross-org listing cards must use the no-owner-data projection, never raw property rows.

### Agent collaboration network
- Share property with one agent or the whole org through Listing Distribution; permission levels (view / view-without-owner / full); optional expiry.
- View tracking (who/when/count).
- Public/private toggle is represented as channel-specific listing publications; public properties visible to agents in other orgs (owner data always hidden — verify via RLS test).
- Realtime updates (Supabase Realtime) when a shared property changes.

### Brochure designer
- Drag-and-drop template editor (cover photo, specs table, description, agent contact, logo); layout stored as `jsonb`.
- Dynamic fields pulled from the property record; agent branding (logo/brand color from org settings).
- Two output formats: WhatsApp flyer (vertical single image) + PDF brochure.
- One-click PDF export per property (headless Chromium/pdf-lib); template library (save/reuse).

**Exit criteria:** an agent can list a property with normalized photos and a map pin, publish/promote it through selected listing channels, share it with controlled permissions, track generated listing activity/leads, get auto-generated follow-up tasks, and export a branded brochure — the "agent day-one" success criteria are met.

**▣ Delivery gate — Phase 2 review (target wk 4):** client walkthrough + sign-off on Inventory + Productivity + Collaboration + Brochures. The full day-one flow (add lead → load property → generate brochure → schedule task) is demonstrable here.

---

## 8. Phase 3 — Documents + Communication + Matching (Weeks 5–6)

**Goal:** contracts, email integration, demand matching, internal notifications.

### Contracts & documents
- Template editor with `{{variable}}` placeholders; types: captación, reserva, alquiler, promesa, comisión.
- Variables auto-filled from lead + property; PDF output (Chromium/pdf-lib).
- Digital signature (DocuSeal or equivalent open-source); send signed contract via email/WhatsApp.
- Document library per lead / per property.

### Email integration
- Gmail + Outlook OAuth (one account per agent; tokens encrypted in `email_accounts`); SMTP fallback (incl. Zoho).
- Thread stored + shown in lead timeline; compose/send from lead detail.
- Commercial templates (follow-up, property overview, offer); open/click tracking (Resend or pixel).
- Automated sequences (e.g. auto follow-up 3 days post-visit if no reply) — `email_sequences` + job runner.

### Demand matching
- Buyer requirement form (type, operation, budget, area, location, bedrooms); linked to a lead or posted independently.
- Auto-match job on new property and on new requirement; field-comparison scoring (budget/type/location) into `demand_matches`.
- Match score display; in-app + optional WhatsApp notification to requesting agent; overview card sent **without** owner data.

### Internal notifications
- In-app notification feed (`notifications`): task reminders, new leads, pipeline moves, matches, shares.
- Optional Google Chat webhook to a team channel.

**Exit criteria:** contracts generate/sign/send end-to-end; agents send and track email from inside Domika; new supply/demand auto-matches and notifies.

**▣ Delivery gate — Phase 3 review (target wk 6):** client walkthrough + sign-off on Documents + Communication + Matching.

---

## 9. Phase 4 — Waiboom + QA + Launch (Weeks 7–8)

**Goal:** AI-visibility activation, full QA, training, go-live.

### Waiboom (GEO)
- Provision Waiboom tenant for SAILE; configure publication identity (real-estate Bolivia/LATAM, buyers/investors, SAILE brand).
- Connect Waiboom to Listing Distribution's published-listings feed/API, not raw property tables; include only public, no-owner-data listing payloads + market updates; begin indexing for ChatGPT/Perplexity/Gemini.
- Monthly AI-visibility report pipeline.

### QA
- Functional QA across all 7 V1 modules.
- Load test (~100 concurrent agents).
- **Security review:** RLS policy audit (cross-org isolation, owner-PII leakage), auth token handling, WhatsApp/Meta webhook signature validation, file-upload validation (type/size/MIME), OAuth token storage. *(Run this as a dedicated subagent/security pass, not ad hoc.)*
- Mobile responsiveness (agents are phone-first) + cross-browser.

### Training & launch
- Live training (CRM walkthrough, WhatsApp setup, property upload, brochure generation).
- Written quick-start guide in Spanish; video walkthroughs for the 3 top flows (add lead, add property, generate brochure).
- Production deploy; 30-day post-launch support.

**Exit criteria (V1 "definition of done"):** all 7 priority-4/5 modules working end-to-end, RLS audited, mobile-verified, team trained, in production.

**▣ Delivery gate — Phase 4 review + go-live sign-off (target wk 8):** production launch acceptance. Followed by two tracked support milestones: **30-day post-go-live support start** (at launch) and **support close + final handoff** (~wk 12 / +30 days).

---

## 9a. Project milestones & review gates (PM track)

The engineering exit criteria above are paired with client-facing milestones so the build stays aligned with the commercial agreement. These mirror the SAILE project tracker:

| Milestone | When | Type |
|---|---|---|
| Kick-off call + service agreement signed | Pre-Phase 0 | Commercial |
| Scope/intake form completed | Pre-Phase 0 | Commercial |
| Phase 1 delivery & review (Foundation + CRM Core) | End wk 2 | Review gate |
| Phase 2 delivery & review (Inventory + Productivity) | End wk 4 | Review gate |
| Phase 3 delivery & review (Communication + Documents) | End wk 6 | Review gate |
| Phase 4 delivery & review + go-live | End wk 8 | Review gate |
| Post-go-live support start (30 days) | At launch | Support |
| Support close + final handoff | ~wk 12 | Support |

---

## 10. Cross-cutting workstreams (run in parallel across all phases)

- **App Router migration** — incrementally convert each module from client-state routing to real routes as it's built; remove the `Route` union when the last view is migrated.
- **Design fidelity** — preserve the Rand brand prototype; reuse existing components, swapping mock data for live data. The prototype is the UI spec.
- **i18n** — Spanish-first; keep es/en parity for every new string. All seeded content (stage names, templates) in Spanish.
- **Listing Distribution** — publish/promote/share/measure through one module seam; new channels should plug into this module rather than adding direct property-table writes from screens or integrations.
- **Observability** — error tracking (Sentry or similar), structured logs on webhooks/jobs, uptime monitoring.
- **Testing** — unit tests for scoring/import/parsing logic; integration tests for RLS isolation and Listing Distribution privacy/channel behavior; E2E for the day-one flows.
- **Billing/plans** — `organizations.plan` + `max_users` enforcement; tie super-admin to plan management (full billing integration likely V2 — confirm).

---

## 11. Sequencing, dependencies & risks

**Hard dependency order:** Phase 0 (schema + auth + RLS + App Router pattern) blocks everything. Within phases: leads/pipeline before WhatsApp routing; properties before collaboration, brochures, and matching; tasks' job-runner before reminders, sequences, and auto-matching (so stand up the background-job infrastructure early in Phase 2).

**Top risks:**

1. **Next.js 16 unfamiliarity** — breaking changes vs. assumptions. *Mitigation:* read `node_modules/next/dist/docs/` before each framework task; prove the pattern in Phase 0.
2. **8-week target vs. zero backend today** — the schedule assumed greenfield-with-design; backend is genuinely from scratch. *Mitigation:* Phase 0 buffer; consider deferring V2-priority items (email, matching, Waiboom) past go-live if Phase 1–2 slip, since the "ready to launch" definition is the 7 critical modules.
3. **Meta API approval & WhatsApp Business onboarding** — external approval lead times can block Phase 1. *Mitigation:* start Meta app review and WhatsApp number provisioning during Phase 0.
4. **RLS correctness / PII leakage** — the central security guarantee. *Mitigation:* dedicated RLS integration test suite from Phase 1; security subagent pass in Phase 4.
5. **Image-processing + PDF at scale** — server-side resize and Chromium rendering are resource-heavy on serverless. *Mitigation:* decide on a processing approach (Edge Function vs. Vercel function vs. external service) in Phase 0.
6. **"Disconnected pieces" failure mode** (called out explicitly by the client) — *Mitigation:* shared domain layer, consistent linking between leads/properties/tasks/contracts, and design with the Phase-2 marketplace in mind.

### 11.1 Reconciliation with the SAILE project tracker

The SAILE project tracker (41 tasks) and this plan both derive from the signed proposal and agree on ~90% of scope. They diverged on three module-to-phase assignments; this plan follows the proposal, and the reasoning is recorded here so the tracker can be realigned:

- **WhatsApp / Messenger / IG capture — Phase 1 (here), not Phase 3 (tracker).** Lead capture is the top of the funnel and the Phase 1 goal in the proposal; deferring it leaves the CRM with no inflow for six weeks. The tracker's likely motive — Meta/WhatsApp approval lead time — is handled instead by starting that approval in Phase 0 (§5, risk 3), so the feature ships in Phase 1.
- **Brochure designer — Phase 2 (here), not Phase 3 (tracker).** "Generate a brochure" is part of the proposal's *agent day-one* definition and depends only on inventory (Phase 2). Keeping it in Phase 2 makes the full day-one flow demonstrable at the wk-4 gate.
- **Demand Matching — Phase 3 (here), Phase 2 (tracker).** Matching feeds off a mature inventory plus buyer requirements; Phase 3 is lower-risk. This is the least consequential difference — it can be pulled into Phase 2 if an early network demo is wanted, at some rework risk.

What the tracker does better and has been adopted here: the four formal **delivery/review gates** and the **commercial + support milestones** (see §9a).

---

## 12. Open questions / decisions needed

1. **Background jobs:** Supabase Edge Functions + pg_cron, or Vercel Cron + route handlers? (Affects reminders, sequences, matching, auto-tasks.)
2. **E-signature:** confirm DocuSeal (self-hosted) vs. a hosted alternative — impacts infra and cost.
3. **Billing:** is payment collection in V1 scope, or are plans managed manually by super-admin for launch?
4. **Geocoding/maps provider:** Google Maps, Mapbox, or OpenStreetMap/Nominatim? (Cost + ToS for Bolivia.)
5. **Push notifications:** web push only, or native mobile app later? (Proposal says "agents primarily on phones" — confirm PWA vs. native expectation.)
6. **Listing channels for V1:** confirm the exact initial channels beyond Domika network, public link, WhatsApp flyer/PDF, and Waiboom feed/API. External portals should be explicit if expected.
7. **Waiboom interface:** confirm whether it's API-, RSS-, or feed-based so the integration can be scoped.
8. **AI assistant in the top bar** (in the prototype/proposal): define its role (search, drafting, suggestions) and target phase — currently unscoped.
9. **Image processing location:** sharp-in-function vs. external service (see risk 5).

---

## 13. Definition of done (V1)

- All seven priority-4/5 modules functional end-to-end: CRM + pipeline, tasks (with auto follow-up), inventory (with photo normalization), listing distribution (publish/promote/share/measure), brochures, contracts.
- Multi-tenant isolation proven by automated RLS tests; owner PII never crosses orgs.
- Spanish-first UI, mobile-verified, deployed to production on Vercel.
- Team trained; quick-start guide + 3 video walkthroughs delivered.
- North-star metric instrumented: track active agents toward 100 in 3 months.

---

*Sources: `DOMIKA_TECHNICAL_PROPOSAL.pdf`, `Propuesta-Domika-OneUpAI-SAILE (2).pdf` (project-files), and the current `src/` codebase. Schema and phase scope follow the signed proposal; sequencing and Phase 0 are re-baselined against the actual prototype state.*
