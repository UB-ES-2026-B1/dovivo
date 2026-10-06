# AGENTS.md — dovivo

dovivo is a real-estate web app where users **buy**, **rent** and **publish** homes.
Built on the T3 stack: Next.js 15 (App Router) · TypeScript · tRPC 11 · Prisma 6 + PostgreSQL · Auth.js (NextAuth v5) · Tailwind CSS 4.

## Layout
- `src/app/` — routes & UI (server components by default; `_components/` = shared UI)
- `src/server/api/routers/` — tRPC routers (register new ones in `src/server/api/root.ts`)
- `src/server/auth/` — Auth.js config · `src/server/db.ts` — Prisma client
- `src/lib/validators/` — zod schemas shared by API and forms · `src/env.js` — typed env vars
- `prisma/schema.prisma` + `prisma/migrations/` — data model (source of truth)
- Role-specific guides: `.claude/agents/{backend,frontend,devops,qa}.md`

## Commands (pnpm only — never npm/yarn)
`pnpm dev` · `pnpm db:up` · `pnpm check` (lint + types) · `pnpm test` · `pnpm build`
`pnpm db:generate --name <change>` (new migration) · `pnpm db:studio`

## Rules
1. **Cross-platform**: the team uses Linux, macOS and Windows. No bash-only scripts in `package.json`, no hardcoded `/` or `\` paths (use `node:path`), no `rm -rf`/`export VAR=` in scripts. Keep LF line endings.
2. **Types end-to-end**: no `any`; validate every tRPC input with zod (reuse `src/lib/validators`). Data flows DB → Prisma → tRPC → React, no ad-hoc `fetch` to our own API.
3. **Schema changes go through migrations** (`pnpm db:generate`), never `db:push` on shared DBs. Commit the migration folder with the schema change.
4. **Money in cents** (`priceCents: Int`), never floats. Enums must match between Prisma and zod.
5. **Auth**: anything that mutates data or reads private data uses `protectedProcedure` and checks ownership.
6. **Env vars**: add to `.env.example` **and** `src/env.js`. Never commit `.env` or secrets.
7. Before finishing a task: `pnpm check && pnpm test` must pass. Add tests for new logic.
8. Small, focused PRs. Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Branch off `main`, never push to it directly.
9. Code, comments and identifiers in English.
