---
name: review-payments-and-webhooks
description: Review payment integration security, checkout and billing logic, and payment webhook handling in the current codebase. Use when the user asks about Stripe, PayPal, payment security, checkout, subscriptions, billing, payment webhooks, PCI, or whether someone could get free stuff or pay the wrong amount. Also invoked by security-assessment when a payment provider is detected.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review payments and webhooks: checkout integrity, card data scope, webhook trust

## Purpose

Review how the application takes money: which payment integration pattern it uses and what that means for PCI DSS scope, whether card data ever touches the app, whether prices and fulfillment can be tampered with from the client, and whether payment webhooks (provider-to-server callbacks that report payment events) are verified before the app trusts them. Payments and their webhooks share one trust boundary, so this skill reviews them together in one pass.

## Use this skill when

- The user asks about Stripe, PayPal, or another payment provider integration
- The user asks about checkout, subscriptions, billing, refunds, or payment webhooks
- The user asks about PCI, card data handling, or "can someone get free stuff"
- Invoked by security-assessment when a payment provider is detected in the repo

## Do not use this skill when

- The concern is non-payment webhooks (GitHub, Slack, CI callbacks): use review-input-and-api
- The concern is where API keys are stored rather than which keys are used: use review-secrets-and-crypto (key usage patterns are covered here; secret storage is covered there)
- The concern is general order logic unrelated to money movement: use review-business-logic

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Findings use ID area `PAY`. Apply `../../references/compliance-language.md` to every PCI statement: this review informs scope, it never declares compliance.

## Discovery

Locate the payment surface before judging it:

- Payment SDK imports and clients: stripe, @stripe/stripe-js, @paypal/checkout-server-sdk, braintree, square, adyen, paddle, lemonsqueezy
- Checkout creation: Checkout Session or Payment Intent creation, PayPal order creation, hosted payment links, client-side element mounting
- Webhook routes: endpoints receiving provider events, their body parsing configuration, and the verification code they run
- Billing models: order, subscription, invoice, plan, and entitlement tables or schemas; price and amount fields and where they are written
- Fulfillment paths: everything that grants product, access, or credit, and what event triggers each
- Key usage: where secret keys, publishable keys, and webhook signing secrets are read, and per-environment separation

## Checks

### Integration pattern determines PCI scope

Determine which pattern the code uses and state it explicitly; this single determination drives most PCI applicability:

- Fully hosted (Stripe Checkout, Stripe Payment Links, PayPal buttons): card data never touches the app; the smallest self-assessment scope
- Embedded elements (Stripe Elements, PayPal card fields): card data goes from the browser directly to the provider; the app serves the page but never receives card numbers
- Server-side card handling: card numbers reach the application's own servers; a much larger scope. Flag this prominently, recommend migrating to a hosted or element-based pattern, and note the scope consequences
State the detected pattern in the summary. SAQ (Self-Assessment Questionnaire, the PCI DSS self-assessment form) selection is a decision for the user and their assessor; the review only informs it.

### Card data in the app

- Search schemas, models, and migrations for card number, PAN (primary account number, the full card number), CVV, and expiry fields
- Search logs, log statements, and analytics calls for card data leakage
- Search forms and API routes for card fields posted to the app's own endpoints instead of the provider
- Storing PAN or CVV anywhere in the app is a critical finding; CVV storage is never permitted even encrypted
- Storing last4, brand, and expiry month/year from provider metadata is normal and is not a finding

### Server-side price integrity

- Amounts and currency are computed server-side from the product catalog; the client request body never supplies the price the charge uses
- Discount and coupon codes are validated server-side: existence, expiry, eligibility, single-use limits
- Quantity and line-item tampering: totals recomputed server-side, negative quantities rejected
- The amount sent to the provider matches the server-computed total, in the expected currency

### Payment webhooks

- Signature verification uses the provider SDK: Stripe `constructEvent` with the webhook signing secret, PayPal webhook verification API or SDK equivalent
- Verification runs on the raw request body. A JSON body parser that runs first breaks Stripe signatures; this is the classic bug, so check middleware ordering explicitly
- Replay tolerance: the SDK's timestamp tolerance is not disabled or set excessively wide
- Idempotent handling: event IDs are deduplicated so a redelivered event cannot grant fulfillment or credit twice
- Fulfillment is triggered only by a verified webhook event or by server-side retrieval of the session or intent with the secret key; never by the client landing on a success redirect URL alone
- Handlers return quickly and tolerate out-of-order delivery; unknown event types are acknowledged, not errored

### Order and subscription state machine

- Status transitions are guarded: an order cannot become fulfilled without first being paid, and cannot be paid twice
- `amount_received` (or the provider equivalent) is checked against the expected amount before fulfillment; a partial payment must not fulfill a full order
- Currency is confirmed, not just the numeric amount; 1000 JPY is not 1000 USD
- Refunds and cancellations require authorization: only the purchaser or an authorized admin, with the ownership check server-side
- Failed and disputed payment events revoke or hold what the payment granted

### Subscription logic

- Entitlement checks read current subscription state at time of use, not a flag set once at signup
- Plan, trial, and status fields cannot be set through mass assignment (client-supplied fields written wholesale into an update); trace update endpoints that touch billing tables
- Downgrades and cancellations actually reduce access, including to data created under the higher plan where the product requires it
- Trial extension paths (new account, deleted and recreated resources) are noted as business decisions if unguarded, informational unless money moves

### Keys

- Secret keys (sk_live, sk_test, and provider equivalents) appear server-side only, never in client bundles or public config
- Publishable keys (pk_live, pk_test) are public by design; do not report them as leaked secrets
- Restricted keys with minimal permissions are preferred over full secret keys where the provider supports them
- Test and live keys are not mixed: live keys in test config or test keys in production config are both findings
- Webhook signing secrets are distinct per environment and not shared across endpoints

## Evidence requirements

Per `../../references/evidence-rules.md`. For this skill specifically: a price-integrity finding must trace the client-supplied value into the charge call. A webhook finding must show the route, the parsing middleware, and the verification code (or its absence). A fulfillment finding must name the event or redirect that triggers it. "Payments look risky" is not a finding.

## False-positive considerations

- Test keys in test fixtures, examples, and CI config are expected; report only live-mode secrets or test keys reachable in production paths
- Fully hosted provider flows already handle card entry, 3D Secure, and much of the validation surface; do not report provider-handled concerns as missing from the app
- A webhook route with no visible verification may be verified in shared middleware; trace the chain before reporting
- Amounts in client requests are fine when they are display-only or are re-derived server-side; confirm the value actually reaches the charge before reporting

## Severity guidance

- Fulfillment without verified payment (unverified webhooks, redirect-only fulfillment) or client-controlled amounts reaching the charge: critical or high depending on exploit prerequisites
- Storing PAN or CVV: critical, and note the PCI scope expansion separately as its own consequence
- Missing idempotency, missing amount or currency verification, mass-assignable plan fields: high or medium by money at stake
- Full secret keys where restricted keys would do, shared webhook secrets across environments: low to medium
Rate confidence separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: PCI DSS v4.0.1 requirement areas 3 (stored account data), 4 (transmission), and 6 (secure software), with an applicability note tied to the detected integration pattern and phrased per `../../references/compliance-language.md` (applicability requires confirmation; never state compliance); OWASP Top 10 A01:2025 Broken Access Control, A04:2025 Insecure Design; OWASP API Top 10 API1, API3, API6; CWE-840 (business logic errors), CWE-345 (insufficient verification of data authenticity); SOC 2 processing integrity criteria (PI1 series) where a SOC 2 examination is in scope.

## Remediation expectations

Every finding proposes a concrete fix in the app's own framework: the raw-body route configuration, the `constructEvent` call with the right secret, the server-side price lookup replacing the client value, the state transition guard. Include a validation step: replay the event with the Stripe CLI (`stripe listen`, `stripe trigger`), or walk a test-mode transaction end to end and confirm fulfillment fires only on the verified event. Propose diffs; apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-PAY-001 onward, followed by a short plain-language summary: the detected integration pattern and what it means for scope, what is solid, what needs fixing first, and which conclusions depend on things outside the repo.

## Limitations

- Cannot see provider dashboard settings: live webhook endpoint configuration, radar or fraud rules, restricted key permissions, or API version pins set in the dashboard
- Cannot verify whether keys found in the repo are currently valid or revoked
- Cannot confirm runtime delivery behavior (retries, ordering) without observing live traffic
- SAQ determination and PCI DSS compliance are decisions for the user and their qualified assessor; this review informs that determination, it does not make it
