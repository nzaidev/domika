---
name: assess-compliance
description: Assess compliance readiness and privacy posture against SOC 2, HIPAA, GDPR, PCI DSS, ISO 27001, CCPA/CPRA, COPPA, NIST 800-171, and CMMC by mapping existing security findings, not by rescanning. Use when the user asks about SOC 2, HIPAA, GDPR, PCI DSS, ISO 27001, CCPA, compliance readiness, privacy review, audit preparation, "do I need SOC 2", or "am I GDPR compliant". Also invoked by security-assessment when compliance context exists.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Assess compliance: framework readiness and privacy review

## Purpose

Determine which compliance frameworks plausibly apply to this application, review the privacy-specific code surfaces the technical skills do not cover, and map the existing canonical findings onto each applicable framework's control expectations. The output is an honest readiness picture: which technical controls are present, which gaps exist, and which evidence a repository can never provide. This skill consumes findings from the technical review skills; it does not rescan the codebase per framework. One real issue stays one finding no matter how many frameworks cite it.

## Use this skill when

- The user asks about SOC 2, HIPAA, GDPR, PCI DSS, ISO 27001, CCPA/CPRA, COPPA, NIST 800-171, or CMMC
- The user asks "do I need SOC 2", "am I GDPR compliant", or about audit preparation or compliance readiness
- The user asks for a privacy review: consent, deletion, data export, retention, tracking
- Invoked by security-assessment when the application context suggests any framework may apply

## Do not use this skill when

- The user wants a technical security review of a specific surface: use the relevant review-* skill; this skill maps its results afterward
- The user needs a legal determination of applicability or a formal audit: this skill cannot provide either; say so and recommend qualified counsel or auditors

## Ground rules

Follow `../../references/compliance-language.md` strictly; it governs every sentence of this skill's output. Also follow `../../references/finding-format.md`, `../../references/evidence-rules.md`, `../../references/severity-and-confidence.md`, and `../../references/safe-testing.md`. Read them if you have not in this session. Net-new privacy findings use ID area `PRIV`; compliance-mapping observations that stand alone use ID area `COMP`. Never claim or imply certification or compliance; use only the permitted conclusion types: `technical_gap_identified`, `technical_control_present`, `evidence_missing`, `readiness_indicator`, `applicability_requires_review`.

## Inputs and discovery

This skill needs three inputs before mapping:

- The canonical findings list from prior technical reviews, including each finding's `control_mappings` and any applicability notes
- Application context: what the product does, who its users are, what data it handles, how payments and auth are integrated
- User answers to applicability questions this skill asks in step 1

If no canonical findings exist yet, do not improvise a compliance scan. Either run the relevant technical skills first or ask the user for permission to run them, then return here to map. The only code inspection this skill performs itself is the privacy review in step 2. Which technical skills matter most depends on the frameworks in play:

- SOC 2 and ISO 27001: most review-* skills contribute; access control, data security, logging, and supply chain findings carry the most weight
- HIPAA and GDPR: review-auth, review-data-security, review-cloud-and-logging, plus this skill's privacy review
- PCI DSS: review-payments-and-webhooks establishes the integration pattern that sets scope
- NIST 800-171 and CMMC: review-auth, review-data-security, review-cloud-and-logging

## Workflow

### Step 1: applicability determination

For each framework, establish the scope trigger from the codebase context and the user's answers. Code can hint (a Stripe SDK, EU locale files, a health-related domain model), but the user's answers decide. Ask rather than assume when the code is ambiguous:

- PCI DSS: does the app store, process, or transmit cardholder data, or does a hosted provider (Stripe Checkout, hosted fields) keep card data out of the app entirely? The integration pattern, taken from the review-payments-and-webhooks results, sets the scope
- HIPAA: does the app handle protected health information (PHI, individually identifiable health data), and is the organization a covered entity or a business associate of one?
- GDPR: does the app offer goods or services to people in the European Economic Area, or monitor their behavior?
- CCPA/CPRA: does the business handle California residents' personal information at the law's revenue or volume thresholds?
- COPPA: is the service directed at, or knowingly collecting data from, children under 13?
- SOC 2 and ISO 27001: is the organization pursuing an examination or certification, usually because customers ask for it? These are voluntary; they apply when pursued
- NIST 800-171 and CMMC: does a federal contract involve controlled unclassified information or defense work?

Mark each framework as `applies`, `may-apply-confirm`, or `does-not-appear-to-apply`, and state the basis for each determination in one sentence. These determinations are informational, not legal advice.

### Step 2: privacy technical review

The one net-new code inspection this skill performs, limited to privacy-specific surfaces. Locate signup and profile forms, the database schema, logging calls, deletion and export endpoints, scheduled jobs, and third-party SDK initialization, then check:

- Data minimization: fields collected or logged that the product visibly never uses; personal data written to logs or analytics that the feature does not need
- Consent and cookie handling: consent code paths, cookie banners wired to real behavior, tracking gated on consent where required, not merely displayed
- Deletion capability: account deletion actually deletes or anonymizes the user's data across all tables and stores, including uploads, search indexes, and third-party systems the code writes to; note backups as a stated limitation, not a silent one
- Export capability: can a user get their data out (data portability), and does the export cover the same tables deletion would touch?
- Retention logic: any code or configuration that expires or purges old personal data, or its absence where the data is clearly time-bounded
- Third-party data sharing visible in code: analytics SDKs, ad pixels, data broker integrations, and what data flows to each; flag identifiers sent before consent
- Privacy policy references versus actual behavior: mismatches observable in code, such as a policy page promising deletion the code cannot perform, or naming fewer third parties than the code contacts

Record issues as canonical findings with `PRIV` IDs. Fill `control_mappings` so step 3 can consume them like any other finding.

### Step 3: mapping findings to frameworks

For each framework marked `applies` or `may-apply-confirm`, walk its control domains and sort the existing canonical findings, using their `control_mappings` fields and applicability notes, into the three evidence-backed buckets: `technical_gap_identified`, `technical_control_present`, `evidence_missing`. Do not re-derive findings per framework; a finding whose mapping is absent gets its `control_mappings` updated in place. For frameworks marked `may-apply-confirm`, label every mapping conditional on the applicability confirmation.

- SOC 2: organize by CC-series Trust Services Criteria
- HIPAA Security Rule: organize by safeguard category, administrative 164.308, physical 164.310, technical 164.312; only the technical safeguards are assessable from code
- GDPR: organize the technical side under Art. 25 (data protection by design) and Art. 32 (security of processing)
- PCI DSS: organize by requirement area, scoped by the integration pattern established with review-payments-and-webhooks; a hosted-only integration removes most requirements from the app's side
- ISO 27001: organize by relevant Annex A controls

### Step 4: external evidence gaps

For each applicable framework, list what it requires that a repository cannot show: written policies, security training, vendor and risk management, business associate agreements (HIPAA), data processing agreements and records of processing (GDPR), risk assessments, penetration tests, monitoring and incident response operations, and audit history. Present this as an honest to-do list beyond code, labeled `evidence_missing`, never as a deficiency of the codebase.

### Step 5: readiness narrative

Per framework, write a short plain-language readiness signal using only the permitted conclusion language, for example: "The review found technical controls that support SOC 2 readiness, and these evidence gaps that need organizational review." Follow it with the top gaps ordered by effort-to-impact: cheap fixes that close real gaps first, large organizational efforts clearly sized as such. A `readiness_indicator` is a directional signal and says so; it never rounds up to a pass.

## Evidence requirements

Per `../../references/evidence-rules.md`. Every applicability determination states its basis. Every mapping entry points at a canonical finding ID or names the missing evidence. A privacy finding names the file, lines, and observed behavior, like any other finding. "Probably needs GDPR work" is not a conclusion.

## False-positive and over-claiming considerations

Overstating is the biggest failure mode of compliance work, in both directions:

- A framework may not apply at all; do not map to frameworks with no established scope trigger. When in doubt, mark `applicability_requires_review` and ask
- Hosted payment and auth providers (Stripe Checkout, Clerk, Auth0) shift many controls to the provider under a shared-responsibility model; describe that split honestly rather than reporting provider-side controls as missing or, worse, claiming the provider covers everything
- The absence of a control in the repo is `evidence_missing` unless the code shows the control should live there; policies and operations legitimately live outside repositories
- Never let a long list of mapped criteria imply the app is "almost compliant"; only the permitted conclusion types appear in output

## Severity guidance

A compliance gap inherits the severity of the underlying technical finding; mapping a finding to a framework never raises or lowers its severity. Pure external-evidence gaps (a missing policy document, an unsigned DPA) are not vulnerabilities and are not rated on the severity scale; list them as `evidence_missing` items. Net-new `PRIV` findings are rated normally per `../../references/severity-and-confidence.md`.

## Standards mappings

Use the framework versions and identifiers listed in `../../references/standards-map.md`: SOC 2 via current AICPA Trust Services Criteria CC-series, HIPAA Security Rule safeguard citations (164.308, 164.310, 164.312), GDPR Art. 25 and Art. 32, PCI DSS v4.0.1, ISO/IEC 27001:2022 Annex A, CCPA/CPRA, COPPA, NIST SP 800-171 r3, and CMMC current program rules. Do not reproduce standard text; cite identifiers and summarize.

## Remediation expectations

Each `technical_gap_identified` maps back to the underlying finding's remediation; fix the finding once and every framework citing it benefits. Each `evidence_missing` item maps to an organizational action, clearly labeled as outside code: draft the policy, sign the BAA, schedule the pentest. Never present an organizational action as a code change or vice versa.

## Output contract

One readiness section per applicable framework, each containing:

- The applicability determination (`applies`, `may-apply-confirm`, or `does-not-appear-to-apply`) and its stated basis
- The three mapping buckets, each entry citing the canonical finding ID or naming the missing evidence
- The external evidence to-do list from step 4
- The readiness narrative from step 5, using only permitted conclusion language

Frameworks marked `does-not-appear-to-apply` get one line stating the basis, no mapping. Net-new privacy issues appear as canonical findings per `../../references/finding-format.md` with IDs NZSEC-PRIV-001 onward; standalone compliance observations use NZSEC-COMP-001 onward.

## Limitations

- A code review supports readiness and can never conclude compliance; certification requires auditors, organizational evidence, and operational history that do not live in a repository
- Applicability determinations here are informational, not legal advice; recommend qualified counsel for legal scope questions and qualified auditors for formal examinations
- Cannot verify policies, training, contracts, vendor management, or runtime operations; these stay `evidence_missing` until the organization provides them
- Deletion and retention checks observe code paths, not production data; backups and replicas may retain data the code no longer references
