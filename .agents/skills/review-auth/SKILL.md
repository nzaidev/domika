---
name: review-auth
description: Review authentication, session management, authorization, and multi-tenant isolation in the current codebase. Use when the user asks to check login security, signup flows, passwords, sessions, tokens, JWTs, permissions, access control, roles, admin routes, or whether one customer or tenant can see another's data. Also invoked by security-assessment.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review auth: authentication, sessions, authorization, tenant isolation

## Purpose

Review how the application proves who a user is (authentication), keeps them logged in safely (sessions and tokens), decides what they may do (authorization), and keeps customers' data separated from each other (multi-tenant isolation). These four share the same code surface, so this skill reviews them together in one pass.

## Use this skill when

- The user asks about login, signup, passwords, sessions, tokens, JWT, OAuth, SSO, MFA
- The user asks about permissions, roles, access control, admin protection
- The user asks whether tenants, teams, orgs, or customers are isolated from each other
- Invoked by security-assessment as part of a full review

## Do not use this skill when

- The concern is API input validation or injection: use review-input-and-api
- The concern is how credentials are stored as secrets: use review-secrets-and-crypto (password hashing is covered here; secret storage is covered there)

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Findings use ID area `AUTH`.

## Discovery

Locate the auth surface before judging it:

- Auth provider or library: next-auth/auth.js, clerk, auth0, supabase auth, firebase auth, cognito, passport, devise, django auth, custom implementations
- Session mechanics: cookie configuration, JWT signing and verification, token storage, refresh flows
- Middleware and guards: route middleware, decorators, higher-order components, RLS policies, API gateway config in the repo
- Password handling: hashing library and parameters, reset flows, email verification
- Authorization logic: role checks, permission systems, policy files, ownership checks in queries
- Tenancy: tenant/org/team identifiers in schema, tenant scoping in queries, tenant context middleware
- The routes themselves: enumerate every route/endpoint/server action and note which guard, if any, covers each

## Checks

### Authentication

- Every non-public route or action requires authentication; enumerate exceptions and confirm each is intentionally public
- Password hashing uses a modern algorithm (argon2id, bcrypt, scrypt) with sane parameters; never MD5, SHA-family alone, or reversible storage
- Password reset tokens are single-use, expiring, random (not derived from user data), and invalidated on use and on password change
- Signup and login do not leak account existence beyond what the product accepts (uniform errors, uniform timing where feasible)
- Brute-force protection exists somewhere: rate limiting, lockout, or provider-side protection; record missing evidence if it may live outside the repo
- MFA support and enforcement for privileged accounts, where the product warrants it
- OAuth flows validate state, use PKCE for public clients, verify the token audience and issuer, and do not accept unverified emails as identity proof
- Custom JWT code: algorithm pinned (no alg none, no HS/RS confusion), signature verified on every request, expiry enforced, secrets not hardcoded

### Sessions and tokens

- Session cookies: HttpOnly, Secure, SameSite set deliberately; scoped path/domain; not readable by client JS
- Session or token expiry is finite and enforced server-side; refresh tokens rotate; long-lived tokens are justified
- Logout actually invalidates the session server-side, not just client-side deletion
- Session fixation: session ID rotates on login and privilege change
- Tokens are not stored in localStorage when a cookie alternative exists; if they are, note the XSS amplification and check CSP posture
- CSRF protection on state-changing endpoints when cookies authenticate them: framework CSRF tokens, SameSite plus verification, or double-submit; APIs authenticated by header tokens are exempt but confirm cookies are not also accepted

### Authorization

- Every state-changing endpoint checks not just "is logged in" but "is allowed to do this to this object"
- Object-level checks (IDOR): any endpoint taking an ID (path, query, body) verifies the object belongs to or is shared with the caller. Trace at least the sensitive ones end to end
- Role and permission checks are server-side; client-side hiding of buttons is not access control
- Privilege escalation paths: can a user modify their own role, org membership, or plan through any mass-assignment or self-service endpoint? Check for unfiltered spread of request bodies into updates
- Admin surfaces (routes, panels, feature flags, debug endpoints) are guarded and not merely unlinked
- Authorization logic is centralized enough to audit; flag scattered ad hoc checks as a maintainability risk, informational severity

### Multi-tenant isolation

- Every query touching tenant-owned tables is scoped by tenant ID derived from the authenticated session, never from client-supplied input
- Tenant ID from the URL, headers, or body is validated against the session's tenant membership before use
- With Postgres RLS (including Supabase): RLS is enabled on every tenant table, policies exist for each operation, and the service-role key is never used in request paths that act on behalf of a user
- Background jobs, exports, webhooks, and admin tools respect tenant boundaries too; these are the classic leak paths
- Caching keys include the tenant where responses differ per tenant
- File and object storage paths or buckets are tenant-scoped and access-checked, not merely unguessable

## Evidence requirements

Per `../../references/evidence-rules.md`. For this skill specifically: an authorization finding must name the route, the handler file and lines, and the missing or broken check. A tenant isolation finding must show the query and where tenant scoping should occur. "Auth looks weak" is not a finding.

## False-positive considerations

- A route with no visible guard may be protected by directory-level middleware, a gateway, or platform config; trace the full middleware chain before reporting
- Provider-hosted auth (Clerk, Auth0, Supabase) handles hashing, brute force, and session mechanics; do not report their internals as missing, but do check how the app verifies their tokens and maps them to authorization
- Public endpoints are not findings; confirm intent before reporting
- ORM default scoping or RLS may enforce tenancy invisibly at the query site; check policies and model definitions before calling a query unscoped

## Severity guidance

- Cross-tenant data access, unauthenticated access to sensitive data or admin functions: critical
- IDOR on sensitive objects, auth bypass requiring only an account: high
- Missing CSRF on important actions, weak session expiry, missing brute-force protection: medium, adjust by exposure and data sensitivity
- Hardening gaps with compensating controls: low
Rate confidence separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: ASVS 5.0 chapters V2 (authentication), V3 (session management), V4 (access control); OWASP Top 10 A01:2025 Broken Access Control, A07:2025 Identification and Authentication Failures; OWASP API Top 10 API1, API2, API5; CWE-287, CWE-284, CWE-639, CWE-352, CWE-384 as applicable; NIST CSF PR.AA; CIS Controls 5 and 6; SOC 2 CC6.1 to CC6.3.

## Remediation expectations

Every finding proposes a concrete fix in the app's own framework: the middleware to add and where, the corrected query with tenant scoping, the cookie flags to set, the RLS policy to create. Include a validation step (a request to attempt, a test to write) that proves the fix. Propose diffs; apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-AUTH-001 onward, followed by a short plain-language summary: what is solid, what needs fixing first, and which conclusions depend on things outside the repo.

## Limitations

- Cannot verify provider-side settings (Auth0 tenant config, Clerk dashboard, Supabase dashboard RLS toggles) unless exported into the repo; record as missing evidence
- Cannot verify runtime rate limiting, WAF, or gateway behavior
- Cannot confirm exploitability without running the app; statuses stay at likely unless the code path is fully traceable
