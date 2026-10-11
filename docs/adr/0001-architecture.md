# ADR 0001: Architecture: T3 modular monolith

- **Status:** Accepted
- **Date:** 2026-10-11
- **Task:** T-04 (architecture spike)
- **See also:** [backend contract](../../dovivo_backend_contract.pdf) ("Arquitectura en resum",
  §1–§6 data model, §7 API procedures)

## Context

- dovivo lets users buy, rent and publish homes. The MVP runs S1–S3 (20 Oct – 15 Dec 2026).
- Small team on Linux, macOS and Windows; one shared staging environment.
- The PO backlog describes backend subtasks in Laravel/REST terms (FormRequest, Sanctum,
  API Resources, `deleted_at`, `/api/...` endpoints, OpenAPI). The repo is T3
  (`create-t3-app`). The backend contract already fixes the architecture summary, data model
  and procedure list; this ADR records **why** and adds what the contract doesn't cover: the
  request flow, where code lives and how to translate the PO's Laravel terms.

## Decision

One **full-stack Next.js 15 app** (a "modular monolith"): App Router · TypeScript (strict) ·
tRPC 11 + zod · Prisma 6 + PostgreSQL 17 · Auth.js v5 · Tailwind 4. Frontend and backend live
in one repo, deploy as one container and share TypeScript types with no code generation.
Conventions (cuid ids, cents, enums, naming) and the data model are in the contract
("Arquitectura en resum", §1–§6).

### Request flow

| Caller | Path | Notes |
| --- | --- | --- |
| Server Component (`src/app/**/page.tsx`) | `~/trpc/server` → tRPC server caller | In-process call, no HTTP round-trip |
| Client Component (`"use client"`) | `~/trpc/react` hooks → `/api/trpc/*` | HTTP, batched, superjson-encoded |
| Browser sign-in / sign-out | `/api/auth/*` (Auth.js) | Credentials + optional OAuth, see [ADR 0002](./0002-auth.md) |
| Docker / uptime monitor | `GET /api/health` | Runs `SELECT 1`; 200 or 503 |

Every tRPC procedure: zod validates the input → `publicProcedure` / `protectedProcedure` /
`adminProcedure` checks access → the router checks ownership → Prisma queries Postgres → the
result is serialised with superjson (dates arrive as `Date`).

### Where code lives

| Concern | Location |
| --- | --- |
| Pages, layouts, UI | `src/app/` (`_components/` = shared UI) |
| API (one router per domain) | `src/server/api/routers/*.ts`, registered in `src/server/api/root.ts` |
| Context, procedures, middlewares | `src/server/api/trpc.ts` |
| Business logic that needs unit tests | `src/server/services/` (pure functions, DB passed in) |
| Auth.js config | `src/server/auth/` |
| Input schemas shared by API and forms | `src/lib/validators/` |
| Data model + migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| Env vars (typed) | `src/env.js` + `.env.example` |

### PO / Laravel concept → dovivo equivalent

| PO backlog (Laravel) | dovivo (T3) |
| --- | --- |
| REST endpoint under `/api/...` | tRPC procedure (`router.procedure`), listed per sprint in contract §7 |
| FormRequest validation | zod schema in `src/lib/validators/`, used by `.input()` and by frontend forms |
| `422 Unprocessable Entity` + field errors | tRPC `BAD_REQUEST` with `error.data.zodError` (flattened field errors) |
| Sanctum token / `personal_access_tokens` | Auth.js JWT session in an HttpOnly cookie (no token table) |
| Middleware `auth:sanctum` | `protectedProcedure` (API) / `await auth()` (server components) |
| Admin middleware / gate | `adminProcedure` (`protectedProcedure` + `role === "ADMIN"`) |
| Policy / `403` ownership check | Explicit `ownerId === ctx.session.user.id` check → `FORBIDDEN` |
| API Resource (response shaping) | Prisma `select` / `include` in the procedure; never return private fields |
| Soft deletes (`deleted_at`) on listings | `Property.deletedAt` + `deletedAt: null` in every listing read. Listings only: account deletion (US-07) is a **hard delete** with `onDelete` cascades (contract §5) |
| Migrations | Prisma migrations (`pnpm db:generate --name <change>`); SQL Prisma can't model is added by hand (see Consequences) |
| Factory / seeder | Prisma seed `prisma/seed.ts` (T-15) |
| Laravel Mail / notifications | Email service (T-16) |
| Throttle middleware | Rate limiter (see ADR 0002) |
| OpenAPI spec (T-06) | Not needed while our frontend is the only client: the contract is `AppRouter` + `src/lib/validators` (contract §7 "Contracte API (T-06)"); usage notes in [`docs/api.md`](../api.md) |

## Consequences

**Positive**

- End-to-end type safety: changing a zod schema or Prisma model breaks the build where the
  frontend uses it, instead of failing at runtime.
- One deployable (`db` → `migrate` → `app` in Docker); no CORS, no separate API server, no
  token storage on the client.
- Server components read data without HTTP, so pages are fast and simple.
- Validation rules are written once and reused by forms.

**Negative / trade-offs**

- tRPC is not a public REST API. URLs (`/api/trpc/property.list?batch=1&input=...`) are an
  implementation detail; an external client (mobile, partners) would need an OpenAPI layer
  generated with `trpc-to-openapi` (contract §7).
- Status codes differ slightly from the PO's spec: tRPC sends 401/403/404/409/429 as
  expected, but validation errors are `400 BAD_REQUEST`, not 422. The frontend reads the
  tRPC code (`error.data.code`), not the raw status. Mapping in `docs/api.md`.
- File uploads don't fit tRPC (no multipart): photos use a signed URL + confirm flow, or a
  Next.js Route Handler if T-10 picks storage without signed URLs (contract §7).
- Some constraints aren't expressible in Prisma and live only in hand-edited migration SQL
  (contract §3): the partial unique index `PropertyImage_propertyId_cover_key` (one cover per
  listing) and the `Conversation` CHECK (`interestedUserId <> advertiserId`). A future
  `pnpm db:generate` may try to drop them: review generated SQL before applying it, and use
  `--create-only` when adding new hand-written SQL.
- Backend and frontend scale together. Fine for the MVP.
- Every PO subtask must be translated; the table above is the reference for that.
