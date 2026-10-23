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
8. Small, focused PRs (see **Pull requests** below). Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Branch off `development`, never push to `development` or `main` directly.
9. Code, comments and identifiers in English. Everything the team reads on GitHub is in **Catalan**: commit messages, PR titles and descriptions, review comments and issues.

## Pull requests
- **Base**: `development`. Only the end-of-sprint release PR targets `main`. CI green and at least one teammate's review before merging; nobody merges their own PR.
- **Title**: `<type>: <description in Catalan> (<US-xx | T-xx>)`, e.g. `feat: afegeix la pàgina de registre (US-01)`.
- **Description**: fill in `.github/pull_request_template.md` (GitHub loads it automatically) and keep every section, in this order:
  1. `Tasca: #N · Història: #N`: the subtask and the user story it belongs to.
  2. `## Resum`: what the PR does and why, in 2-3 sentences.
  3. `## Canvis`: one bullet per file or area, saying what changes.
  4. `## Criteris d'acceptació`: copied from the subtask and the story as checkboxes. Tick only what this PR delivers and you verified, with how (`— ...`). Leave the rest unticked with the reason or the issue that covers it.
  5. `## Pendents / notes`: limitations, follow-ups, decisions the reviewer should know about.
  6. `## Verificació`: commands run and manual checks.
  7. `## Revisió`: the reviewer's checklist, left unticked for the reviewer.
- **Linking issues**: `Closes #N` only works on PRs to `main`. Create the branch from the issue (`gh issue develop <N> --base development --name <branch>`) so it shows up in the issue, and close the issue by hand after merging.
