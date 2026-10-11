# ADR 0003: Chat delivery (polling) and chatbot

- **Status:** Accepted
- **Date:** 2026-10-11
- **Task:** T-09 ("Spike: xat i viabilitat del xatbot") · covers US-21, US-22; US-24 via the contract
- **See also:** [backend contract](../../dovivo_backend_contract.pdf) §4 (`Conversation`,
  `Message`), §5 (cascades), §6 (indexes), §7 (procedures), §9 (chatbot spike)

## Context

| Story | What | Sprint |
| --- | --- | --- |
| US-21 | Signed-in user sends a message to a listing's advertiser; the advertiser gets an email | S2 |
| US-22 | "My chats": list my conversations, read and reply | S3\* (candidate for S3 if there is capacity) |
| US-24 | Chatbot | Post-MVP (Could) |

The contract defines the chat data model and procedures but not **how new messages reach
the screen** (realtime vs polling). That is the decision recorded here. The chatbot part of
T-09 is covered by the contract (§9).

- PO rules: message not empty; must be signed in; you can't message your own listing (403).
- Deployment is a single Next.js container (ADR 0001). No message broker or websocket server.
- MVP volume is low (a buyer asking about one listing), and email is the main notification.

## Decision

### Data model (from the contract, built in PR 1)

| Table | Fields | Constraints / indexes |
| --- | --- | --- |
| `Conversation` | `propertyId`, `interestedUserId` (who writes), `advertiserId` (copied from `Property.ownerId` when the conversation is created), `lastMessageAt?`, `createdAt`, `updatedAt` | `@@unique([propertyId, interestedUserId])`; `@@index([advertiserId, lastMessageAt])`, `@@index([interestedUserId, lastMessageAt])`; `CHECK ("interestedUserId" <> "advertiserId")` (optional in the contract; added by hand in the migration, so the DB also rejects messaging your own listing) |
| `Message` | `conversationId`, `senderId`, `body`, `readAt?`, `createdAt` | `@@index([conversationId, createdAt])` |

All `Conversation` and `Message` foreign keys cascade (contract §5): if either participant
deletes their account (US-07), the conversation disappears for both. Soft-deleting a listing
(`deletedAt`) keeps its chats.

### Procedures (names from contract §7)

- **`conversation.start`** (S2, US-21, `protectedProcedure`): creates the conversation if it
  doesn't exist, adds the first message and emails the advertiser.
  1. zod: `body` is `z.string().trim().min(1)` → otherwise `BAD_REQUEST`.
  2. Listing missing or soft-deleted → `NOT_FOUND`; caller is the owner → `FORBIDDEN`.
  3. In one transaction: upsert the `Conversation`, insert the `Message`, set `lastMessageAt`.
  4. Email through the **T-16 email service**. A failed send must not roll back the message.
- **`conversation.list` / `messages` / `reply` / `markRead`** (S3\*, US-22): inbox ordered by
  `lastMessageAt`, messages of one chat (participants only), reply (also sends the email,
  US-23), mark as read via `readAt`.

### Delivery: polling, no realtime

The chat page polls with React Query `refetchInterval` (a few seconds, only while the page is
open and focused). The inbox can refetch on focus. Email covers "you have a new message".

## Alternatives considered

| Option | Why not for the MVP |
| --- | --- |
| WebSockets / SSE from our server | Needs long-lived connections and per-connection state; awkward with serverless hosting and Next.js route handlers; more to build and test. Polling is enough at MVP volume |
| Hosted realtime / chat SaaS (Pusher, Ably, Stream) | Extra vendor, keys and cost beyond free tiers; messages stored or relayed outside our DB (moderation, GDPR); no MVP story needs it |

Polling can later be replaced by SSE or a hosted realtime channel without changing the tables
or procedures.

## Chatbot (US-24)

Covered by **contract §9** (options A–E, costs, risks). Proposed option: **D, "assistant
search"** (`assistant.search` turns free text into `property.list` filters), **post-MVP**, to
be debated with the team. No model or table is needed for it now.

## Consequences

- US-21 needs only the two tables, `conversation.start` and the T-16 email service: no new infra.
- US-21 depends on T-16: the story isn't done until the advertiser gets the email.
- Polling adds periodic requests while a chat is open. Acceptable at MVP scale; revisit if
  chat becomes a core feature.
- Messages live in Postgres, so moderation can inspect them.
