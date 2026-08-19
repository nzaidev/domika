---
name: review-cloud-and-logging
description: Review cloud and deployment configuration, infrastructure as code, containers, security headers, and logging and monitoring in the current codebase. Use when the user asks about cloud security, AWS, Vercel, Cloudflare, GCP, or Azure configuration, deployment security, security headers, IAM, Terraform, Docker security, logging, monitoring, audit logs, or "would I even know if I got hacked". Also invoked by security-assessment.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review cloud and logging: deployment config, infrastructure, containers, observability

## Purpose

Review what the repo says about how the application is deployed and observed: platform configuration files, infrastructure as code (IaC, code that describes cloud resources like servers and storage), container definitions, security headers, and whether security-relevant events are logged without leaking sensitive data. The second half answers a question every team should be able to answer: if someone abused this system, would anything in the code have recorded it?

## Use this skill when

- The user asks about cloud security, deployment security, or a specific platform: AWS, GCP, Azure, Vercel, Netlify, Cloudflare, Fly, Railway, Render
- The user asks about security headers, CSP, HSTS, IAM, Terraform, CloudFormation, CDK, Pulumi, or Docker security
- The user asks about logging, monitoring, audit logs, alerting, or "would I even know if I got hacked"
- Invoked by security-assessment as part of a full review

## Do not use this skill when

- The concern is hardcoded credentials or encryption choices: use review-secrets-and-crypto (this skill notes credentials found in IaC and hands them off)
- The concern is CI/CD pipelines or dependency risk: use review-supply-chain
- The concern is application-level input handling: use review-input-and-api

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Findings use ID areas `CLOUD` (deployment, IaC, containers, network) and `LOG` (logging and monitoring).

## Discovery

Locate the deployment and observability surface before judging it:

- Platform config: vercel.json, netlify.toml, fly.toml, railway config, render.yaml, app.yaml, serverless.yml, wrangler.toml
- IaC: `*.tf` files, `cdk.json` and CDK stacks, CloudFormation templates, Pulumi programs, Ansible or Helm if present
- Containers: Dockerfile, docker-compose files, .dockerignore, Kubernetes manifests
- Security headers: framework middleware (next.config headers, helmet, Django SecurityMiddleware), platform header config, edge or worker code
- Environment handling: how preview, staging, and production environments differ; env var references per environment
- Logging: the logging library and its configuration, every call site that logs, error tracking SDK initialization (Sentry, Rollbar, Bugsnag, Datadog)
- Alerting hints: webhook notifiers, uptime checks, anything in the repo that would tell a human something is wrong

## Checks

### Deployment configuration (CLOUD)

- Security headers configured somewhere: Content-Security-Policy (controls what the browser may load), Strict-Transport-Security (HSTS, forces HTTPS), X-Content-Type-Options, frame-ancestors or X-Frame-Options, Referrer-Policy. They can live in framework middleware, platform config, or edge code; find where before reporting anything missing
- Environment separation: preview or branch deployments must not receive production env vars (database URLs, live payment keys); check per-environment scoping in platform config
- Preview URLs: unauthenticated preview deployments of an app with real data are an exposure; check for preview protection settings or auth applied to non-production
- Serverless function limits: timeouts and memory settings as a denial-of-service surface; very long timeouts on unauthenticated endpoints let one caller burn resources

### Infrastructure as code (CLOUD)

- Storage buckets (S3, GCS, Azure Blob) with public read or public ACLs; distinguish intentional static asset hosting from accidental exposure
- Security groups or firewall rules open to 0.0.0.0/0, especially on management ports (22, 3389) and database ports (5432, 3306, 27017, 6379)
- IAM policies with wildcards: `Action: *` or `Resource: *` grants far more than any workload needs
- Encryption at rest not enabled where the resource supports it (RDS, EBS, S3 bucket encryption settings)
- Database instances flagged publicly accessible
- Hardcoded credentials in IaC files: record the location, redact the value, and defer analysis to review-secrets-and-crypto

### Containers (CLOUD)

- Dockerfile runs as root (no USER instruction, or USER root); a compromised process then owns the container
- Secrets copied into image layers via COPY or ARG/ENV; layers persist even if a later step deletes the file
- Ports exposed beyond what the service needs; docker-compose publishing internal services to the host
- Base images pinned by tag `latest` or unpinned; builds become unreproducible and silently pick up changes
- Missing HEALTHCHECK: informational only

### Network and edge (CLOUD)

- TLS enforced: HTTP to HTTPS redirects configured, HSTS present, no config that serves the app over plain HTTP
- Internal services (admin panels, metrics endpoints, message queues, databases) accidentally exposed by platform or compose config
- Cloud metadata service exposure: server-side request patterns or proxy configs that could reach 169.254.169.254 (the address cloud VMs use to hand out credentials); coordinate with review-input-and-api on SSRF

### Logging (LOG)

- Security-relevant events are actually logged: login success and failure, permission denials, password and email changes, admin actions, payment events, webhook receipt. Trace the handlers for these and confirm an emitter exists
- Logs do not contain secrets, tokens, passwords, full card numbers, or health data; check what objects are passed to loggers, especially whole request or user objects
- Log injection: user input written to logs is sanitized or the logger is structured (JSON), so an attacker cannot forge log lines with newlines or control characters
- Correlation IDs: requests carry an ID through logs so one incident can be traced across services
- Log levels sane in production: debug logging off, and no verbose logging of payloads in production paths

### Monitoring and alerting (LOG)

- Error tracking present and initialized (Sentry or similar), with sensitive-data scrubbing configured
- Anything that would alert on suspicious activity: repeated auth failures, unusual admin actions. This is mostly missing-evidence territory: the repo can show logging emitters, but it cannot show retention, alerting rules, or a SIEM (a system that collects and analyzes logs). Frame findings honestly as "no evidence in the repo" and say what would confirm the control exists

## Evidence requirements

Per `../../references/evidence-rules.md`. For this skill specifically: an IaC finding must cite the resource block, file, and lines. A missing-header finding must state where headers were looked for (middleware, platform config, edge code) before claiming absence. A logging gap must name the event, the handler that should emit it, and confirm no emitter was found on that path. "Logging looks thin" is not a finding.

## False-positive considerations

- Headers may be set at the CDN or in a platform dashboard, invisible in the repo; record as missing evidence with a pointer to where the user should check, not as a confirmed finding
- Framework defaults already set some headers (Next.js, Rails, Django set several out of the box); verify what the framework version emits before reporting a header missing
- A public bucket may be intentional static hosting; check what is stored there before assigning severity
- 0.0.0.0/0 on ports 80 and 443 of a public load balancer is normal; the same rule on a database or SSH port is not
- Logging may flow through infrastructure agents (sidecars, platform log drains) that the repo does not show; missing emitters in code are still worth reporting, but note the possibility

## Severity guidance

- Public storage bucket with non-public data, database or management port open to 0.0.0.0/0, production credentials in preview environments: critical or high
- IAM wildcards, container running as root on an exposed service, secrets in image layers: high or medium by exposure
- Sensitive data in logs: severity follows the data (card or health data high, internal IDs low)
- Missing security header where compensating controls exist, missing HEALTHCHECK, absent correlation IDs: low or informational
Rate confidence separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: ASVS 5.0 configuration and logging chapters; OWASP Top 10 A05:2025 Security Misconfiguration, A09:2025 Security Logging and Monitoring Failures; CWE-16 (configuration), CWE-532 (sensitive information in logs), CWE-117 (log injection) as applicable; CIS Controls 4, 8, 12, 13; NIST CSF PR.PS and DE.CM; SOC 2 CC6.6, CC7.1, CC7.2.

## Remediation expectations

Every finding proposes a concrete fix in the project's own tooling: the exact header block for vercel.json or next.config, the Terraform attribute to change and its value, the Dockerfile USER instruction to add, the log statement to add or the field to redact. Include a validation step: a curl request to check headers, `terraform plan` output to review, a test that asserts the log line exists or the secret does not. Propose diffs; apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-CLOUD-001 and NZSEC-LOG-001 onward per area, followed by a short plain-language summary: what is configured well, what needs fixing first, and an honest answer to "would you know if you got hacked" based only on what the repo shows.

## Limitations

- The deployed state may differ from the repo: config drift, manual console changes, and dashboard settings are invisible here; record as missing evidence
- Cannot verify log retention, alerting rules, on-call response, or any SIEM; the repo shows at most that events are emitted
- Cannot verify runtime behavior of headers, redirects, or WAF rules without a deployed URL to test, and testing follows `../../references/safe-testing.md`
