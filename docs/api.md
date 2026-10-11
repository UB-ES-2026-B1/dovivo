# dovivo API: usage notes

The API contract is the [backend contract](../dovivo_backend_contract.pdf), **§7 "Procediments
de l'API (tRPC)"**: the procedure list per sprint (name, type, access, user story) and the
"Contracte API (T-06)" subsection, which replaces the PO backlog's OpenAPI file. The types
themselves are `AppRouter` plus the zod schemas in `src/lib/validators/`.

This page only adds what the frontend needs day to day: how to call the API, how errors map
from the PO backlog's REST codes, and the auth flows. Background: [ADR 0001](./adr/0001-architecture.md),
[ADR 0002](./adr/0002-auth.md).

> Status legend: **PR 1** = data-model PR · **PR 2** = credentials-auth PR. Both target
> `development`; anything else mentioned here is already in `development`.

## How to call the API

| Where | Import | Example |
| --- | --- | --- |
| Server Component (default) | `import { api } from "~/trpc/server"` | `const p = await api.property.byId({ id })` |
| Client Component (`"use client"`) | `import { api } from "~/trpc/react"` | `api.property.list.useQuery({ listingType: "RENT" })` / `api.property.create.useMutation()` |
| Session, server side | `import { auth } from "~/server/auth"` | `const session = await auth()` → `session?.user.id`, `.role` |

- **Inputs** are the zod schemas in `src/lib/validators/` (e.g. `propertyFiltersSchema`,
  `createPropertySchema`, `signUpSchema`). Reuse them in forms (`schema.safeParse(values)`) so
  client and server validate the same way.
- **Types**: `RouterInputs["property"]["create"]` / `RouterOutputs["property"]["list"]` from
  `~/trpc/react`. No hand-written DTOs.
- **superjson**: `Date` fields arrive as `Date` objects, not strings.
- **Money** is always integer cents (`priceCents`). Format in the UI only.
- Never `fetch("/api/trpc/...")` by hand (AGENTS rule 2).
- **Role**: `session.user.role` from `auth()` comes from the JWT and can be stale until the
  next sign-in; use it for UI hints only. Protected procedures check the DB role (ADR 0002).
- **Listing photos** (PR 1): each image exposes `id`, `url`, `thumbnailUrl`, `alt`, `position`,
  `isCover`, `width`, `height`. `property.list` returns one image per listing, the cover
  (`isCover` first, then lowest `position` if none is marked); `property.byId` returns the
  gallery ordered by `position`.
- **Soft-deleted listings** (PR 1): excluded from `list` and `mine`; `byId` and `publish`
  answer `NOT_FOUND`, also for the owner.

## Errors

The first column bridges the PO backlog, which specifies REST status codes; our API returns
the tRPC code in the second column. tRPC sets an HTTP status per code, but batched/streamed
responses may still be `200` overall, so **always read `error.data?.code`**, never the raw status.

| PO backlog HTTP code | tRPC code | When | Frontend |
| --- | --- | --- | --- |
| 422 | `BAD_REQUEST` (sent as 400) | Input fails the zod schema | `error.data?.zodError?.fieldErrors.<field>` (array of messages); `formErrors` for object-level errors |
| 401 | `UNAUTHORIZED` | No session, or the user was blocked/deleted (PR 2) | Redirect to `/login?callbackUrl=<current path>` |
| 403 | `FORBIDDEN` | Signed in but not the owner; messaging your own listing; not an admin | Show "not allowed", hide the action |
| 404 | `NOT_FOUND` | Missing, soft-deleted (`deletedAt`), or a draft you don't own | `notFound()` in server components / "not found" UI |
| 409 | `CONFLICT` | Sign-up with an email that already exists (PR 2) | "This email is already registered" on the email field |
| 429 | `TOO_MANY_REQUESTS` | Sign-up: more than 5 per 15 min from the same IP (PR 2) | "Too many attempts, try again later" |
| 500 | `INTERNAL_SERVER_ERROR` | Bug / DB down | Generic error message |

Sign-in is **not** tRPC. `signIn("credentials", { …, redirect: false })` returns `res.error`
plus `res.code` (PR 2):

| `res.code` | When | UI |
| --- | --- | --- |
| `"rate_limited"` | More than 30 attempts / 15 min from the IP, or 10 / 15 min for the email (PO 429) | "Too many attempts, try again later" |
| `"credentials"` | Invalid input, unknown email, wrong password, blocked or OAuth-only account (PO 401) | One generic "Invalid email or password" |

A blocked user signing in with OAuth (Discord) gets `AccessDenied` instead.
The language and wording of error messages is still pending (contract §7, "Contracte API").

## Auth flows (frontend)

All client helpers come from `next-auth/react`. Details and rationale: [ADR 0002](./adr/0002-auth.md).

**Sign-up (US-01)**: create the account, then sign in with the same credentials.

```tsx
const signUp = api.auth.signUp.useMutation({
  onSuccess: async (_user, { email, password }) => {
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) return setFormError("Account created, but sign-in failed. Try logging in.");
    router.push(callbackUrl);
    router.refresh(); // re-render server components (header) with the new session
  },
});
signUp.mutate({ name, email, password }); // validated by signUpSchema
// signUp.error?.data?.code === "CONFLICT" → duplicate email
// signUp.error?.data?.zodError?.fieldErrors → per-field errors
```

**Sign-in (US-02)**

```tsx
const res = await signIn("credentials", { email, password, redirect: false });
if (res?.code === "rate_limited") setFormError("Too many attempts, try again later");
else if (res?.error) setFormError("Invalid email or password"); // generic on purpose
else { router.push(callbackUrl); router.refresh(); }
```

Password rules for the form: min `PASSWORD_MIN_LENGTH` (8) characters on sign-up and max
`PASSWORD_MAX_BYTES` (72) **bytes** in UTF-8 (accented letters and emoji count double or more),
both exported from `src/lib/validators/auth.ts`. Validating with `signUpSchema` /
`signInSchema` gives the same messages as the server.

**Sign-out (US-03)**: `await signOut({ redirectTo: "/" })`. Clears the session cookie (see the
JWT revocation gap in ADR 0002).

**Who is signed in**: server side `await auth()`; protected pages do
`if (!session) redirect("/login?callbackUrl=/publish")`. Only accept `callbackUrl` values that
start with `/` (no open redirects). Until `/login` exists, use `/api/auth/signin`. Full
profile data (e.g. `phone`) comes from `user.me` (US-04).

## Open points

Pending decisions already listed in contract §10 and in §7 "Contracte API (T-06)" are not
repeated here. These are extra gaps between the contract and the PO backlog:

| # | Topic | Status |
| --- | --- | --- |
| 1 | **Page size**: `property.list` caps `limit` at **50** (default 20, contract §7); the PO backlog asks for `per_page` max **100**. Tied to contract §10 #5 (cursor vs numbered pages). | Pending PO confirmation |
| 2 | **Publish immediately or draft first** (US-17): the contract creates a `DRAFT` (`property.create`) and makes it visible with `property.publish`; the PO's `POST /api/properties` may expect the listing to be visible right after creation. Can be solved in the UI by calling both. | Pending PO confirmation |
| 3 | **Soft-deleted listing detail**: contract §7 only lists `NOT_FOUND` for `property.byId` when the listing is missing or someone else's draft. We also return `NOT_FOUND` when `deletedAt` is set (PO US-12), even for the owner. | Pol to confirm |
