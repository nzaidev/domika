<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills

Matt Pocock engineering skills are installed under `.agents/skills/`. Invoke them with slash commands in Cursor (e.g. `/tdd`, `/grill-me`, `/to-issues`).

Nick Zarzycki AI security skills ([nzaidev/ai-security-skills](https://github.com/nzaidev/ai-security-skills)) are also installed project-wide. Start with `/security-assessment` for a full review, or run focused checks like `/review-auth` and `/review-secrets-and-crypto`.

### Issue tracker

GitHub Issues via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
