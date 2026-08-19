---
name: review-business-logic
description: Review business logic for flaws that let users cheat, game the system, or abuse workflows in the current codebase. Use when the user asks about business logic flaws, abuse, cheating, race conditions, referral or coupon or credit abuse, workflow bypass, quota bypass, double-spending, or "can users cheat". Also invoked by security-assessment for apps with meaningful domain workflows.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review business logic: abuse, cheating, and workflow bypass

## Purpose

Review the application for flaws no scanner can find: code that is technically correct but economically or procedurally abusable. These are cases where every line works as written, yet a user can skip a required step, redeem a coupon twice, refer themselves for credit, or turn a race condition (two requests changing the same thing at once) into free money. The method is always the same: first understand the domain rules, meaning what the product says should be impossible, then hunt for code paths that make it possible.

## Use this skill when

- The user asks whether users can cheat, game the system, or abuse a feature
- The user asks about race conditions, double-submits, or double-spending
- The user asks about referral, coupon, credit, trial, or promotion abuse
- The user asks about skipping steps in onboarding, KYC, approval, or checkout flows
- The user asks about rate limits, quotas, or plan limits being bypassed
- Invoked by security-assessment for apps with meaningful domain workflows

## Do not use this skill when

- The concern is who may call an endpoint at all: use review-auth
- The concern is payment amounts, prices, or webhook handling: use review-payments-and-webhooks (client-computed prices are covered there; this skill covers the surrounding logic such as quantities, coupons, and credits)
- The concern is malformed input or injection: use review-input-and-api

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Findings use ID area `LOGIC`.

## Discovery

Understand the domain before judging the code:

- Find the value: money, credits, points, tokens, quotas, seats, inventory, plan tiers, roles. These are what an abuser would want more of
- Find the multi-step flows: onboarding, KYC (identity verification), approvals, checkout, redemption, upgrades. Map the intended step order and where each step's completion is recorded
- Find the limits: rate limits, usage caps, one-per-user promotions, trial periods, expiry dates
- Enumerate invariants: short statements of what should be impossible, such as "a user cannot spend more credits than they have", "a coupon redeems once", "step 3 requires step 2", "a referral reward requires a distinct new user"
- For each invariant, trace where it is enforced: application code, database constraint, external service, or nowhere. The gaps are the findings

## Checks

### Workflow bypass

- Later steps of multi-step flows are not directly reachable without completing earlier ones; test by asking what happens if the step-3 endpoint is called with no step-2 record
- State transitions are enforced server-side, not by the client only showing one button at a time; back-button and direct-URL step skipping must hit a server-side check
- Approval and review gates cannot be skipped by calling the post-approval endpoint directly

### Race conditions (TOCTOU)

TOCTOU means time-of-check to time-of-use: the gap between checking a condition and acting on it.

- Balance or quota checks followed by debits happen inside a transaction or under a lock, not as separate reads and writes
- Redemptions, claims, and one-per-user promotions survive double-submit and parallel requests; two simultaneous requests must not both succeed
- Limited resources (inventory, seats, spots) are decremented atomically
- Money-moving operations accept idempotency keys (a client-supplied ID that makes retries safe) so retries do not repeat the effect
- Database-level constraints act as the backstop: unique constraints, check constraints (for example balance >= 0), SELECT FOR UPDATE, or serializable transactions. Application-level checks alone are not enough under concurrency

### Quantity and value abuse

- Negative quantities and negative amounts are rejected; a negative amount can flip a debit into a credit
- Totals cannot integer-overflow; very large quantities are bounded
- Money is not computed with floating-point arithmetic; use integer minor units or decimal types
- Units are consistent (cents vs dollars); conversions happen in one place
- Rounding cannot be exploited at scale, for example many tiny transactions each rounding in the user's favor

### Limits and quotas

- Rate, usage, and plan limits are enforced server-side and keyed per identity (user or account), not per session or IP alone
- Quota is checked before the operation and accounted after it, so failures and retries do not leak free capacity
- Where the product cares about free-tier abuse, note whether multiple accounts trivially multiply free allowances; report as needs-review since the tolerance is a product decision

### Incentive abuse

- Referral programs: self-referral, referral chains, and loops between colluding accounts do not net positive reward
- Coupons: stacking rules are enforced server-side, single-use coupons are single-use under concurrency, and expired coupons are rejected server-side
- Trials: signals exist against trial reset via account recreation (email normalization, payment fingerprint, device signals), or the gap is a recorded product decision
- Cashback and credit mechanics cannot loop into net-positive extraction (earn credit, spend credit, refund, keep credit)

### Trust misplacement

- Hidden form fields and client-computed values are treated as untrusted; recompute on the server (prices specifically: review-payments-and-webhooks)
- Role, plan, or tier identifiers in client payloads are ignored in favor of server-side records
- Feature flags and entitlements are checked server-side; client-side checks are display logic, not enforcement

### Time and sequence

- Expired offers, discounts, and entitlements are rejected server-side, not just hidden in the UI
- Deadline enforcement handles timezone edge cases deliberately (whose midnight counts?)
- Old signed URLs or tokens cannot be replayed to reach entitlements that have since expired or been downgraded

### Abuse at the seams

- Bulk and batch endpoints apply the same per-item checks as single-item endpoints
- Import and export paths enforce the validation the UI enforces
- Admin impersonation features are audited (who impersonated whom, when) and scoped

## Evidence requirements

Per `../../references/evidence-rules.md`. For this skill specifically, a finding must state three things: the invariant (the business rule that should hold), the code path that violates it (file and lines), and the concrete sequence of requests that would exploit it. "This flow feels abusable" is not a finding; "two parallel POSTs to /redeem both pass the check at redemptions.ts:41 because there is no unique constraint on (user_id, coupon_id)" is.

## False-positive considerations

- An invariant absent from application code may be enforced by a database constraint, trigger, or migration; check the schema before reporting
- The product may intentionally allow generous behavior (stacking coupons, soft limits, lenient trials); confirm intent before reporting, or mark needs-review
- Single-instance deployments and single-writer queues narrow some race windows but do not eliminate them; report the race, note the mitigation in the finding
- Idempotency may be handled by an upstream gateway or payment provider; record missing evidence rather than asserting its absence

## Severity guidance

- Direct financial gain or unlimited resource extraction (credit loops, double-spend, workflow bypass around payment): high to critical
- Bypass of a compliance-relevant gate such as KYC or approval: high
- Quota or limit bypass with bounded cost: medium
- Theoretical race needing precise timing on low-value resources: low to medium
Confidence is often medium in this area because exploitability depends on runtime behavior (concurrency, deployment topology, provider settings). Rate it separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: CWE-840 (business logic errors), CWE-362 (race condition), CWE-841 (improper enforcement of behavioral workflow); OWASP Top 10 A04:2025 Insecure Design; ASVS 5.0 business logic chapter (V11 or the current edition's equivalent); OWASP API Top 10 API6:2023 Unrestricted Access to Sensitive Business Flows; SOC 2 processing integrity criteria (PI series) where in scope.

## Remediation expectations

Every finding proposes a concrete fix in the app's own framework: the transaction to wrap the check-then-act sequence in, the unique or check constraint to add in a migration, the idempotency key to require, the server-side state check to add to the skipped step. Include a validation step, and for race conditions specifically a concurrent-request test (fire N parallel requests, assert exactly one succeeds). Propose diffs; apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-LOGIC-001 onward, followed by a short plain-language summary: which invariants are solidly enforced, which are violated and how, and which depend on business rules the user must confirm.

## Limitations

- Domain intent is partly unknowable from code; a rule inferred from the code may not match what the business actually intends. Findings that rest on an assumed business rule stay at needs-review until the user confirms the rule
- Cannot observe runtime concurrency, deployment topology, or gateway behavior; race-condition findings usually cap at medium confidence without a reproducing test
- Cannot see enforcement living in external services (payment providers, fraud tools, feature-flag platforms); record as missing evidence
