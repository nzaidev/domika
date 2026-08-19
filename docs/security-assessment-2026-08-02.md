# Domika Security Assessment

**Date:** 2026-08-02  
**Scope:** Static review of this repository (code, migrations, CI, config). No live penetration testing, no production environment changes.  
**Assessor:** `/security-assessment` orchestrator (focused review skills applied inline)

---

## Executive summary

Domika is a **multi-tenant real-estate CRM** (Next.js 16, Clerk auth, Supabase Postgres, Cloudflare R2 media) with solid fundamentals: deny-by-default auth middleware, signed Meta webhooks, tenant-scoped domain queries, a private documents bucket with org-prefix checks, and an RLS exposure test suite for the anon key surface.

The **highest-priority gaps** before a broader launch are:

1. **Property photos are public-by-path** — the media bucket and `/api/media` proxy serve objects without checking publication status; unpublished inventory is protected only by UUID obscurity.
2. **Secrets hygiene** — `.env.example` ships a non-placeholder `CRON_SECRET`; integration tokens may be stored **plaintext** if `ENCRYPTION_KEY` is unset in production.
3. **Defense-in-depth** — virtually all server code uses the Supabase **service role**, so Postgres RLS is not enforcing tenant boundaries for app traffic; isolation depends on every query including `organization_id`.

Overall posture: **reasonable for a pre-launch internal product**, with a short list of fixes that materially reduce real-world risk. Several controls (rate limiting, CSP, CI secret/dependency scanning, RLS tests in CI) are not yet in place.

---

## Application context

| Area | Detail |
|------|--------|
| **Product** | SaaS CRM for real-estate agencies: leads, pipeline, properties, brochures, WhatsApp/Meta Lead Ads integrations, agent network sharing |
| **Stack** | Next.js 16 (App Router), React 19, TypeScript, Clerk (`@clerk/nextjs`), Supabase (Postgres + storage), Cloudflare R2, Vercel deployment |
| **Auth boundary** | Clerk session on all routes except sign-in/up, webhooks, cron, public listings (`/p/*`), and media proxy (`/api/media/*`) |
| **Data stores** | Supabase Postgres (multi-tenant via `organization_id`), R2 + public custom domain for property photos, private `documents` bucket for contracts/WhatsApp attachments |
| **External integrations** | Meta (WhatsApp Cloud API, Lead Ads webhooks), Clerk; OAuth placeholders for Google/Microsoft email (not wired) |
| **Payments** | Manual billing only (`billing_status` field); no Stripe or card handling in codebase |
| **AI/LLM** | None detected |
| **Multi-tenancy** | Yes — org-scoped tables, roles (`owner` / `admin` / `agent`), cross-org reads via `properties_network_safe` view |

### Trust boundaries

```
Internet ──► Clerk (auth) ──► Next.js server (domain layer) ──► Supabase service role
                │                      │
                │                      ├──► R2 (public domain + /api/media fallback)
                │
Public ─────────┴──► /p/[slug] (published listings only, RPC)
                └──► /api/webhooks/* (HMAC verified)
                └──► /api/cron/* (Bearer CRON_SECRET)
```

### Data classification

| Category | Examples in Domika | Where |
|----------|-------------------|--------|
| **Credentials / tokens** | Meta/WhatsApp access tokens, CRON_SECRET, service role key, R2 keys | Env vars; tokens in `whatsapp_accounts`, `meta_lead_pages` |
| **Personal information** | Lead names, phones, emails; agent profiles | `leads`, `profiles`, WhatsApp tables |
| **Owner PII (high sensitivity)** | Owner name, phone, email, address, notes | `properties` columns; gated on network shares |
| **Business-confidential** | Pipeline, contracts, buyer requirements | Org-scoped tables |
| **Payment card data** | None — billing is manual | N/A |
| **Health / children's data** | None observed | N/A |

---

## Threat model (lightweight)

| Attacker | Goal | Realistic paths |
|----------|------|-----------------|
| Anonymous internet | Scrape leads, spam public forms, enumerate media | `/p/[slug]` inquiry form, `/api/media/{path}`, R2 public URLs |
| Authenticated agent (tenant A) | Read tenant B data | IDOR via missed `organization_id` filter (service role bypasses RLS) |
| Malicious tenant | Abuse onboarding, flood org creation | Self-service `createOrganizationWithOwner` |
| Compromised dependency | RCE, credential theft | npm supply chain |
| Meta platform | Webhook replay/forgery | Mitigated by HMAC (`X-Hub-Signature-256`) |

**Crown jewels:** owner PII on properties, WhatsApp/Meta tokens, cross-tenant lead/property data, private documents (IDs, contracts).

---

## Findings

Findings are ordered by severity, then confidence. IDs encode the review area.

---

### DATA-001 — Unpublished property photos are publicly readable by storage path

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Confidence** | Confirmed |
| **Area** | Data security |

**Location**

- `supabase/migrations/202607030005_property_media_bucket.sql` — bucket marked `public: true`
- `src/lib/storage/r2.ts`, `src/lib/media.ts` — R2 served from public custom domain
- `src/app/api/media/[...path]/route.ts` — unauthenticated proxy, no publication check

**Evidence**

Migration explicitly sets public read on `property-media`. Upload paths are `{organizationId}/{propertyId}/{uuid}.webp` (`src/app/api/properties/[id]/media/route.ts`). The media route is listed as public in `src/proxy.ts` and downloads any valid path via admin/R2 credentials without verifying the property is published.

**Impact**

Anyone who obtains or guesses a storage path (browser devtools, cached HTML, leaked brochure, referrer logs) can view photos for **draft/unpublished** listings — potentially including interiors the agency has not marketed yet.

**Fix**

- Serve marketing photos only through a publication-aware proxy (check `listing_publications.status = 'published'` or org membership), **or**
- Store unpublished media in a private bucket/prefix and use signed URLs for authenticated users only.
- Keep R2 public domain for published assets only (separate prefix or bucket).

**Validation**

- Upload photo to unpublished property; confirm direct R2/`/api/media` URL returns 404 without auth.
- Publish listing; confirm same URL works publicly.

---

### SEC-001 — Example `CRON_SECRET` in `.env.example` appears to be a real value

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Confidence** | Confirmed |
| **Area** | Secrets |

**Location:** `.env.example` line 26

**Evidence**

```
CRON_SECRET=an40rs0gJthpzf4ej8tamB1e+YTdH54OT01X1MOiNXk=
```

This is a high-entropy string, not a placeholder like `your-cron-secret-here`. If the same value was ever copied into Vercel production, `/api/cron/reminders` could be invoked by anyone who read the repo.

**Impact**

Unauthorized cron invocation: task-reminder spam notifications, unnecessary DB load.

**Fix**

- Replace with an obvious placeholder in `.env.example`.
- Rotate `CRON_SECRET` in all deployed environments immediately if this value was ever used.
- Add secret scanning to CI (see SUPPLY-001).

**Validation**

- `grep` deployed env / Vercel dashboard; rotate and confirm old bearer fails with 401.

---

### SEC-002 — Integration tokens stored as plaintext when `ENCRYPTION_KEY` is unset

| Field | Value |
|-------|-------|
| **Severity** | High (production) / Low (local dev) |
| **Confidence** | Confirmed |
| **Area** | Secrets & crypto |

**Location:** `src/lib/crypto/secret-box.ts`, `src/lib/domain/integrations.ts`

**Evidence**

`encryptSecret()` returns plaintext when `ENCRYPTION_KEY` is missing, logging a one-time console warning. WhatsApp/Meta tokens are written through this path.

**Impact**

Database backup leak or SQL exposure yields usable Meta API tokens → message send, lead ingestion, account abuse.

**Fix**

- Require `ENCRYPTION_KEY` in production (fail fast at startup or on first token write).
- Document generation in `.env.example` (already present) and deployment checklist.

**Validation**

- Deploy without key → app refuses token storage or fails health check.
- With key → DB values use `enc:v1:` prefix (see `tests/secret-box.test.ts`).

---

### AUTH-001 — All application DB access uses service role; RLS is not a safety net

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Confidence** | Confirmed |
| **Area** | Auth / tenant isolation |

**Location:** `src/lib/supabase/admin.ts` — used across domain layer; `createServerSupabaseClient()` only used for `get_public_listing` RPC.

**Evidence**

Session resolution (`src/lib/auth/session.ts`) queries profiles via service role. Every domain module follows the pattern `createAdminSupabaseClient()` + `.eq("organization_id", session.profile.organization_id)`.

**Impact**

A single missed org filter in a new endpoint becomes a **cross-tenant data leak** with no DB-layer backstop. RLS policies exist for direct PostgREST/anon access but not for service-role app traffic.

**Fix**

- Keep rigorous code review / lint rule for queries without org scope.
- Consider a thin repository wrapper that requires `organizationId` for all tenant tables.
- Optionally migrate hot paths to Supabase client with Clerk JWT so RLS applies (larger refactor).

**Validation**

- Code audit checklist on PRs; periodic grep for `.from("leads")` without nearby `organization_id`.

---

### API-001 — Public `/api/media` proxy has no authorization or publication gate

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Confidence** | Confirmed |
| **Area** | Input & API |

**Location:** `src/app/api/media/[...path]/route.ts`, `src/proxy.ts`

**Evidence**

Route is intentionally public (social crawlers). Handler only rejects `..` paths; otherwise streams from R2/Supabase admin.

**Impact**

Same as DATA-001; also amplifies any future private object stored under predictable paths in the shared bucket.

**Fix**

Align with DATA-001 remediation; at minimum log/alert on access to paths not linked from published listings.

**Validation**

Same as DATA-001.

---

### API-002 — Public listing inquiry form has no rate limiting or CAPTCHA

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Confidence** | Confirmed |
| **Area** | Input & API / business logic |

**Location:** `src/lib/domain/network.ts` — `capturePublicListingLead`, `src/app/p/[slug]/actions.ts`

**Evidence**

Honeypot field (`website`) only. No IP rate limit, Turnstile, or similar. Creates/updates leads via service role.

**Impact**

Lead spam, notification fatigue, CRM pollution, potential harassment of agents.

**Fix**

- Vercel WAF / edge rate limit on `/p/*` server actions.
- Cloudflare Turnstile or hCaptcha on inquiry form.
- Per-slug throttling in domain layer.

**Validation**

- Script 100 submissions/min → expect 429 or CAPTCHA challenge.

---

### SUPPLY-001 — CI lacks dependency and secret scanning

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Confidence** | Confirmed |
| **Area** | Supply chain |

**Location:** `.github/workflows/ci.yml`

**Evidence**

CI runs lint, typecheck, test, build only. No `npm audit`, Dependabot config, or secret scan (e.g. gitleaks, GitHub secret scanning alert review).

**Impact**

Vulnerable dependencies or committed secrets may reach production unnoticed.

**Fix**

- Enable GitHub Dependabot / `npm audit` in CI (fail on high/critical).
- Add gitleaks or `trufflehog` pre-commit or CI step.
- Enable GitHub secret scanning on the org repo.

**Validation**

- Introduce test secret in PR → CI fails.

---

### SUPPLY-002 — RLS exposure tests skip in default CI

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Confidence** | Confirmed |
| **Area** | Supply chain / data security |

**Location:** `tests/rls-exposure.test.ts`

**Evidence**

Suite uses `describe.skipIf(!hasEnv)` — without Supabase anon key in CI, anon-surface regressions (like the `properties_network_safe` leak fixed in migration `202607110007`) are not caught automatically.

**Impact**

Future migration could re-expose tenant data to the public anon key without CI failure.

**Fix**

- Run RLS tests in CI against a disposable Supabase branch or local Supabase (`supabase start`) with anon key injected from secrets.
- Block merge if anon can read private tables.

**Validation**

- CI job runs `tests/rls-exposure.test.ts` green on main.

---

### CLOUD-001 — No explicit security headers (CSP, HSTS) in app config

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Confidence** | Likely |
| **Area** | Cloud & logging |

**Location:** `next.config.ts`, `vercel.json`

**Evidence**

No `headers()` configuration for CSP, `Strict-Transport-Security`, `X-Frame-Options`, etc. May partially come from Vercel defaults — not verified in this static review.

**Impact**

Reduced XSS/clickjacking defense if Clerk/session cookies are ever readable by script (defense in depth).

**Fix**

- Add Next.js `headers` with sensible CSP (Clerk domains allowlisted), HSTS, frame ancestors.

**Validation**

- `curl -I https://production-domain` shows expected headers.

---

### AUTH-002 — `CLERK_WEBHOOK_SECRET` documented but no webhook handler

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Confidence** | Confirmed |
| **Area** | Auth |

**Location:** `.env.example`; no `src/app/api/webhooks/clerk` route

**Evidence**

Profile lifecycle is handled via onboarding/invite flows using service role inserts. No sync for Clerk user deletion/deactivation.

**Impact**

Deactivated Clerk users with valid session edge cases; orphaned profiles remain `active`; no automatic offboarding.

**Fix**

- Implement Clerk webhook (`user.deleted`, `user.updated`) to deactivate profiles.
- Or remove unused env var from example until implemented.

**Validation**

- Delete user in Clerk → profile `active = false` within webhook latency.

---

### BL-001 — Unlimited self-service organization creation

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Confidence** | Confirmed |
| **Area** | Business logic |

**Location:** `src/lib/domain/onboarding.ts` — `createOrganizationWithOwner`

**Evidence**

Any authenticated Clerk user without a profile can create a new org (default `max_users: 100` from schema).

**Impact**

Free-tier abuse, support noise — not a direct data breach.

**Fix**

- Invite-only mode, email domain allowlist, or manual approval for production SaaS.

---

## Positive observations

- **Deny-by-default middleware** (`src/proxy.ts`) with explicit public exceptions and API route matcher including extension paths.
- **Meta webhooks**: HMAC-SHA256 with `timingSafeEqual` (`src/lib/integrations/meta-webhook.ts`).
- **Cron auth**: Bearer comparison uses `timingSafeEqual` (`src/app/api/cron/reminders/route.ts`).
- **Documents bucket**: Private; `/api/documents` enforces session + org prefix (`src/app/api/documents/[...path]/route.ts`).
- **Network PII**: `properties_network_safe` view excludes owner fields; migration `202607110007` revoked anon/authenticated access.
- **Invitation accept**: Email must match Clerk verified addresses (`src/lib/domain/invitations.ts`).
- **Integration tokens**: UI never returns raw token values (`src/lib/domain/integrations.ts`).
- **Public listing RPC**: `get_public_listing` excludes owner/address columns.
- **Error logging**: `instrumentation.ts` avoids logging request bodies/headers.
- **Prior security work**: Comment in `listing-distribution.ts` documents removal of cross-tenant write landmine.

---

## Compliance readiness

**No specific certification target was stated.** Based on code alone:

| Framework | Relevance | Readiness signal |
|-----------|-----------|------------------|
| **GDPR** | Applies if EU/EEA users or monitoring | Partial — lawful basis, DPA, retention, and erasure flows not visible in code; owner/lead PII processing needs privacy policy and data subject request process |
| **PCI DSS** | Not applicable | No card data handled |
| **SOC 2 / ISO 27001** | If pursuing enterprise sales | Early — logging, access reviews, encryption-at-rest for tokens, and CI controls would be expected gaps |
| **Local LATAM privacy** | Likely (Peru/LatAm real-estate context) | Privacy notice and consent for lead capture on public forms not reviewed in code |

This assessment does **not** certify compliance. It flags engineering controls that auditors typically ask about.

---

## Open questions (code could not answer)

Please confirm when convenient — answers refine compliance section only:

1. Do you have users in the **EU/EEA** (GDPR)?
2. Is **`ENCRYPTION_KEY` set in production** today?
3. Was the **`.env.example` CRON_SECRET** ever used in a deployed environment?
4. Is the product **invite-only** or open self-signup for all agencies?

---

## Limitations

- Static analysis of this repo only; Vercel/Supabase/R2/Clerk dashboard settings not inspected.
- No dynamic testing against production (per safe-testing rules).
- RLS policies assume Clerk JWT integration for direct client access; app primarily bypasses via service role.
- Organizational controls (background checks, incident response, backups encryption) out of scope.

**To close gaps:** staging penetration test, production config review, enable RLS tests in CI, rotate secrets if exposed.

---

## Recommended fix order

1. **SEC-001** — Rotate cron secret; fix `.env.example` (minutes)
2. **SEC-002** — Require `ENCRYPTION_KEY` in production (hours)
3. **DATA-001 / API-001** — Publication-aware media serving (1–2 days)
4. **API-002** — Rate limit public lead capture (hours)
5. **SUPPLY-001 / SUPPLY-002** — CI hardening (half day)

---

## Next step

Run **`/fix-and-report`** to apply fixes for selected findings (with your approval per finding), or ask for a deep dive on one area (`/review-auth`, `/review-data-security`, etc.).
