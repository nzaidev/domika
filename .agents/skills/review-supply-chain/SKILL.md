---
name: review-supply-chain
description: Review dependencies, package security, and CI/CD pipeline security in the current codebase. Use when the user asks about dependencies, npm or pip packages, vulnerable packages, lockfiles, dependabot, CI/CD security, GitHub Actions security, the build pipeline, or "are my packages safe". Also invoked by security-assessment.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review supply chain: dependencies, package integrity, CI/CD pipelines

## Purpose

Review the code the application pulls in from outside (dependencies), the ways that outside code could be tampered with on its way in (supply chain integrity), and the automation that builds and ships the application (CI/CD, short for continuous integration and continuous delivery). These share one theme: code and credentials the team did not write by hand, moving through systems the team may not watch closely. This skill reviews them together in one pass.

## Use this skill when

- The user asks about dependencies, npm or pip packages, whether their packages are safe or vulnerable, or lockfiles
- The user asks about dependabot, renovate, dependency updates, or audit results
- The user asks about CI/CD security, GitHub Actions, workflow files, or the build pipeline
- Invoked by security-assessment as part of a full review

## Do not use this skill when

- The concern is secrets hardcoded in application code: use review-secrets-and-crypto (secrets exposed through CI workflows are covered here)
- The concern is cloud infrastructure or deployment target configuration: use review-cloud-and-logging

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Dependency and package findings use ID area `SUPPLY`; pipeline and build findings use ID area `CICD`.

## Discovery

Locate the supply chain surface before judging it:

- Manifests: package.json, requirements.txt, pyproject.toml, Gemfile, go.mod, Cargo.toml, composer.json, including workspaces and monorepo sub-packages
- Lockfiles: package-lock.json, yarn.lock, pnpm-lock.yaml, poetry.lock, uv.lock, Gemfile.lock, go.sum; note any manifest without a matching committed lockfile
- Registry configuration: .npmrc, .yarnrc.yml, pip.conf, pip index settings in CI; note scoped packages and private registry use
- CI/CD definitions: .github/workflows/*.yml, plus GitLab CI, CircleCI, Jenkins, or Buildkite files if present
- Build definitions: Dockerfiles, docker-compose files, build scripts invoked by CI
- Vendored code: directories of third-party source committed into the repo, and where it came from

## Checks

### Dependencies

- Every manifest has a lockfile, and the lockfile is committed. A lockfile pins the exact versions installed so every machine builds the same thing; without one, installs drift and audits are guesses
- Run local audit tools when available: npm audit, pip-audit, osv-scanner. These only read metadata and are allowed per `../../references/safe-testing.md`. Prefer tool output over recalling vulnerabilities from memory
- Flag known-vulnerable versions only from tool output or clear version evidence (a pinned version plus a citable advisory); never from memory alone. Memory of CVE details is unreliable and goes stale
- Distinguish direct dependencies (listed in the manifest) from transitive ones (pulled in by other packages) in every finding; the fix path differs
- Unmaintained or deprecated packages on critical paths (auth, crypto, parsing untrusted input): flag with evidence such as deprecation notices or archived repositories
- Dependency count sanity and multiple packages doing the same job (two HTTP clients, two date libraries): informational; more packages means more surface
- Automated update tooling: a dependabot.yml or renovate.json shows updates arrive routinely; its absence is informational, not a vulnerability, but note it when the lockfile is visibly stale

### Supply chain integrity

- Install scripts: packages that run code at install time (postinstall and similar hooks) execute on every developer machine and CI runner. Note which dependencies declare them and whether installs disable them (ignore-scripts)
- Typosquatting-adjacent names: package names one edit away from popular packages, or that look like internal names published publicly. Verify against the manifest author's likely intent before reporting
- Git URL and file: dependencies pinned to a commit SHA (the full 40-character hash), not a branch or tag that can move
- Dependency confusion: when internal package names are not reserved or scoped, a public package with the same name can be installed instead. Check that internal packages use a scope (@company/) and that .npmrc or pip.conf pins the registry per scope
- Lockfile integrity and provenance fields (integrity hashes, resolved URLs) present and pointing at the expected registry, not an unexpected host
- Vendored code with unknown origin: committed third-party source with no upstream reference, version, or license; flag as unauditable

### CI/CD pipelines (GitHub Actions and equivalents)

- Third-party actions pinned to a commit SHA, not a mutable tag like @v4; a tag can be repointed at malicious code, a SHA cannot
- pull_request_target and workflow_run triggers: these run with repository secrets. If such a workflow checks out the pull request's code (untrusted code plus secrets in one job), that is a serious finding; trace exactly what the workflow checks out and runs
- Secrets exposure to fork PRs: which workflows run on pull_request from forks, and whether any secret or privileged token is reachable from them
- GITHUB_TOKEN permissions: workflows should declare a permissions: block scoped to what each job needs; the default write-all token is overly broad
- Script injection: untrusted input (github.event.pull_request.title, branch names, issue bodies, any github.event.* value an outsider controls) interpolated directly into run: steps lets an attacker inject shell commands. Look for ${{ github.event... }} inside run: blocks; pass such values through env: instead
- Self-hosted runners: note their use; a fork PR running on a self-hosted runner can attack the runner's host and network
- Artifact and cache poisoning: artifacts or caches written by lower-trust workflows and consumed by higher-trust ones (release or deploy jobs) without validation
- Deployment credentials: scope of cloud keys and deploy tokens used in workflows; prefer short-lived OIDC federation over long-lived static keys stored as secrets
- Secrets printed to build logs: steps that echo environment variables, run installs in debug mode, or upload logs as artifacts can leak secrets despite masking; check what each step writes to output
- Branch protection, required reviews, and required checks live in repository settings, not in code; record them as missing evidence rather than assuming either way

### Build

- Dockerfiles pulling base images by mutable tag (FROM node:20) rather than digest (FROM node:20@sha256:...); mutable tags can change under you
- curl or wget piped straight to a shell in builds; the downloaded script runs unreviewed and can change between builds
- Build-time secrets baked into image layers: secrets passed as ARG or copied in and deleted later remain readable in layer history; use build secrets mounts instead

## Evidence requirements

Per `../../references/evidence-rules.md`. For this skill specifically: a vulnerable-dependency finding must cite the package, the installed version from the lockfile, and the advisory or audit tool output naming that version. A workflow finding must name the workflow file, the trigger, and the exact lines showing the risky pattern. "Dependencies look outdated" is not a finding.

## False-positive considerations

- A vulnerability in a dev-only dependency (test runners, linters, build tooling) that never ships to production is real but lower impact; check the dependency's group before rating it like a production exposure
- Audit output includes advisories with no exploitable path in this application; report them, but set severity and confidence from how the package is actually used, not from the advisory's own score
- Actions maintained by trusted orgs (actions/, github/) at a mutable tag are lower risk than unknown third parties at a tag; still worth pinning, but rate accordingly
- pull_request_target is safe when the workflow never checks out or executes the PR's code; confirm what it actually does before reporting
- A missing lockfile in a library (as opposed to an application) can be a deliberate choice; confirm the project type first

## Severity guidance

- Known-exploited vulnerability in a production dependency, or secrets reachable from fork PRs, or pull_request_target executing untrusted code with secrets: high to critical
- Script injection path from outsider-controlled input into a run: step: high
- Unpinned third-party action from an unknown author, missing lockfile in an application, dependency confusion exposure: medium
- Unpinned action from a reputable org, unpinned base image with other controls present: medium, adjust downward with compensating evidence
- Duplicate-purpose packages, dependency count observations: informational
Rate confidence separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: NIST SSDF SP 800-218 practices (notably PO.3, PW.4, PS.1, PS.2 on toolchains, reuse of well-secured software, and protecting code); OWASP Top 10 A03:2025 Software Supply Chain Failures (the 2025 successor to A06:2021 Vulnerable and Outdated Components) and A08:2025 Software or Data Integrity Failures; CWE-1104 (unmaintained third-party components), CWE-829 (inclusion of functionality from untrusted control sphere), CWE-506 (embedded malicious code) as applicable; NIST CSF ID.RA and GV.SC; CIS Control 16; SOC 2 CC8.1 where change management and build integrity are in scope.

## Remediation expectations

Every finding proposes a concrete fix in the project's own tooling: the update command and target version for a vulnerable package, the exact SHA-pinned uses: line for an action, the permissions: block to add to a workflow, the env: rewrite for an injected run: step, the digest-pinned FROM line. Include a validation step: re-run the audit tool, re-read the workflow, or rebuild and inspect layers. Propose diffs; apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-SUPPLY-001 onward for dependency and package findings and NZSEC-CICD-001 onward for pipeline and build findings, followed by a short plain-language summary: what is solid, what needs fixing first, and which conclusions depend on things outside the repo.

## Limitations

- Cannot see repository or organization settings: branch protection, required reviews, runner configuration, secret values and their scopes; record as missing evidence
- Cannot see registry configuration that lives outside the repo (org-level .npmrc, private index settings in CI variables)
- Cannot see runtime software composition analysis or registry-side protections (Dependabot alerts state, npm provenance verification) unless exported into the repo
- Audit tools report what registries know today; absence of findings is not proof of absence
