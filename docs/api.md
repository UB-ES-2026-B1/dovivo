# dovivo API: usage notes

The API contract is the [backend contract](../dovivo_backend_contract.pdf), **§7 "Procediments
de l'API (tRPC)"**: the procedure list per sprint (name, type, access, user story) and the
"Contracte API (T-06)" subsection, which replaces the PO backlog's OpenAPI file. The types
themselves are `AppRouter` plus the zod schemas in `src/lib/validators/`.

This page only adds what the frontend needs day to day: how to call the API, how errors map
from the PO backlog's REST codes, and the auth flows. Background: [ADR 0001](./adr/0001-architecture.md),
[ADR 0002](./adr/0002-auth.md).

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
- **Role and name**: `session.user.role` and `session.user.name` from `auth()` are refreshed from
  the DB on every request (the `jwt` callback, ADR 0002), in tRPC and in server components, so a
  profile edit (`user.updateMe`) shows up without signing in again.
- **Listing cards (US-09)**: `property.list` returns `{ items, nextCursor, total }`, where each item
  is a card with only `id`, `title`, `listingType`, `propertyType`, `priceCents`, `currency`,
  `areaM2`, `bedrooms`, `neighborhood`, `city`, `province` and `cover` (`{ url, thumbnailUrl,
  alt, width, height }`, or `null` if the listing has no photos). The cover is the photo marked
  `isCover`, or the lowest `position` if none is marked. Only `PUBLISHED`, not deleted listings,
  newest first. Next page: pass `nextCursor` back as `cursor` (`undefined` on the last page).
  The `minPriceCents`, `maxPriceCents`, `minBedrooms`, `minBathrooms`, `minAreaM2` and
  `maxAreaM2` filters must be whole numbers from 0 to `DB_INT_MAX` (2,147,483,647); anything
  bigger gives `BAD_REQUEST`.
- **Search filters (US-10)**: every filter of `property.list` is optional and they combine with AND:
  `listingType`, `propertyType`, `minPriceCents` / `maxPriceCents`, `minBedrooms`, `minBathrooms`,
  `minAreaM2` / `maxAreaM2` (bounds included), `hasParking` (only `true` filters: `false` or missing
  means "don't care"), `city` and `neighborhood`. A minimum of `0` means "no minimum". Listings
  without m² (or bathrooms) are left out only when an area (or bathrooms) filter is sent. A minimum
  above the maximum is not an error, it just returns nothing. `city` / `neighborhood` must contain a
  letter or number (`"."` is a 400). `total` is the number of listings matching the filters across
  all pages, for the results counter: it comes only on the first page (no `cursor`) and is
  `undefined` on the following ones, so keep the first page's value.
- **Listing detail (US-12)**: `property.byId({ id })` is public. It returns the listing's public
  fields (`id`, `title`, `description`, `listingType`, `propertyType`, `status`, `priceCents`,
  `currency`, `bedrooms`, `bathrooms`, `areaM2`, `floor`, `address`, `neighborhood`, `city`,
  `province`, `postalCode`, `country`, `latitude`, `longitude`, `hasElevator`, `hasParking`,
  `isFurnished`, `publishedAt`, `updatedAt`), `images` and `owner` (`{ id, name, image }`, never
  the email or phone). Internal columns (`ownerId`, `createdAt`, `deletedAt`) are not sent.
  Drafts are visible only to their owner; `RESERVED` and `CLOSED` listings stay visible so shared
  links keep working.
- **Location filters (US-10)**: `property.list({ city, neighborhood })` match the whole name,
  ignoring case, accents and the Catalan middle dot (`"sant marti"` finds `Sant Martí`,
  `"parallel"` finds `Paral·lel`). Send the name as the user typed it; the API normalises it.
  Internally both sides are compared on `citySearch` / `neighborhoodSearch`, which the API fills
  on every write (`propertySearchColumns`) and which are never returned.
- **Listing photos (detail)**: `property.byId` returns the gallery ordered by `position`; each
  image exposes `id`, `url`, `thumbnailUrl`, `alt`, `position`, `isCover`, `width`, `height`.
  `url` and `thumbnailUrl` are full public URLs (use `thumbnailUrl` on cards, `url` on the detail
  page); the database stores the storage key ([ADR 0004](./adr/0004-photo-storage.md)).
- **Soft-deleted listings**: excluded from `list` and `mine`; `byId` and `publish`
  answer `NOT_FOUND`, also for the owner.

## Errors

The first column bridges the PO backlog, which specifies REST status codes; our API returns
the tRPC code in the second column. tRPC sets an HTTP status per code, but batched/streamed
responses may still be `200` overall, so **always read `error.data?.code`**, never the raw status.

| PO backlog HTTP code | tRPC code | When | Frontend |
| --- | --- | --- | --- |
| 422 | `BAD_REQUEST` (sent as 400) | Input fails the zod schema | `error.data?.zodError?.fieldErrors.<field>` (array of messages); `formErrors` for object-level errors |
| 401 | `UNAUTHORIZED` | No session, or the user was blocked/deleted (the session is dropped on the next request) | Redirect to `/login?callbackUrl=<current path>` |
| 403 | `FORBIDDEN` | Signed in but not the owner; messaging your own listing; not an admin | Show "not allowed", hide the action |
| 404 | `NOT_FOUND` | Missing, soft-deleted (`deletedAt`), or a draft you don't own | `notFound()` in server components / "not found" UI |
| 409 | `CONFLICT` | Sign-up with an email that already exists (case-insensitive); publishing a listing that isn't a draft; `property.photos.confirm` that couldn't save the photo (not expected, retry with the same key) | Sign-up: "This email is already registered" on the email field; otherwise show the message |
| 429 | `TOO_MANY_REQUESTS` | Sign-up: more than 5 per 15 min from the same IP (only when the IP is known, see `TRUSTED_PROXY_COUNT`); `property.photos.createUpload`: more than 45 upload URLs per hour for the same user | "Too many attempts, try again later" |
| 500 | `INTERNAL_SERVER_ERROR` | Bug / DB down | Generic error message |

Sign-in is **not** tRPC. `signIn("credentials", { …, redirect: false })` returns `res.error`
plus `res.code`:

| `res.code` | When | UI |
| --- | --- | --- |
| `"rate_limited"` | More than 30 failed attempts / 15 min from the IP (only when the IP is known), or 10 failed / 15 min for the email (PO 429). Refused even with the right password until the window ends | "Too many attempts, try again later" |
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
const res = await signIn("credentials", { email, password, redirect: false }); // may throw on network errors
if (res?.code === "rate_limited") setFormError("Too many attempts, try again later");
else if (res?.error) setFormError("Invalid email or password"); // generic on purpose
else { router.push(callbackUrl); router.refresh(); }
```

Reference implementations: `src/app/register/register-form.tsx` and `src/app/login/login-form.tsx`.

Password rules for the form: min `PASSWORD_MIN_LENGTH` (8) characters on sign-up and max
`PASSWORD_MAX_BYTES` (72) **bytes** in UTF-8 (accented letters and emoji count double or more),
both exported from `src/lib/validators/auth.ts`. Validating with `signUpSchema` /
`signInSchema` gives the same messages as the server.

**Sign-out (US-03)**: `await signOut({ redirectTo: "/" })`. Clears the session cookie (see the
JWT revocation gap in ADR 0002).

**Who is signed in**: server side `await auth()`; protected pages do
`if (!session) redirect("/login?callbackUrl=/publish")`. Read `callbackUrl` with
`safeCallbackUrl` from `~/app/_lib/safe-callback-url` (same-origin paths only, no open
redirects); never check it by hand with `startsWith("/")`. Full profile data (e.g. `phone`) comes from `user.me` (US-04).

**Edit profile (US-05)**: `api.user.updateMe.useMutation()` with `{ name?, phone? }`, validated by
`updateProfileSchema` from `src/lib/validators/user.ts`. Only the name and the phone are
editable; omitted fields stay unchanged and `phone: ""` (or `null`) clears it. Phones are stored
without spaces or dashes. It returns the same fields as `user.me`, so on success update the cache
with `const utils = api.useUtils()` and `utils.user.me.setData(undefined, updated)` (or call
`utils.user.me.invalidate()`) to show the changes right away. An invalid field gives `BAD_REQUEST` with per-field errors in
`error.data.zodError.fieldErrors` and saves nothing.

**Publish a listing (US-17)**: two calls. `api.property.create.useMutation()` with the form values
(validated by `createPropertySchema`) creates a `DRAFT` that only the owner sees and returns it with
its `id`; then `api.property.publish.useMutation()` with `{ id }` makes it visible in the list and
the search. Photos (US-18) are added between the two calls (see below). Required: `title` (5-120),
`description` (20-5000), `listingType`, `propertyType`, `priceCents` (> 0 and at most
`DB_INT_MAX` = 2,147,483,647, i.e. ~21.47 M€), `address` (3-200), `city` and `province` (2-100).
Optional: `bedrooms` and `bathrooms` (≥ 0), `areaM2` (> 0), `floor` (max 20), `neighborhood`
(max 100), `postalCode` (5 digits starting with a province code, 01-52; spaces are removed) and
the `hasElevator` / `hasParking` / `isFurnished` flags. Whole numbers are capped at `DB_INT_MAX`,
exported from `src/lib/validators/property.ts`. Empty text fields (`""`) and `null` are stored
as `null`. An invalid field gives `BAD_REQUEST` with per-field errors and nothing is created. The
owner is always the signed-in user. Type the form with `CreatePropertyInput` (the input shape,
before the transforms) and validate it with `createPropertySchema` to get the same errors as the
server.

**Listing photos (US-18)**: the browser uploads each file straight to the storage with a signed
URL ([ADR 0004](./adr/0004-photo-storage.md)). Limits live in `src/lib/validators/photo.ts`
(`MAX_PHOTOS_PER_PROPERTY` = 15, `MAX_PHOTO_BYTES` = 5 MB, JPG/PNG): check them before uploading
to show the error at once. Only the owner of a listing that isn't deleted can use these
(`NOT_FOUND` / `FORBIDDEN` otherwise).

1. `api.property.photos.createUpload.useMutation()` with `{ propertyId, mimeType: file.type,
   sizeBytes: file.size }` returns `{ key, uploadUrl, headers, expiresAt }`. A wrong type or size
   gives `BAD_REQUEST` with field errors; a 16th photo gives `BAD_REQUEST` with the message
   "A listing can have at most 15 photos.". More than 45 upload URLs in an hour (all the user's
   listings together) gives `TOO_MANY_REQUESTS`. An upload that is never confirmed is deleted
   from the storage about a day later, so ask for a new URL instead of reusing an old key.
2. Upload the file: `fetch(uploadUrl, { method: "PUT", headers, body: file })`. This is the
   storage, not our API (the one `fetch` rule 2 allows). The URL expires in 5 minutes and only
   accepts that exact type and size.
3. `api.property.photos.confirm.useMutation()` with `{ propertyId, key, alt? }` returns the
   photo (same fields as in `byId`). The first photo becomes the cover. If the file isn't really a
   JPG/PNG, is over 5 MB or is damaged, it gives `BAD_REQUEST` with a message to show, and the
   file is discarded: start again from step 1. Calling `confirm` twice with the same key returns
   the same photo, so it is safe to retry after a network error.

Several files can be uploaded and confirmed in parallel (e.g. with `Promise.all`): the server
confirms the photos of a listing one after another, so they get consecutive positions and only
the first one becomes the cover. `confirm` doesn't answer `CONFLICT` in normal use; if it ever
does, the upload is kept and calling `confirm` again with the same key works.

- `api.property.photos.update.useMutation()` with `{ propertyId, order?, coverImageId? }`:
  `order` lists **every** photo id of the listing once, in the new order; `coverImageId` marks
  the cover (the previous one is unmarked). Returns the whole gallery in the new order.
- `api.property.photos.delete.useMutation()` with `{ imageId }` deletes the photo and its files,
  closes the gap in the positions and, if it was the cover, makes the first photo the cover.
  Returns the remaining gallery.

After any of these, invalidate `property.byId` for the listing (or set its `images` with the
returned gallery).

**Favourites (US-14)**: signed-in users only (`UNAUTHORIZED` otherwise: a visitor pressing the
heart is sent to `/login?callbackUrl=<current path>`). Always the session's favourites: no input
says whose.

- `api.favourite.ids.useQuery()` returns the ids of every saved listing (unavailable ones too).
  Load it once after signing in to fill the hearts of the cards and the detail page.
- `api.favourite.add.useMutation()` / `api.favourite.remove.useMutation()` with `{ propertyId }`
  return `{ propertyId, isFavourite }`. Both are idempotent: a double click or a retry is safe.
  `add` answers `NOT_FOUND` if the user couldn't open the listing (missing, deleted, someone
  else's draft). `remove` always works, also for a deleted listing. After either, update
  `favourite.ids` (optimistically or by invalidating it) and invalidate `favourite.list`.
- `api.favourite.list.useInfiniteQuery({ limit? }, { getNextPageParam: (p) => p.nextCursor })`
  returns `{ items, nextCursor }`, newest saved first (20 per page, max 50). Each item is a listing
  card (same fields as `property.list`) plus `savedAt` and `availability`:

  | `availability` | Meaning | UI |
  | --- | --- | --- |
  | `AVAILABLE` | Published | Normal card |
  | `RESERVED` | Reserved by the owner | Mark it as reserved; the detail page opens |
  | `CLOSED` | Sold (`listingType: "SALE"`) or rented (`"RENT"`) | Mark it as sold / rented; the detail page opens |
  | `UNAVAILABLE` | Deleted by the owner or back to draft | Mark it "no disponible" and don't link to the detail page (`NOT_FOUND`); offer to remove it |

**Contact the advertiser (US-21)**: `api.conversation.start.useMutation()` with
`{ propertyId, body }`, from the contact form on the listing page. Signed-in users only
(`UNAUTHORIZED` otherwise: send visitors to `loginToContactHref(propertyId)`). Validate the form
with `startConversationSchema` (`~/lib/validators/conversation`), so it gives the same errors
as the server.

- `body` is trimmed and must have 1-2000 characters (`MESSAGE_MAX_LENGTH`). Empty or blank →
  `BAD_REQUEST`, "Write a message." on `fieldErrors.body`.
- Returns `{ conversationId, message: { id, body, createdAt } }`: show the confirmation
  (US-21.F2). Sending again about the same listing adds the message to the same conversation.
- `FORBIDDEN` ("You can't send a message about your own listing.") on the user's own listing:
  better, hide the form when `property.owner.id` is the session's user.
- `NOT_FOUND` if the listing is missing, deleted or someone else's draft (as `property.byId`).
- `TOO_MANY_REQUESTS` ("Too many messages. Please try again later.") past 20 messages per hour
  per user.
- The advertiser gets an email with the message and a link to the listing. If the email fails,
  the message is still saved and the call succeeds: there's no "email failed" error to show.

## Open points

Pending decisions already listed in contract §10 and in §7 "Contracte API (T-06)" are not
repeated here. These are extra gaps between the contract and the PO backlog:

| # | Topic | Status |
| --- | --- | --- |
| 1 | **Page size**: `property.list` caps `limit` at **50** (default 20, contract §7); the PO backlog asks for `per_page` max **100**. Tied to contract §10 #5 (cursor vs numbered pages). | Pending PO confirmation |
| 2 | **Publish immediately or draft first** (US-17): the contract creates a `DRAFT` (`property.create`) and makes it visible with `property.publish`; the PO's `POST /api/properties` may expect the listing to be visible right after creation. Can be solved in the UI by calling both. | Pending PO confirmation |
| 3 | **Soft-deleted listing detail**: contract §7 only lists `NOT_FOUND` for `property.byId` when the listing is missing or someone else's draft. We also return `NOT_FOUND` when `deletedAt` is set (PO US-12), even for the owner. | Confirmed (US-12, #41) |
| 4 | **Editable profile fields** (US-05): contract §7 says `user.updateMe` edits "nom, email i telèfon"; the PO subtask (#21) only allows the **name** and the **phone**. We follow #21: the email can't be changed. | Contract to update |
