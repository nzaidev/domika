---
name: review-ai-security
description: Review LLM and AI feature security in the current codebase, including prompt injection exposure, agent and tool-calling permissions, RAG retrieval isolation, and model output handling. Use when the user asks about LLM security, prompt injection, AI features, chatbots, agents, tool calling, function calling, RAG, embeddings, vector databases, MCP, or "can someone jailbreak my AI". Also invoked by security-assessment when AI features are detected.
license: MIT
metadata:
  author: Nick Zarzycki
  collection: ai-security-skills
  version: 0.1.0
  category: cybersecurity
---

# Review AI security: prompt injection, agents and tools, RAG, output handling

## Purpose

Review how the application uses language models: where untrusted content can steer the model (prompt injection), what a steered model is allowed to do (tools and agents), what data retrieval can pull into a conversation (RAG, short for retrieval-augmented generation), and how model output is treated downstream. Prompt injection, an attack where content in the prompt manipulates the model into ignoring its instructions, is not fully solvable with today's models. So the central review question is not "can the model be tricked" but "what happens when it is": the blast radius.

## Use this skill when

- The user asks about LLM security, prompt injection, jailbreaks, or "can someone hack my chatbot"
- The user asks about AI agents, tool calling, function calling, or MCP (Model Context Protocol, a standard for connecting models to external tools)
- The user asks about RAG, embeddings, vector databases, or AI search over documents
- The user asks what data their AI feature sends to model providers
- Invoked by security-assessment when AI SDK usage is detected

## Do not use this skill when

- The concern is classic API input validation with no model involved: use review-input-and-api
- The concern is API keys for model providers as stored secrets: use review-secrets-and-crypto (how prompts use those providers is covered here)

## Ground rules

Follow `../../references/safe-testing.md`, `../../references/evidence-rules.md`, `../../references/finding-format.md`, and `../../references/severity-and-confidence.md`. Read them if you have not in this session. Findings use ID area `AI`.

## Discovery

Locate the AI surface before judging it:

- Model SDK imports: openai, anthropic, @google/generative-ai, langchain, llamaindex, ai (Vercel AI SDK), and equivalents in other languages
- Vector store clients: pinecone, weaviate, pgvector, chroma, and hosted equivalents
- Tool and function definitions: tool schemas passed to the model, function-calling registries, agent frameworks
- MCP configuration files and any servers they point at
- Prompt construction: system prompt files, template files, string concatenation that builds prompts, anywhere retrieved or user content is interpolated
- Output paths: where model responses are rendered, stored, executed, or passed to other systems

## Checks

### Prompt injection surfaces

- Enumerate every place untrusted content enters a prompt: user messages, retrieved documents, fetched web content, file uploads, email bodies, and tool results. Each is an injection surface
- Distinguish direct injection (the user types the attack) from indirect injection (the attack hides in content the model reads, such as a retrieved document or a scraped page); indirect surfaces are easy to miss and often more dangerous
- System prompt and instructions are separated from user and retrieved content using the SDK's role structure, not concatenated into one string
- Retrieved documents and tool results are framed as data to summarize or reason over, not as instructions to follow; check for delimiters and framing, while noting these reduce but do not eliminate risk
- Because injection cannot be fully prevented, evaluate every surface by asking what an injected model could do from there; that answer drives severity

### Tool calling and agents

- Enumerate every tool the model can invoke and what each can read or change
- Each tool has the least privilege it needs; a summarization agent does not need a delete-record tool
- Destructive or state-changing tools (send email, delete data, spend money, modify records) are gated on explicit human confirmation, not invoked autonomously
- Tool parameters are validated server-side like any untrusted input; an LLM-chosen SQL string is still SQL injection surface, an LLM-chosen path is still path traversal surface
- Authorization is enforced inside the tool implementation using the calling user's identity and permissions, never the service's blanket credentials; a tool that queries with an admin connection on behalf of any user is a confused deputy (a privileged component tricked into using its authority for someone else)
- Agent loops have iteration caps and spending caps so a manipulated or stuck agent cannot run unbounded
- MCP servers: identify which are configured, whether they come from trusted sources, and what permissions their tools carry; a third-party MCP server is third-party code with tool access

### RAG and embeddings

- The vector store enforces tenant isolation: namespace or metadata filtering by a tenant ID derived from the authenticated session, never from client input
- Retrieval is authorization-aware: documents the requesting user cannot read must not enter their context, because anything in context can be surfaced by the model
- Poisoning paths: identify who can write to the corpus; user-writable or web-sourced corpora are indirect injection channels
- Sensitive data is not embedded into shared indexes where other tenants or lower-privileged users can retrieve it

### Output handling

- Model output rendered as HTML or markdown is sanitized or encoded; model output can contain attacker-chosen markup, so this is an XSS surface (cross-site scripting, injecting script into pages other users view)
- Model output used in queries, shell commands, file paths, or URLs is treated as untrusted input with the same validation as user input
- Links and citations in model output are constrained or clearly attributed; an injected model emitting attacker URLs is a phishing channel
- Structured output (JSON, tool arguments) is validated against a schema before use, not trusted because the model was asked nicely

### Data protection

- Identify what user data flows to model providers and check it against the app's data classification; prompts often carry more than intended
- Provider data-use and retention settings (training opt-out, zero data retention) live outside the repo; record as missing evidence if not documented in code or config
- Prompts include the minimum personal data needed; PII that does not change the answer should not be sent
- Logging of prompts and completions: check whether logs capture sensitive user content, where they go, and how long they are kept

### Denial of wallet

- Per-user rate limits and token limits on model calls; model calls cost money per token, so unmetered access is a spending vulnerability, not just an availability one
- Input length is capped before it reaches the model
- Agent loops are bounded (see above) and there is no path where one request fans out into unbounded model calls
- Cost alarms and budgets live in provider dashboards; record as missing evidence if not visible in the repo

### System prompt secrecy

- No secrets, keys, or sensitive business logic in system prompts; treat system prompt contents as user-visible, because extraction techniques reliably leak them
- The app does not depend on the system prompt staying secret for any security property

## Evidence requirements

Per `../../references/evidence-rules.md`. For this skill specifically: an injection finding must name the surface, the file and lines where untrusted content enters the prompt, and what the model can do from there. A tool finding must name the tool, its implementation file, and the missing check. "The AI might be jailbroken" is not a finding.

## False-positive considerations

- Provider-side safety features (moderation endpoints, built-in refusals) reduce some risks; do not report their absence in code as missing when the provider supplies them, but do not treat them as injection protection either
- Some prompts intentionally include instructions from content, such as "summarize this document including any action items it requests"; confirm intent before flagging framing as a defect
- Sandboxed tool execution (containers, read-only credentials, allowlisted commands) genuinely reduces blast radius; check for it before rating tool exposure
- A tool that looks dangerous may be gated by confirmation flows in the UI layer; trace the full invocation path before reporting

## Severity guidance

Rate by blast radius, not by whether injection is possible (assume it is):

- Injection reaching an agent with destructive tools and broad credentials, or cross-tenant retrieval from a shared vector store: critical
- Injection reaching tools that read sensitive data or send messages, unvalidated model output in queries or rendered HTML: high
- Denial of wallet with no limits, sensitive data in prompts beyond classification: medium, adjust by data sensitivity and exposure
- Injection into a stateless chat with no tools and no sensitive context: low to medium
Rate confidence separately per `../../references/severity-and-confidence.md`.

## Standards mappings

Cite in findings per `../../references/standards-map.md`: OWASP LLM Top 10 current edition, especially LLM01 prompt injection, LLM02 sensitive information disclosure, LLM05 improper output handling, LLM06 excessive agency, plus LLM04, LLM08, and LLM10 where relevant; NIST AI RMF functions (Govern, Map, Measure, Manage) at a high level for programmatic gaps; CWE-77, CWE-79, CWE-89 where output handling concretizes into command injection, XSS, or SQL injection; ASVS 5.0 V5 (validation and encoding) where model output feeds classic sinks; OWASP Top 10 A03:2025 where applicable.

## Remediation expectations

Every finding proposes a concrete fix in the app's own framework: the privilege separation to introduce (per-user credentials passed into tool implementations), the confirmation gate to add before destructive tools, the output encoding or sanitizer to apply where model output renders, the tenant and permission filter to add to the retrieval query, the schema validation on structured output, the token and spending caps to set. Include a validation step that proves the fix. Propose diffs; apply only with user approval per `../../references/safe-testing.md`.

## Output contract

Findings in the canonical format from `../../references/finding-format.md`, IDs NZSEC-AI-001 onward, followed by a short plain-language summary: what is solid, what needs fixing first, and which conclusions depend on provider settings outside the repo.

## Limitations

- Model behavior is probabilistic; a review can find structural exposures but cannot prove a system resists injection, and no review should claim it does
- Adversarial testing (crafted injection prompts) belongs in a safe non-production environment per `../../references/safe-testing.md`; code review alone cannot substitute for it, nor can tenant-isolation retrieval tests be confirmed without running them
- Provider-side settings (data retention, training opt-out, safety features, spending limits) are invisible from the repo; record as missing evidence
