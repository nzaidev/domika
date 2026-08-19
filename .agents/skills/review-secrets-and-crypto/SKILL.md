---
name: review-secrets-and-crypto
description: Review secret handling and cryptography in the current codebase. Use when the user asks about API keys, secrets, .env files, leaked credentials, environment variables, encryption, hashing, TLS or HTTPS, JWT secrets, or "did I commit a secret". Also invoked by security-assessment.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review secrets and crypto: credentials in the repo, configuration hygiene, cryptography

## Purpose

Review whether credentials (API keys, tokens, passwords, private keys) are kept out of the code and its history, whether configuration keeps secrets server-side with secure defaults, and whether cryptography (encryption, hashing, randomness, TLS) is used correctly. Secrets and crypto share the same failure mode, a value that must stay private becoming readable, so this skill reviews them together in one pass.

## The redaction rule

When you find a secret, NEVER reproduce it: not in findings, not in chat, not in logs, not in proposed diffs. Show the location and a redacted form only, for example `config/prod.yml:12 contains sk_live_...REDACTED`, and flag the credential for rotation. Rotation means issuing a new credential and revoking the old one. This rule overrides any instinct to quote evidence verbatim. See `../../references/evidence-rules.md`.

## Use this skill when

- The user asks about API keys, secrets, tokens, passwords, or private keys in the code
- The user asks about .env files, environment variables, or config files holding credentials
- The user asks "did I commit a secret" or wants leaked credentials found
- The user asks about encryption, hashing, randomness, JWT secrets, TLS, or HTTPS
- Invoked by security-assessment as part of a full review

## Do not use this skill when

- The concern is how passwords are hashed and verified during login: use review-auth (password hashing correctness lives there; how the hashing key or pepper is stored lives here)
- The concern is injection or input validation: use review-input-and-api

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Findings use ID areas `SECRET` (credential exposure and configuration) and `CRYPTO` (cryptographic misuse).

## Discovery

Locate the secret and crypto surface before judging it:

- Config files: .env and variants, config JSON/YAML/TOML, docker-compose, Dockerfiles, CI YAML (.github/workflows, .gitlab-ci.yml), Kubernetes manifests, terraform files
- Less obvious homes for secrets: test fixtures, seed data, documentation, code comments, example requests, notebook outputs
- Pattern sweep for known prefixes: `sk_live_`, `AKIA`, `ghp_`, `AIza`, `xoxb-`, `-----BEGIN PRIVATE KEY-----`, plus generic assignments like `password =`, `api_key =`, `token:` with long literal values
- High-entropy strings (long random-looking values) assigned in config or code
- Git history: if the directory is a git repo, inspect `git log -p` for env and config files and for the same prefixes; a secret removed from the current files can still sit in old commits
- Frontend exposure: variables prefixed `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, and anything imported into client-side code or mobile app config
- Crypto usage: imports of crypto libraries, calls to hash/encrypt/sign/random functions, JWT signing setup, TLS-related settings and service URLs

## Checks

### Secrets in the repo

- No hardcoded API keys, tokens, passwords, or private keys in source files
- No .env file with real values committed; `.gitignore` covers `.env` and variants
- No secrets in config JSON/YAML, docker-compose, CI YAML, test fixtures, seed data, docs, or comments
- Git history is clean: a secret found only in history is still exposed, because anyone with a clone has it. Deleting the file did not fix it. The credential must be rotated, and history rewriting is optional cleanup after rotation, never a substitute for it
- Distinguish real secrets from values that are public by design: Stripe `pk_` publishable keys, the Supabase anon key, and Firebase client config are meant to ship to browsers. Do not report them as leaks, but do check what they can do (for Supabase, whether RLS protects the tables the anon key can reach; for Firebase, the security rules)

### Client-side exposure

- No server secret in a `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` prefixed variable; these prefixes mean "bundle this into the browser build"
- No secret imported into client components, frontend build output, or mobile app config; anything shipped to the client should be treated as public
- Server-only secrets are read only in server code paths (API routes, server actions, backend services)

### Configuration

- A `.env.example` (or equivalent) documents required variables with placeholder values, not real ones
- Debug mode, verbose errors, and admin backdoors are off in production configuration
- Secrets are loaded from environment variables or a secrets manager (a service that stores and injects credentials, like AWS Secrets Manager or Vault) at runtime, not baked into container image layers or bundled files
- Defaults are secure: missing config should fail closed, not fall back to a known default password or key

### Cryptography

- Encryption uses an authenticated mode such as AES-GCM; flag ECB mode, CBC without a MAC (integrity check), DES, and RC4
- No home-rolled crypto: custom cipher constructions, hand-written token schemes, or XOR "encryption" are findings even when no break is demonstrated
- Random values that act as secrets (session tokens, reset tokens, API keys) come from a cryptographic source (`crypto.randomBytes`, `secrets` module), never `Math.random` or a seeded PRNG
- IVs and nonces (per-message random inputs to a cipher) are unique per encryption; a fixed or reused IV with GCM or CTR is a serious finding
- Keys are not hardcoded, not committed, and not derived from a password without a key derivation function (KDF) such as PBKDF2, scrypt, or argon2
- JWT signing secrets are long, random, and loaded from the environment; a short or guessable secret lets anyone forge tokens
- TLS is enforced: HSTS where the app controls headers, and no `http://` service URLs in production configuration
- Signature and secret comparisons (webhook signatures, tokens) use constant-time comparison (`timingSafeEqual` or equivalent), not `==`, which can leak matches through timing
- Password hashing details are review-auth territory; here only confirm the hashing library's key or pepper, if any, is stored safely

## Evidence requirements

Per `../../references/evidence-rules.md`, with the redaction rule above applied strictly. A SECRET finding names the file, line, credential type, and a redacted form; it never contains the value. A history finding cites the commit hash and file path. A CRYPTO finding names the call site and the specific parameter or mode at fault. "There might be secrets somewhere" is not a finding.

## False-positive considerations

- Placeholder values (`your-api-key-here`, `changeme`, `xxx`, obviously fake test values) are not leaks; check whether the string could plausibly be live before reporting
- Example and template files (`.env.example`, sample configs) are expected to contain variable names with dummy values
- Publishable and anon keys are public by design, as above; report only what they permit, not their presence
- High-entropy strings are not always secrets: hashes, encrypted blobs, integrity checksums in lockfiles, and minified code all look random; identify what the value is before reporting
- Secrets in CI YAML referenced as `${{ secrets.NAME }}` or `$VARIABLE` are references, not values; only literal values are findings

## Severity guidance

- Valid production credential in the current repo files: critical; rotate immediately
- Secret found only in git history: high until rotation is confirmed, then informational with the history noted
- Server secret bundled into a client build: severity of the credential itself, since it is effectively published
- Broken crypto guarding sensitive data (ECB, reused nonce, Math.random tokens): high; the same flaw guarding low-value data: medium
- Missing HSTS, weak `.env.example` hygiene, missing pre-commit scanning: low
Rate confidence separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: ASVS 5.0 V6 (cryptography) and the configuration chapter; OWASP Top 10 A02:2025 Cryptographic Failures and A05:2025 Security Misconfiguration as relevant; CWE-798 (hardcoded credentials), CWE-321 (hardcoded cryptographic key), CWE-327 (broken or risky algorithm), CWE-330 (insufficiently random values); NIST CSF PR.DS; CIS Controls 3; SOC 2 CC6.1.

## Remediation expectations

Order matters: rotate first, then remove, then prevent. Rotation is the fix; removal without rotation leaves a live credential in every clone. Then prevention: `.gitignore` entries, a pre-commit secret scanner (gitleaks, trufflehog), and loading from a secrets manager or environment injection. For crypto findings, propose the corrected call in the app's own library (the AES-GCM invocation, the `crypto.randomBytes` replacement, the `timingSafeEqual` comparison) plus a validation step and a regression test. Rotation and any change to running systems are destructive or externally visible actions: propose them, apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-SECRET-001 and NZSEC-CRYPTO-001 onward, followed by a short plain-language summary: what must be rotated now, what is solid, what needs fixing next, and which conclusions depend on things outside the repo.

## Limitations

- Cannot know whether a found credential is still valid without testing it against a live service, which is externally visible and requires explicit approval per `../../references/safe-testing.md`
- Cannot see the secrets manager, CI secret store, or deployment environment; how secrets are injected at runtime is recorded as missing evidence
- History scanning covers only the clone present locally; other branches, forks, and remotes may hold more
- Cannot judge whether a crypto choice matters without knowing data sensitivity; severity assumes the data is worth protecting unless the user says otherwise
