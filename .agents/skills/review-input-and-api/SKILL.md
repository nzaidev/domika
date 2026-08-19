---
name: review-input-and-api
description: Review input validation, injection defenses, API security, incoming webhooks, and error handling in the current codebase. Use when the user asks about input validation, XSS, SQL injection, command injection, SSRF, API security, rate limiting, webhooks, error handling, CORS, GraphQL security, or "can someone hack my API". Also invoked by security-assessment.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review input and API: injection, XSS, SSRF, API boundaries, webhooks, errors

## Purpose

Review every place the application accepts data it did not create: request parameters, bodies, headers, file uploads, URLs it is asked to fetch, and webhook deliveries from other services. Untrusted input that reaches an interpreter (SQL, a shell, HTML, a template engine) without proper handling is injection, and it remains the most common way applications are compromised. This skill also reviews the API boundary itself (validation, rate limits, CORS, GraphQL) and how errors are returned, because those decide how much an attacker learns and how far a malformed request travels.

## Use this skill when

- The user asks about input validation, sanitization, XSS, SQL injection, command injection, path traversal, or SSRF (server-side request forgery, where the server is tricked into fetching a URL an attacker chose)
- The user asks about API security, rate limiting, CORS, mass assignment, GraphQL, or whether someone can hack their API
- The user asks about incoming webhooks from Stripe, GitHub, Twilio, or similar services
- The user asks about error handling, stack traces, or what their API leaks when things fail
- Invoked by security-assessment as part of a full review

## Do not use this skill when

- The concern is who may call an endpoint at all: use review-auth (this skill assumes the caller question is handled there and focuses on what the call carries)
- The concern is outgoing webhooks or secrets used to sign them: use review-secrets-and-crypto for the key handling side

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Findings use ID areas `INPUT` (injection, XSS, parsing, SSRF) and `API` (API boundary, webhooks, error handling).

## Discovery

Locate the input surface before judging it:

- Route and handler inventory: REST routes, GraphQL resolvers, server actions, RPC handlers, and which validation, if any, runs before each
- Database access: ORM vs raw client, any raw query escape hatches (`$queryRaw`, `sequelize.query`, `text()`, string-built SQL or NoSQL filters)
- Rendering: template engines, React/Vue/Svelte components, raw HTML sinks, markdown pipelines, email templates
- Outbound fetches: every server-side HTTP call and whether any part of the URL comes from user input
- Parsers: JSON/YAML/XML parsing, file upload handling, archive extraction, deserialization of anything beyond plain JSON
- Webhook receivers: endpoints called by third parties, their signature verification, and what the payload is used for
- Error handling: global error middleware, catch blocks that return errors to clients, logging of request data

## Checks

### Injection

- SQL and NoSQL queries are parameterized; user input never lands in a query string, an ORM raw-query escape hatch, or a NoSQL filter object built from the request body (operator injection such as `{"$gt": ""}`)
- No user input reaches shell execution (`exec`, `spawn` with `shell: true`, `os.system`, backticks); where a subprocess is unavoidable, arguments are passed as an array and the input is strictly validated
- Template engines never render user input as the template itself (server-side template injection); user data goes in as variables only
- File paths built from user input are resolved and checked against an allowed base directory; reject `..`, absolute paths, and encoded traversal, and verify the check happens after normalization

### XSS

- Output is encoded for the context it lands in: HTML body, attribute, URL, JavaScript, CSS each need different encoding; note where framework auto-escaping already covers this
- Every raw HTML sink is inventoried and justified: `dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `{{{ }}}`, `| safe`, `html_safe`; each must receive sanitized or fully trusted content
- User-supplied HTML or markdown passes through a maintained sanitizer (DOMPurify or equivalent) with a restrictive allowlist; markdown renderers do not have raw HTML enabled unless sanitized afterward
- URLs from user input used in links or redirects are validated for scheme; `javascript:` URLs must not survive
- Content Security Policy (CSP, a browser header that limits where scripts may load from): note whether one exists and how permissive it is; treat it as defense in depth, not the primary control

### Deserialization and parsing

- No unsafe deserialization of untrusted data: `pickle`, Java native serialization, PHP `unserialize`, YAML loaders that construct arbitrary objects (require `safe_load` or equivalent)
- Prototype pollution (JavaScript objects gaining attacker-set properties through keys like `__proto__`): check deep-merge and object-assignment code that consumes request bodies, and known-vulnerable utility versions
- XML parsing disables external entity resolution (XXE) unless explicitly needed and bounded
- Archive extraction validates entry paths (zip slip) and enforces size and file-count limits

### SSRF

- Any server-side fetch whose URL, host, port, or path is influenced by user input validates the destination before connecting
- Allowlists of permitted hosts, not blocklists; blocklists lose to alternate encodings, redirects, and DNS tricks
- Redirects from fetched URLs are re-validated or not followed; cloud metadata addresses (169.254.169.254 and its DNS aliases) are unreachable from these code paths
- Internal-only services are not reachable through user-driven fetch features (URL previews, importers, PDF renderers, image proxies)

### API boundary

- Requests are validated against a schema at the boundary (zod, joi, yup, pydantic, class-validator, or framework equivalent): types, ranges, lengths, formats, and unknown fields rejected or stripped
- Mass assignment: request bodies are never spread wholesale into create or update calls; sensitive fields (role, price, ownerId, isAdmin) are explicitly excluded or picked from an allowlist
- Verb and route hygiene: state changes are not reachable via GET, catch-all routes do not shadow guarded ones, and every unauthenticated endpoint is intentionally public
- Rate limiting and resource limits exist for expensive or abusable endpoints: request body size caps, pagination caps (a client cannot request page size one million), upload size limits, timeout on outbound calls; record missing evidence if limits may live at a gateway
- CORS: no `Access-Control-Allow-Origin: *` combined with credentials, no reflecting arbitrary origins back with credentials allowed; the allowed origin list is deliberate
- GraphQL: introspection disabled or gated in production, query depth and complexity limits, batching and alias abuse bounded, resolvers enforce authorization per object rather than relying on the gateway

### Incoming webhooks

- Signature verification on every webhook endpoint, using the provider's scheme, with a constant-time comparison (a string compare that takes the same time regardless of where it mismatches, preventing timing attacks); never `==` on signatures
- Verification uses the raw request body, since re-serialized JSON breaks signatures; check the framework is not parsing first
- Replay protection: timestamp checked within a tolerance window where the provider supplies one; event IDs tracked for idempotency so a replayed or duplicated delivery cannot repeat a side effect
- Webhook payload contents are treated as untrusted input: validated like any request, and never used to make authorization decisions (a payload claiming `"paid": true` is confirmed against the provider's API or a verified signature, not trusted on its own)

### Error handling

- Stack traces, ORM errors, file paths, and dependency versions never reach clients in any environment; a global handler returns a uniform error shape with a correlation ID
- Error responses do not oracle internal state (different errors for "user exists" vs "wrong password" beyond what the product accepts; database error text never forwarded)
- Error logs capture context without secrets or personal data; request bodies are redacted before logging
- Failures fail closed: an exception in an authorization or validation step must deny the request, not fall through to the success path; check catch blocks that swallow errors and continue

## Evidence requirements

Per `../../references/evidence-rules.md`. For this skill specifically: an injection or XSS finding must show the source (which request field), the sink (file and lines where it is used), and why the path between them lacks protection. A missing rate limit or missing CORS restriction is stated with a `missing_evidence` note when the control could live at a gateway or CDN the repo cannot show.

## False-positive considerations

- React, Vue, Svelte, and modern template engines escape output by default; interpolation in JSX or `{{ }}` is not XSS. Only raw HTML sinks and non-HTML contexts (script blocks, attributes built by string concat) break that guarantee
- ORMs and query builders parameterize by default; a query is only a finding if it uses a raw escape hatch or builds strings. Confirm which API is actually called
- Rate limiting, body size limits, and CORS are often enforced by a gateway, CDN, or platform outside the repo; report as missing evidence, not as absent
- A raw HTML sink fed exclusively by trusted, developer-authored content is informational, not a vulnerability; verify the data source before reporting
- Internal admin tools with no untrusted input have a smaller real attack surface; adjust severity, do not skip the check

## Severity guidance

- SQL injection, command injection, unsafe deserialization, or SSRF reaching internal networks or cloud metadata: critical
- Stored XSS, missing webhook signature verification on endpoints with side effects, mass assignment of privileged fields: high
- Reflected XSS, missing rate limits on expensive endpoints, permissive CORS, verbose errors to clients, missing replay protection: medium, adjust by exposure and data sensitivity
- Missing CSP, missing schema validation where the ORM still parameterizes, hardening gaps with compensating controls: low or informational
Rate confidence separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: ASVS 5.0 chapters V5 (encoding and injection prevention) and the API-related chapters V13 and V14; OWASP Top 10 A03:2025 Injection, plus A05 and A10 where configuration or SSRF applies; OWASP API Top 10 2023 API1 through API10 as relevant (API3 object property level authorization for mass assignment, API4 unrestricted resource consumption for rate limits, API8 security misconfiguration for CORS and errors); CWE-79, CWE-89, CWE-78, CWE-918, CWE-502, CWE-915 as applicable; CIS Controls 16; SOC 2 CC6.1 and CC6.6. Follow `../../references/compliance-language.md`: mappings describe technical gaps and controls, never compliance status.

## Remediation expectations

Every finding proposes a concrete fix in the app's own framework: the parameterized query in its ORM's syntax, the zod or pydantic schema to add and where it attaches, the DOMPurify call replacing the raw sink, the exact signature verification snippet for that webhook provider, the CORS configuration values to set. Include a validation step (a request to attempt, a test to write) that proves the fix. Propose diffs; apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-INPUT-001 onward for injection, XSS, parsing, and SSRF, and NZSEC-API-001 onward for API boundary, webhooks, and error handling, followed by a short plain-language summary: what is solid, what needs fixing first, and which conclusions depend on things outside the repo.

## Limitations

- Cannot verify gateway, CDN, or WAF behavior (rate limits, size caps, header stripping) unless that configuration is in the repo; record as missing evidence
- Cannot confirm exploitability without running the app; taint paths traced only in code stay at likely unless every step is visible
- Cannot see provider dashboards for webhook secrets and delivery settings; verification review covers only the receiving code
