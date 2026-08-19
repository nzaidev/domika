---
name: fix-and-report
description: Prioritize, fix, verify, and report on security findings produced by the review skills. Use when the user wants to prioritize security findings, fix security issues, apply security fixes, verify fixes, or generate a security report from findings. Also invoked by security-assessment as the final stage.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Fix and report: prioritize, remediate, validate, and write the report

## Purpose

Take the canonical findings produced by the review skills and turn them into outcomes: a prioritized fix plan, minimal reviewable fixes applied with the user's approval, honest validation of each fix, and a final report a developer without a security background can act on. This skill consumes findings; it does not discover new ones.

## Use this skill when

- The user asks to prioritize findings, decide what to fix first, or make a fix plan
- The user asks to fix security issues, apply fixes, or remediate findings
- The user asks to verify or validate fixes that were applied
- The user asks for a security report, summary, or write-up of the review
- Invoked by security-assessment as the final stage of a full review

## Do not use this skill when

- No findings exist yet: run security-assessment for a full review, or a focused review skill (review-auth, review-input-and-api, and so on) for one area, then return here
- The user wants a compliance mapping of findings: use assess-compliance first; this skill will include its output in the report

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/finding-format.md`, `../../references/severity-and-confidence.md`, and `../../references/compliance-language.md`. Read them if you have not in this session. Safe-testing governs every fix applied; compliance-language governs every sentence of the report.

## Inputs

- Canonical findings from the review skills, in the format from `../../references/finding-format.md`
- Application context: framework, how the project is run and tested, anything the user has said about deployment
- Optionally, the output of assess-compliance if it ran

If handed nothing, do not invent findings. Point the user to security-assessment or a focused review skill.

## Step 1: prioritize

- Order findings by severity, then confidence, then fix effort. A confirmed critical outranks everything; among equals, prefer the cheaper fix
- Group related findings that share a root cause into one work item. Five unscoped queries with the same missing tenant check are one work item, not five
- Produce a fix plan: numbered work items, each listing the finding IDs it covers, the proposed fix in one line, and an effort estimate of small, medium, or large
- Include an explicit "fix first" shortlist: typically all criticals plus any highs that are quick wins. Never bury a critical under volume; if there are forty findings and one critical, the critical leads

## Step 2: propose fixes

- For each work item, show the exact diff before applying anything. The user reviews the change, not a description of it
- Keep fixes minimal and reviewable. No drive-by refactors, renames, or style cleanups riding along
- List defense-in-depth suggestions separately from the direct fix, so the user can take the fix without the extras
- Flag any fix that changes architecture (swapping auth providers, changing session models, restructuring data access) and discuss it explicitly before proposing a diff
- Never commit secrets, even ones already in history. A found secret gets flagged for rotation, with rotation steps, instead of a code change that touches its value

## Step 3: apply with approval

Per `../../references/safe-testing.md`, fixes are applied only after the user approves.

- Batch approval is fine if the user grants it ("apply items 1 through 4")
- Destructive or architecture-changing fixes are always approved individually, even inside an approved batch
- Track the outcome per finding: applied, skipped, or deferred, with the user's stated reason where given

## Step 4: validate

After each applied fix:

- Run the finding's validation steps, the project's own test suite, any targeted new tests from the finding's `regression_tests`, and the project's linters and type checkers
- Report results honestly, including failures. If a fix breaks something, say so, roll it back if the user wants, and record the rollback
- Update a finding's status only when validation passes. Never mark fixed on the strength of the diff alone
- If a fix cannot be validated from code (a header only visible at runtime, a setting that takes effect on deploy), mark it applied-but-unverified and state exactly what would verify it

## Step 5: report

Generate the final report as a markdown file in the workspace. Structure:

1. Executive summary in plain language: overall security posture, what was fixed in this session, what remains, and what is genuinely good about the codebase
2. Fix-first list of remaining items, carried over from the fix plan
3. Findings detail, ordered by severity. Each entry covers: what the issue is, where it lives (file and lines), why it matters, how someone could abuse it, the fix, how to verify the fix, and standards references
4. Compliance readiness section, only if assess-compliance ran, using only the language permitted by `../../references/compliance-language.md`
5. Limitations: what the review could not see (runtime behavior, provider dashboards, infrastructure outside the repo)
6. Suggested cadence for re-review: after major features, after dependency updates, and before launches

### Report language rules

- The audience is a developer without a security background; every term is defined on first use (for example, "IDOR, where changing an ID in a request exposes someone else's data")
- No fear language. Severity counts are stated plainly: "two critical, three high" without drama
- Redaction rules from the evidence rules apply throughout the report, including code snippets

## Evidence and honesty requirements

- Never mark a finding fixed without validation passing
- Never quietly downgrade a finding's severity or status; any change is stated with its reason
- The report reflects what actually happened, including fixes that failed, were rolled back, or were skipped

## False-positive handling

If the user disputes a finding and the reasoning holds, set its status to `false-positive` and record the reasoning in the finding. Keep it in the report appendix rather than deleting it, so future reviews see the prior conclusion and skip the rework.

## Severity guidance

This skill does not assign severity; it inherits it from the findings. If prioritization exposes a severity that looks wrong, re-rate it per `../../references/severity-and-confidence.md` and state the change and the reason. Do not lower severity because a fix is hard, and do not average severity and confidence.

## Output contract

- The updated findings list with final statuses per finding: confirmed, fixed and validated, applied-but-unverified, skipped, deferred, or false-positive, each with a one-line reason
- The path to the report file in the workspace
- A short plain-language close: what to do next and in what order

## Limitations

- Validation is limited to what runs locally: tests, linters, type checkers. Runtime behavior, staging, and production are out of reach without explicit approval per safe-testing
- Fixes that live in dashboards or infrastructure settings (provider consoles, DNS, WAF rules) can only be documented as step-by-step instructions, not applied
- The report inherits every limitation of the underlying findings; it cannot be more certain than the evidence behind it
