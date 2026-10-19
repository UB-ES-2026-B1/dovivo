# dovivo documentation

## Source of truth

**[Backend contract](../dovivo_backend_contract.pdf)** (Catalan): data model (T-05), tRPC
procedures per sprint and the API contract (§7, T-06), search spike (§8, T-07), chatbot spike
(§9, T-09) and pending decisions (§10). If anything below disagrees with it, the contract wins
(and `prisma/schema.prisma` wins for the data model).

## Complements

| Document | What it adds to the contract | Task |
| --- | --- | --- |
| [API usage notes](./api.md) | How to call the API, PO HTTP code → tRPC error mapping, frontend auth flows, extra open points | T-06 |
| [ADR 0001: Architecture](./adr/0001-architecture.md) | Why a T3 modular monolith, request flow, where code lives, PO/Laravel → T3 glossary | T-04 |
| [ADR 0002: Authentication](./adr/0002-auth.md) | Credentials + JWT details, hashing, user enumeration, blocked users, sign-out gap, rate limiting | T-06 |
| [ADR 0003: Chat and chatbot](./adr/0003-chat-and-chatbot.md) | Polling instead of realtime for US-21/US-22; chatbot pointer to contract §9 | T-09 |

## Architecture Decision Records

ADRs live in [`adr/`](./adr/), numbered `NNNN-short-title.md`. Each has a status, date,
context, decision and consequences. Don't rewrite an accepted ADR: add a new one that
supersedes it and update the old one's status.
