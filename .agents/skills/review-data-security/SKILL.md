---
name: review-data-security
description: Review database security, data protection, object storage, and file uploads in the current codebase. Use when the user asks about database security, data protection, file uploads, S3 or storage buckets, Supabase or Firebase rules, data exposure, backups, encryption of stored data, or "is my data safe". Also invoked by security-assessment.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review data security: databases, stored data, object storage, file uploads

## Purpose

Review how the application connects to its database, protects the data it stores (at rest means data sitting in storage, as opposed to data moving over the network), controls access to object storage such as S3 or Supabase Storage buckets, and handles files that users upload. These surfaces share the same failure mode, data ending up readable or writable by the wrong party, so this skill reviews them together in one pass.

## Use this skill when

- The user asks about database security, connection credentials, or data protection
- The user asks about encryption of stored data, PII handling, or "is my data safe"
- The user asks about S3, GCS, Azure Blob, Supabase Storage, or Firebase rules
- The user asks about file uploads, downloads, exports, or backups
- Invoked by security-assessment as part of a full review

## Do not use this skill when

- The concern is SQL injection or query construction from user input: use review-input-and-api (this skill covers who may connect and what they may read; that skill covers what queries user input can produce)
- The concern is where the database password itself is stored, or crypto algorithm choices: use review-secrets-and-crypto
- The concern is which user may call which endpoint: use review-auth (export and download authorization checks are covered here because they are data-shaped leak paths)

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Findings use ID area `DATA`.

## Discovery

Locate the data surface before judging it:

- Database access: ORM or client library (prisma, drizzle, sequelize, typeorm, sqlalchemy, activerecord, pg, mysql2), connection string construction, pool config, TLS options
- Schema and migrations: migration directories, schema files, RLS policy definitions, seed and fixture files
- Storage SDKs: aws-sdk S3 client, @google-cloud/storage, @supabase/storage-js, firebase storage, minio; bucket names and policies in IaC (Terraform, CloudFormation, CDK, Pulumi)
- Platform rules: Supabase RLS policies and bucket policies, Firebase security rules files (firestore.rules, storage.rules, database.rules.json)
- Upload handlers: multipart parsing (multer, busboy, formidable, framework built-ins), file type checks, size limits, where files land
- Data lifecycle: export endpoints, backup scripts or references, retention or deletion logic, soft-delete columns

## Checks

### Database access

- The application connects with least-privilege credentials: no superuser or owner role in the app's connection string, no GRANT ALL to the app role in migrations
- Migrations run under a separate, more privileged credential, not the runtime app credential
- Connections to the database use TLS where the database is not co-located; sslmode disable or rejectUnauthorized false on a remote database is a finding
- Connection strings are not hardcoded (report the storage side under SECRET if review-secrets-and-crypto runs; note the least-privilege side here)
- SQL construction from user input belongs to review-input-and-api; do not duplicate injection checks here

### Data at rest

- Sensitive fields (passwords, tokens, health data, payment references, government IDs) are hashed or encrypted in the schema per their sensitivity, not stored plaintext; classify what you find before judging it
- PII (personally identifiable information) does not appear in unexpected tables: logs tables, analytics tables, denormalized copies, job queues
- Soft delete (marking rows deleted instead of removing them) does not leak: queries, exports, and admin views filter deleted rows consistently; check every read path, not just the main one
- Seed and fixture files do not contain real-looking personal data; generated fakes are fine, production exports are not

### Postgres RLS, Supabase, and Firebase

- RLS (row level security, Postgres policies that filter every query by the current user) is enabled on every table exposed through PostgREST or the Supabase client; a table reachable with the anon key and no RLS is a direct exposure
- The anon key appears only in client-facing code paths; the service-role key (which bypasses RLS) appears only in trusted server code, never shipped to a browser or used in request paths acting for a user
- Supabase Storage buckets have policies; public buckets are intentional and hold only public content
- Firebase security rules files exist in the repo, are deployed by config, and are not allow read, write: if true or equivalent wide-open rules
- Firebase rules match the actual data model: every collection or path the app writes has a rule that scopes access to the owning user or role

### Object storage

- Bucket public-access settings in IaC: block-public-access enabled on AWS unless the bucket is intentionally public; no public-read ACLs on buckets holding user data
- Presigned URLs (temporary signed links granting direct storage access) have short expiry, are scoped to a single object and method, and are issued only after an authorization check
- No secrets, database dumps, exports, or backups in buckets with public or overly broad access
- Tenant-scoped key prefixes are enforced by server-side authorization on every access, not by unguessable paths alone; an unguessable URL is not access control

### File uploads

- File type is validated by content (magic bytes, the file's leading identifying bytes) or a vetted library, not by extension or client-supplied Content-Type alone
- Size limits exist at the parser and, where visible, at the proxy; unbounded uploads are an availability issue
- Filenames are sanitized or replaced with generated names; a filename containing ../ must not influence the storage path (path traversal)
- Uploads land outside the web root or in object storage; nothing in the upload path can be executed by the server (no .php, .jsp, or handler-mapped extensions in a served directory)
- Image processing libraries (sharp, ImageMagick, Pillow) are current versions and fed only validated input; note known-risky configurations such as ImageMagick with broad delegates
- Archive extraction guards against zip slip (entries escaping the target directory via ../ names) and zip bombs (small archives expanding enormously); check entry path validation and expansion limits
- Uploads are served with a correct Content-Type, Content-Disposition attachment where rendering is not needed, and from a separate domain or under a strict CSP where feasible, so a malicious HTML or SVG upload cannot script against the main origin
- Malware scanning, if present, is treated as defense in depth, not the primary control; its absence alone is low severity

### Data lifecycle

- Retention: data that should expire (logs with PII, old exports, stale sessions) has a deletion path; indefinite retention of sensitive data is worth an informational finding
- Export and download endpoints re-check authorization per object, including tenant scoping; exports are a classic bypass of per-row checks
- Backups referenced in the repo (scripts, cron, IaC) do not write to world-readable locations and are not committed to the repo itself

## Evidence requirements

Per `../../references/evidence-rules.md`. For this skill specifically: a storage exposure finding must name the bucket or table, the policy or rule file and lines, and what the current setting permits. An upload finding must trace the request from parser to storage path and show which validation is missing. "Uploads look risky" is not a finding.

## False-positive considerations

- Managed database and storage platforms (RDS, Supabase, Firebase, Planetscale, Neon) encrypt at rest by default; do not report missing disk encryption on managed platforms as a gap
- RLS and bucket policies may be configured in a dashboard rather than the repo; absence from the repo is missing evidence, not a confirmed gap. Say what would confirm it (an exported policy list, a dashboard screenshot, supabase db dump output)
- A bucket that looks public may sit behind a CDN with signed access; check the delivery path before reporting
- An upload handler with no visible size limit may be capped by the framework default or a reverse proxy; state the default if known, record missing evidence otherwise

## Severity guidance

- Public bucket containing real user data, Firebase rules wide open, table with real user data reachable via anon key without RLS, service-role key shipped to clients: critical
- Upload path allowing executable content in a served directory, path traversal via filename, export endpoint skipping authorization: high
- Plaintext storage of sensitive fields, missing TLS to a remote database, long-lived broadly scoped presigned URLs, superuser app connection: medium to high by data sensitivity and exposure
- Missing malware scanning, indefinite retention, hardening gaps with compensating controls: low or informational
Rate confidence separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: ASVS 5.0 data protection and file handling chapters; OWASP Top 10 A01:2025 Broken Access Control and A02:2025 as relevant; CWE-434 (unrestricted upload of dangerous file type), CWE-22 (path traversal), CWE-312 (cleartext storage of sensitive information), CWE-538 (file and directory information exposure) as applicable; CIS Control 3 (data protection); SOC 2 CC6.1 and CC6.7. HIPAA 164.312 applies only if health data is in scope, and GDPR Art. 32 only if EU personal data is in scope; map them conditionally and never claim compliance with either.

## Remediation expectations

Every finding proposes a concrete fix in the app's own stack: the RLS policy to create with its SQL, the bucket policy or IaC block to change, the multer or busboy configuration to set, the magic-byte check to add and where. Include a validation step (a request to attempt with the anon key, an upload to try, a policy simulator check) that proves the fix. Propose diffs; apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-DATA-001 onward, followed by a short plain-language summary: what is solid, what needs fixing first, and which conclusions depend on dashboard or platform settings outside the repo.

## Limitations

- Cannot verify dashboard-configured RLS, bucket ACLs, or Firebase rules deployed outside the repo; record as missing evidence
- Cannot verify platform-managed encryption at rest beyond the provider's documented defaults
- Cannot confirm what data production tables actually hold; sensitivity judgments come from schema and code, not live data
- Cannot confirm exploitability without running the app; statuses stay at likely unless the code path is fully traceable
