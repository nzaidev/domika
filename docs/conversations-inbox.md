# Conversaciones — omnichannel inbox

A Kommo-style inbox **inside** Domika: agents connect their channels, chat in
the app, and convert any conversation into a lead. Channel transport is
**Zernio** (an official WhatsApp/Meta provider) — no Meta developer app needed.

## Channels

WhatsApp, Instagram, and Facebook (Messenger). The data model uses the
`message_channel` Postgres enum (`whatsapp | instagram | messenger`), so all
three are first-class. Adding more (Telegram, etc.) needs an
`ALTER TYPE public.message_channel ADD VALUE …` migration.

## How it works

```
Agent → "Conectar {canal}" → Zernio embedded signup (Meta) → callback
      → channel_connections row + webhook registered
Customer message → Zernio → POST /api/webhooks/zernio (HMAC verified)
      → ingest → whatsapp_threads / whatsapp_messages (inbox-first, no lead yet)
Agent opens /conversations → reads, replies (→ Zernio send), and
      "Convertir en prospecto" → creates the lead + links the thread
```

- **Inbox-first**: an inbound message does **not** auto-create a lead. It shows
  in the inbox; the agent converts it when it's worth tracking.
- Conversations reuse the existing channel-aware `whatsapp_threads` /
  `whatsapp_messages` tables (the provider conversation id lives in
  `external_thread_id`). Only `channel_connections` is new (migration
  `202607110012_channel_connections.sql`).
- Once converted, the lead's **Capturar con IA / highlight** feature reads the
  same conversation to fill budget / zona / tipo / operación.

## Files

| Area | File |
|---|---|
| Zernio client | `src/lib/integrations/zernio.ts` |
| Domain (list/get/reply/convert/ingest) | `src/lib/domain/conversations.ts` |
| Inbound webhook | `src/app/api/webhooks/zernio/route.ts` |
| Connect + callback (per channel) | `src/app/api/integrations/zernio/[platform]/…` |
| Inbox UI | `src/app/(app)/conversations/…` |

## Environment

| Var | Purpose |
|---|---|
| `ZERNIO_API_KEY` | Bearer auth to `https://zernio.com/api` |
| `ZERNIO_PROFILE_ID` | Zernio profile the connect flow provisions under |
| `ZERNIO_WEBHOOK_SECRET` | secret we register the webhook with + verify inbound HMAC-SHA256 |

**Graceful degrade:** with no key the inbox is read-only and shows the connect
CTA; replies are disabled. Without migration 0012, connections just aren't
stored (the inbox still reads existing threads).

## Setup

1. Set the three env vars (`.env.example` documents them).
2. Apply `supabase/migrations/202607110012_channel_connections.sql`.
3. In **Conversaciones**, click **Conectar WhatsApp / Instagram / Facebook**.

## Zernio contract (verified vs. inferred)

Verified from docs: base `https://zernio.com/api`, `Authorization: Bearer`,
connect `GET /v1/connect/{platform}`, webhook register
`POST /v1/webhooks/settings` (HMAC-SHA256), inbox `GET /v1/inbox/conversations`,
send `POST /v1/inbox/conversations/{id}/messages`.

**Not published — isolated in one place each, to confirm against a live event:**

| Unknown | Where |
|---|---|
| `message.received` payload fields | `parseZernioInbound` (`zernio.ts`) |
| send-message body (`{type,text}`) | `sendZernioMessage` (`zernio.ts`) |
| webhook signature header name | `/api/webhooks/zernio` (checks candidates) |
| connect-URL field + callback query params | `getConnectUrl` + `[platform]/callback` |
| connect slug for Messenger (`facebook`) | `ZERNIO_CONNECT_SLUG` (`zernio.ts`) |
