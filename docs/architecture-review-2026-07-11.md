# Domika — Architecture Review

**Date:** July 11, 2026  
**Scope:** Phases 0–3 codebase per `docs/development-completed.md`  
**Method:** `improve-codebase-architecture` skill — deepening opportunities for testability and AI-navigability

---

## Legend

| Symbol | Meaning |
|--------|---------|
| Module | Anything with an interface and implementation |
| Seam | Where a module's interface lives; behaviour can vary without editing callers |
| Leakage | Invariants or dependencies crossing a seam they shouldn't |
| Deep module | Small interface, large implementation — high leverage and locality |
| Shallow module | Interface nearly as complex as the implementation |

Vocabulary follows the `codebase-design` skill. No `CONTEXT.md` or `docs/adr/` exist yet; domain concepts are inferred from schema, domain modules, and `DEVELOPMENT_PLAN.md`.

---

## Codebase structure (current)

```
src/
  app/
    (app)/          # Authenticated CRM (dashboard, leads, properties, tasks, network, …)
    admin/          # Super-admin (service-role)
    api/            # Webhooks, cron, media upload, documents, public listings JSON
    p/[slug]/       # Public listing pages (no auth)
    sign-in|sign-up|onboarding|invite/
  lib/
    domain/         # 22 server-only modules — primary business logic
    brochures/      # Pure PDF/flyer renderers (tested)
    matching.ts     # Pure scorer (tested)
    auth/           # Clerk session → profile lookup
    supabase/       # admin (service-role), server (anon+cookies), client
    crypto/         # secret-box for token encryption (tested)
    integrations/   # Meta webhook signature helpers
    storage/r2.ts   # Canonical media storage
  components/
    domika/         # App shell used by App Router
    views/          # Legacy prototype screens (mock data, unused by routes)
  proxy.ts          # Clerk middleware (deny-by-default)
supabase/migrations/  # Schema + RLS + network-safe view
tests/              # 8 test files — mostly pure utilities + anon RLS suite
```

**Data flow pattern:** App Router pages → thin `"use server"` actions → `src/lib/domain/*` → `createAdminSupabaseClient()` with manual `.eq("organization_id", …)` scoping. Clerk handles auth; Supabase RLS is authored but largely bypassed on the application path.

**Inferred domain concepts:** Organization (tenant) → Profiles (Clerk-linked, roles) → Leads (pipeline stages, activities, sources) → Properties (owner PII, media) → Listing publications (channels: Domika network, public link, …) + engagement + lead attribution → Property shares (cross-org collaboration) → Tasks + automation rules → Buyer requirements + demand matches → Brochures/contracts → WhatsApp threads/messages + Meta Lead Ads integrations → Notifications.

---

## Deepening candidates

### 1. Enforce the Listing Distribution module

**Strength:** Strong  
**Category:** ports & adapters  
**Files:** `src/lib/domain/listing-distribution.ts`, `src/lib/domain/network.ts`, `src/app/(app)/network/actions.ts`, `src/app/p/[slug]/actions.ts`, `src/app/api/listings/[slug]/route.ts`

**Problem:** `DEVELOPMENT_PLAN.md` §3.2 defines Listing Distribution as the sole write path for publish/share/engage/capture-lead. The module exists with `publishListing`, `shareListing`, `recordListingEngagement`, `captureListingLead` — but only `getPublicListing` is imported anywhere (the JSON API route). All UI writes go through `network.setNetworkPublication`, `network.shareProperty`, and direct `listing_engagement_events` inserts in `network.ts`.

**Solution:** Route all publication/share/engagement/lead-capture mutations through `listing-distribution.ts`. Reduce `network.ts` to read models (feed, share views, collaboration state).

**Benefits:**
- Locality: PII, attribution, and channel invariants concentrate in one module
- Leverage: one interface, N channels (network, public link, future Waiboom)
- Tests hit one seam for publish/capture behaviour

**Before:** `network/actions.ts` and `network.ts` write directly to listing tables; `listing-distribution.ts` is orphaned except for `getPublicListing` on the JSON API route.

**After:** All writes flow through Listing Distribution; `network.ts` serves read projections only.

> ⚠ **Plan conflict:** Contradicts `DEVELOPMENT_PLAN.md` §3.2 as written — the seam was built but never enforced. Worth reopening because publication invariants are scattered today.

---

### 2. Collapse the network module

**Strength:** Strong  
**Category:** in-process  
**Files:** `src/lib/domain/network.ts` (~1,076 lines), `src/lib/domain/promotion.ts`, `src/lib/domain/properties.ts`

**Problem:** One file owns network feed assembly, direct share CRUD, publication upserts, three nearly identical listing view loaders (`getSharedPropertyView`, `getPublicListingView`, `getNetworkListingView`), anonymous lead capture, collaboration state, and share directory. Cover-photo aggregation and recipient-label formatting are duplicated internally and vs. `promotion.ts` / `properties.ts`.

**Solution:** Split into focused modules: `listing-distribution` (writes), `listing-views` or queries inside distribution (reads), `collaboration-shares` (direct shares). Extract shared `coversFor(propertyIds)` helper.

**Benefits:**
- Locality: view loaders testable in isolation
- Interface shrinks per module
- Delete duplicated cover URL loops across 5+ files

---

### 3. Replace service-role with org-scoped adapters

**Strength:** Strong  
**Category:** ports & adapters  
**Files:** `src/lib/supabase/admin.ts`, `src/lib/supabase/server.ts`, all 22 files in `src/lib/domain/`, `src/lib/auth/session.ts`

**Problem:** `createAdminSupabaseClient()` appears in every domain module. `createServerSupabaseClient()` is used once (`listing-distribution.getPublicListing`). Tenant safety depends on each query remembering `.eq("organization_id", …)` — a missed filter is a cross-tenant leak. RLS policies exist in migrations but are not the enforcement layer in app code.

**Solution:** Introduce `createOrgScopedClient(session)` that sets JWT claims or uses a restricted DB role; or a thin repository that always injects `organization_id`. Keep service-role for webhooks/cron/admin only.

**Benefits:**
- Two adapters justify the seam: org-scoped in app, service-role for system paths
- RLS becomes defense in depth
- Authenticated integration tests gain leverage

> ⚠ **Plan conflict:** Diverges from plan §3 "session-bound client" — Clerk identity is accepted, but RLS bypass remains unresolved.

---

### 4. Deepen lead ingress into one module

**Strength:** Strong  
**Category:** in-process  
**Files:** `src/lib/domain/whatsapp.ts`, `src/lib/domain/meta-leads.ts`, `src/lib/domain/network.ts`, `src/lib/domain/leads.ts`, `src/lib/domain/lead-import.ts`, `src/lib/domain/listing-distribution.ts`

**Problem:** Six paths each independently: lookup first pipeline stage, normalize phone, dedupe by phone/email, insert lead, write `lead_activities`. Implementations differ — e.g. `captureListingLead` in listing-distribution does not dedupe, assign publisher, or notify; `capturePublicListingLead` in network does all three. Meta Ads fold-into-existing-lead does not fire automation rules; WhatsApp new-lead does.

**Solution:** Deep module `leads.ingestOrMerge({ orgId, contact, source, sourceMeta, assignTo?, timeline?, attribution? })` called from all ingress paths.

**Benefits:**
- Locality: dedupe/assignment/notification behaviour fixed once
- Ingress modules become thin parsers
- Interface is the test surface

---

### 5. Centralize side-effect dispatch

**Strength:** Worth exploring  
**Category:** in-process  
**Files:** `src/lib/domain/properties.ts`, `src/lib/domain/network.ts`, `src/lib/domain/automation.ts`, `src/lib/domain/matching.ts`, `src/lib/domain/whatsapp.ts`, `src/lib/domain/lead-detail.ts`

**Problem:** `runMatchingForProperty` is invoked from property create/update and network publish — but not from listing-distribution's `publishListing`. `runAutomationRules` runs on stage change and WhatsApp new lead, but not Meta Ads or public listing capture. Both runners swallow errors (`try/catch` + `console.error`), so failures are invisible.

**Solution:** Emit domain events from deep modules (`LeadCreated`, `ListingPublished`, `StageChanged`) with a single dispatcher, or call hooks from consolidated ingress/publication modules.

**Benefits:**
- New publish/ingress paths can't forget matching/automation
- Locality for failure handling and logging

---

### 6. Collapse session status plumbing

**Strength:** Worth exploring  
**Category:** in-process  
**Files:** `src/lib/auth/session.ts`, 18+ pages under `src/app/(app)/`

**Problem:** Every domain function repeats `{ status: "not_configured" | "unauthenticated" | "profile_missing" | "ready" }`. Every page re-implements the same branching (setup screen → redirect sign-in → redirect onboarding).

**Solution:** `requireOrgContext()` helper (redirect-throwing) for pages; domain modules assume authenticated org context and throw typed errors. Shared `<BackendSetupState />` component.

**Benefits:**
- Interface shrinks across domain modules — business data only
- Pages lose duplicated SetupState blocks

---

### 7. Unify the Lead module surface

**Strength:** Worth exploring  
**Category:** in-process  
**Files:** `src/lib/domain/leads.ts`, `src/lib/domain/lead-detail.ts`, `src/lib/domain/lead-import.ts`, `src/app/(app)/leads/actions.ts`, `src/app/(app)/leads/[id]/actions.ts`

**Problem:** Board list + create live in `leads.ts`; stage change, update, notes in `lead-detail.ts`; CSV in `lead-import.ts`; WhatsApp/Meta in separate files. Understanding one lead requires bouncing across 5+ modules.

**Solution:** Single `leads.ts` deep module with subsections, or explicit `leads/` folder: `board.ts`, `detail.ts`, `import.ts`, `ingress.ts` behind one barrel export.

**Benefits:**
- One import surface for the Lead concept
- Clearer ownership and navigation

---

### 8. Unify public listing read projection

**Strength:** Worth exploring  
**Category:** ports & adapters  
**Files:** `src/app/p/[slug]/page.tsx`, `src/app/api/listings/[slug]/route.ts`, `src/lib/domain/listing-distribution.ts`, `src/lib/domain/network.ts`

**Problem:** Consumer HTML page uses `network.getPublicListingView` (admin client + manual safe-view queries + inline engagement insert). JSON API uses `listing-distribution.getPublicListing` (anon client + RPC). Two adapters for the same concept; behaviour can drift.

**Solution:** Both call one `getPublicListingProjection(slug)` in listing-distribution.

**Benefits:**
- Locality: PII exclusion and engagement recording stay consistent
- Two adapters, one implementation

---

### 9. Pull media upload into properties module

**Strength:** Worth exploring  
**Category:** in-process  
**Files:** `src/app/api/properties/[id]/media/route.ts`, `src/lib/domain/properties.ts`, `src/lib/storage/r2.ts`

**Problem:** Photo normalization (sharp, WebP, 1600px, 20-photo cap, R2 upload, DB insert) lives entirely in the route handler. Domain module handles cover/reorder/delete but not ingest. Integration behaviour is untested.

**Solution:** `properties.uploadMedia(propertyId, files)` in domain; route becomes thin auth + FormData parse.

**Benefits:**
- Upload rules testable without HTTP
- Locality: full media lifecycle behind one interface

---

### 10. Generate database types from Supabase

**Strength:** Worth exploring  
**Category:** in-process  
**Files:** `src/lib/database.types.ts`

**Problem:** File header says "Placeholder… Replace with `supabase gen types`". Types may drift from migrations (29+ tables, views, RPCs).

**Solution:** CI step: `supabase gen types` → commit; domain types extend generated rows.

**Benefits:**
- Schema changes caught at compile time

> ⚠ **Plan conflict:** Plan §3 type strategy specifies generated types — not yet followed.

---

### 11. Add integration tests at domain seams

**Strength:** Strong  
**Category:** mock  
**Files:** `tests/` (8 files), domain: `whatsapp.ts`, `meta-leads.ts`, `network.ts`, `listing-distribution.ts`, `automation.ts`, `integrations.ts`

**Problem:** Pure functions are well tested; ingress pipelines, PII stripping, share permission enforcement, and automation dedupe are not. RLS suite covers anon only — authenticated cross-org isolation untested per `development-completed.md`.

**Solution:** Integration tests for: share permission levels, public listing field exclusion, lead dedupe across channels, automation idempotency. Local Supabase stack for authenticated RLS.

**Benefits:**
- Interface is the test surface
- Catches regressions like the `properties_network_safe` anon leak (migration `202607110007`)

| Tested | Not tested (domain/integration) |
|--------|----------------------------------|
| Phone normalization | WhatsApp/Meta webhook ingest |
| CSV import parser | Lead dedupe across sources |
| Brochure layout sanitizer + PDF/flyer | Share permission / owner PII stripping |
| Matching scorer | Automation rule execution |
| Contract `fillTemplate` | Listing publication invariants |
| secret-box encrypt/decrypt | Org-scoped query mistakes |
| Anon RLS exposure | Authenticated RLS cross-tenant |

---

### 12. Consolidate role-guard helpers

**Strength:** Speculative  
**Category:** in-process  
**Files:** `src/lib/domain/integrations.ts`, `src/lib/domain/pipeline.ts`, `src/lib/domain/properties.ts`, `src/lib/auth/session.ts`

**Problem:** Three copies of "authenticated + role !== agent" with slightly different error strings. Interface complexity ≈ implementation (shallow).

**Solution:** Shared `requireRole(session, ["owner", "admin"])` in `src/lib/auth/session.ts`.

**Benefits:**
- Role policy in one place
- Easier to extend for business-unit admin rules

---

### 13. Extract cover URL aggregation

**Strength:** Speculative  
**Category:** in-process  
**Files:** `src/lib/domain/properties.ts`, `dashboard.ts`, `promotion.ts`, `network.ts`, `matching.ts`

**Problem:** Identical "first cover per property_id from property_media ordered by is_cover, position" loop in 5+ places.

**Solution:** `propertyMedia.coversFor(orgId, propertyIds): Map<id, url>` shared helper.

**Benefits:**
- One place to add CDN/transform logic

---

### 14. Retire legacy prototype layer

**Strength:** Speculative  
**Category:** in-process  
**Files:** `src/components/PropFlowApp.tsx`, `src/components/views/*`, `src/lib/data.ts`, `src/lib/types.ts`, `src/app/DomikaWireframePrototype.tsx`

**Problem:** Pre-App-Router mock-data UI still in tree (`price: "$485,000"` display types). Not routed from CRM, but increases navigation noise. Landing `/` renders wireframe prototype, not marketing/redirect.

**Solution:** Archive or delete after confirming no external links; redirect `/` to sign-in or marketing.

**Benefits:**
- Clearer mental model — one UI system, one type system (`database.types.ts`)

---

## Pattern to preserve

**Pure lib + domain split** — already working well.

| Pure lib | Domain module | Tests |
|----------|---------------|-------|
| `src/lib/matching.ts` | `src/lib/domain/matching.ts` | 9 unit tests |
| `src/lib/brochures/*` | `src/lib/domain/brochures.ts` | smoke tests, no DB |
| `src/lib/integrations/meta-webhook.ts` | webhook route handlers | signature verification |

Extend this pattern to lead dedupe scoring, slug generation, and template filling.

---

## Top recommendation

**Enforce the Listing Distribution module — migrate all writes out of `network.ts`.**

**Rationale:**

1. **Plan alignment:** Most explicit architectural decision in `DEVELOPMENT_PLAN.md` (§3.2, §10). The seam was built (`listing-distribution.ts`) but never wired; `network.ts` became the de facto implementation.

2. **Highest leverage:** Publication, sharing, engagement, and public lead capture touch PII boundaries, cross-org visibility, matching triggers, and attribution — the system's riskiest invariants. Today those rules are spread across `setNetworkPublication`, `capturePublicListingLead`, direct `listing_engagement_events` inserts, and an unused shallow `captureListingLead`.

3. **Unblocks other fixes:** Consolidating writes enables a single place to call `runMatchingForProperty`, standardize engagement recording via `recordListingEngagement`, unify slug generation, and route lead capture through one dedupe path. Slimming `network.ts` to read-only views follows naturally.

4. **Testability:** A small intention-based API (`publishListing`, `shareListing`, `recordListingEngagement`, `captureListingLead`) can be integration-tested for channel status, owner-data exclusion, and attribution.

**Second priority:** Introduce org-scoped data access (reduce service-role in domain modules) so RLS becomes real defense-in-depth rather than documentation-only.

---

## ADR status

No files under `docs/adr/`. Architectural decisions live in `docs/DEVELOPMENT_PLAN.md` only. Notable divergences already recorded in `development-completed.md`:

| Decision | Status |
|----------|--------|
| Clerk identity instead of Supabase Auth | Accepted |
| Vercel Cron instead of Edge Functions | Accepted |
| pdf-lib/sharp instead of Chromium | Accepted |
| Listing Distribution seam not enforced | **Unresolved — primary friction** |
| Service-role + manual scoping instead of session-bound RLS client | Partial divergence from plan §3 |

---

## Next step

Pick a candidate to explore via the grilling loop (`/grilling` skill). Recommended starting point: **#1 — Enforce the Listing Distribution module**.
