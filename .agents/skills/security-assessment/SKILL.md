---
name: security-assessment
description: Run a full security assessment of the current codebase. Use when the user asks for a security review, security audit, security check, "how secure is my app", pre-launch security checklist, or wants to know which security standards or compliance frameworks apply to them. Orchestrates the focused review skills and produces a prioritized, evidence-based report.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Security assessment

## Purpose

Assess the security of the application in the current workspace end to end: discover what the platform is, scope the review, classify the data it handles, sketch the threat model, dispatch the relevant focused review skills, and compile canonical findings into one prioritized report a developer can act on.

This is the orchestrator. The focused skills do the deep inspection; this skill decides which of them apply, runs them in a sensible order, and owns the final report.

## Use this skill when

- The user asks for a security review, audit, or assessment of their codebase
- The user asks "is my app secure" or "what should I fix before launch"
- The user asks which standards or compliance frameworks apply to them
- The user wants a repeatable pre-release security check

## Do not use this skill when

- The user asks about one specific area. Use the focused skill directly (review-auth, review-secrets-and-crypto, and so on)
- The user wants fixes applied for findings that already exist. Use fix-and-report
- The user wants a penetration test of a live system. Explain that this collection reviews code and configuration and does not attack running systems

## Ground rules

Before doing anything, internalize these shared references. They govern every step:

- `../../references/safe-testing.md`: authorization boundaries. Static review is authorized; touching running systems or modifying code is not, without approval
- `../../references/evidence-rules.md`: facts vs inference, citation, redaction
- `../../references/finding-format.md`: the one format all findings use
- `../../references/severity-and-confidence.md`: honest ratings
- `../../references/compliance-language.md`: what you may and may not claim

## Workflow

### 1. Inventory the platform

Walk the repository before asking the user anything. Detect and record:

- Languages and frameworks: package.json, requirements.txt, pyproject.toml, go.mod, Gemfile, composer.json, framework config files (next.config.*, nuxt.config.*, django settings, rails config)
- Entry points and boundaries: HTTP routes, API handlers, server actions, background jobs, cron, queues, websockets
- Identity: auth libraries and providers (next-auth, clerk, auth0, supabase auth, firebase auth, cognito, passport, devise, custom JWT code)
- Data stores: database clients, ORMs, migration folders, redis, object storage SDKs
- Cloud and deployment: vercel.json, netlify.toml, Dockerfiles, terraform, CDK, serverless.yml, fly.toml, railway config, GitHub Actions and other CI definitions
- Payments: stripe, paypal, or other payment SDKs; webhook endpoints for them
- AI features: OpenAI, Anthropic, Gemini SDKs; vector databases; RAG pipelines; agent frameworks; tool or function calling
- Automations and integrations: n8n, zapier, make, inbound and outbound webhooks
- Multi-tenancy signals: org or team or tenant columns, tenant middleware, subdomain routing

Produce a short application context summary: what the app is, its trust boundaries, its main data flows, and its external integrations. This summary feeds every later step.

### 2. Classify the data

From models, schemas, migrations, and form handling, determine what the platform stores, processes, or transmits:

- Credentials and tokens
- Personal information (names, emails, addresses, phone numbers)
- Payment card data, or payment handled entirely by a hosted provider
- Health information
- Children's data
- Location, biometric, or other sensitive categories
- Business-confidential data belonging to the user's customers

Note where each category lives and which code paths touch it.

### 3. Ask only what the code cannot answer

Keep it to the minimum. Typical questions, asked only when the code left them open:

- Is payment collection fully hosted by the provider (Stripe Checkout, Payment Links) or does card data touch your code?
- Do you serve users in the European Economic Area, or monitor their behavior?
- Does the platform handle protected health information? For a covered entity or business associate?
- Do you knowingly collect personal information from children?
- Are you preparing for a SOC 2 examination or ISO 27001 certification?
- Is the app multi-tenant, if the code did not make it obvious?
- Any federal contract data or controlled unclassified information?

Record the answers; they drive compliance applicability in step 6.

### 4. Sketch the threat model

Keep it lightweight and concrete. For this specific app: who are the realistic attackers (anonymous internet, authenticated users, malicious tenants, compromised dependencies, malicious content in AI inputs), what are the crown jewels (from step 2), and what are the paths from attacker to jewels (from step 1's boundaries). Use it to prioritize which review skills matter most, and note it in the report.

### 5. Dispatch the review skills

Select from the collection based on what exists in this codebase. Always run:

- review-auth
- review-input-and-api
- review-data-security
- review-secrets-and-crypto
- review-supply-chain

Run when detected or confirmed:

- review-cloud-and-logging: when deployment or IaC configuration is present (almost always)
- review-payments-and-webhooks: when a payment provider is integrated
- review-ai-security: when AI or LLM features, agents, or RAG are present
- review-business-logic: when the app has meaningful domain workflows (commerce, credits, quotas, roles, money movement); recommended for all SaaS

Each skill records findings in the canonical format with IDs in its own area. Keep a running findings list; do not duplicate findings across skills. If two skills surface the same root issue, keep one finding and enrich it.

For large codebases, run the skills as parallel subagents when your environment supports it, each returning findings in the canonical format; otherwise run them sequentially in the order above.

### 6. Map to compliance, if relevant

If step 3 surfaced any compliance context (payments, health data, EEA users, SOC 2 preparation, children's data), run assess-compliance over the canonical findings and application context. It maps existing findings to framework expectations and identifies readiness gaps. It never rereads the codebase from scratch and never claims certification.

If no compliance context applies, note in the report that no specific framework appeared applicable and why.

### 7. Prioritize and report

Hand the findings to fix-and-report to produce the final deliverable, or, if the user only wanted the assessment, compile the report directly:

- Executive summary in plain language: overall posture, the handful of things that matter most, what is genuinely good
- Findings ordered by severity then confidence, each with location, evidence, impact, fix, and validation steps
- Compliance readiness section, if applicable, using only permitted conclusion language
- Limitations: what this review could not see (runtime, infrastructure state, organizational controls) and what would close those gaps

Offer to apply fixes via fix-and-report.

## Output contract

The assessment produces:

1. Application context summary (stack, boundaries, data classification, threat sketch)
2. Canonical findings list, each conforming to `../../references/finding-format.md`
3. A written report as described in step 7, delivered as a markdown file in the workspace unless the user asks otherwise

## Limitations

- Static review of this repository only; runtime behavior, deployed configuration, and other repositories are out of view unless provided
- Absence of evidence is not evidence of absence; missing controls may exist in layers this review cannot see
- Compliance conclusions are readiness signals only, per `../../references/compliance-language.md`

## Plain-language note for the user

Tell the user up front, in one short paragraph: what you are going to do, roughly how long it will take, that you will ask a few questions you cannot answer from code, and that nothing will be modified without their approval.
