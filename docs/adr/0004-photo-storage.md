# ADR 0004: Photo storage and upload flow

- **Status:** Proposed (to confirm in the US-18 backend PR review)
- **Date:** 2026-11-18
- **Task:** T-10 ("Emmagatzematge d'imatges") · covers US-18 (#57: #58, #59, #60)
- **See also:** [backend contract](../../dovivo_backend_contract.pdf) §4 (`PropertyImage`),
  §5 (cascades), §7 (`property.photos.*`), §10 #7; [ADR 0001](./0001-architecture.md)

## Context

- US-18: up to 15 JPG/PNG photos per listing, 5 MB each; choose the cover, delete photos; photos
  shown optimised in the list and on the detail page.
- tRPC has no multipart (ADR 0001). The contract recommends a storage with **signed URLs** and a
  `createUpload` → upload → `confirm` flow (§7), and §10 #7 proposes "S3, R2...".
- The app runs as one container on Azure App Service, whose disk is not persistent: files can't
  live next to the app.

## Decision

### Storage: any S3-compatible bucket

The backend talks the S3 API (`@aws-sdk/client-s3`), configured with `S3_*` env vars
(`.env.example`, `src/env.js`). The same code works with AWS S3, Cloudflare R2 or another
S3-compatible service, so the choice of provider for staging is a devops decision, not a code
change. The variables are optional: without them the app works and only the photo procedures
answer `INTERNAL_SERVER_ERROR` ("Photo storage is not configured.").

Locally, `pnpm storage:up` starts **RustFS** (S3-compatible) in Docker Compose and
`pnpm storage:setup` creates the bucket with public reads and CORS. Not MinIO: it no longer
publishes Docker images.

The bucket is **publicly readable**: photos are as public as the listings. Uploads are only
possible with a signed URL.

### Upload flow

1. `property.photos.createUpload({ propertyId, mimeType, sizeBytes })`: owner only; JPG/PNG,
   ≤ 5 MB, fewer than 15 photos. Returns a key `properties/<propertyId>/<uuid>.<jpg|png>` and a
   signed `PUT` URL valid for 5 minutes. `Content-Type` and `Content-Length` are part of the
   signature, so the storage refuses another type or size.
2. The browser `PUT`s the file straight to the storage. Photos never pass through our server on
   the way in.
3. `property.photos.confirm({ propertyId, key, alt? })`: owner only; the key must be one made for
   that listing. The server downloads the file and with **sharp**:
   - checks the real content is JPG/PNG (not the declared type), at most 5 MB and 40 MP;
   - re-encodes the original (upright from EXIF, ≤ 1920 px, **no metadata**: EXIF can carry GPS
     and camera data) and overwrites it;
   - makes a WebP thumbnail inside 640×480 for the cards (US-18.B2).

   Then it creates the `PropertyImage` at the next position; the first photo becomes the cover.
   An invalid file is deleted from the storage.

### Database

`PropertyImage.url` and `thumbnailUrl` store the **key**, and the API returns
`${S3_PUBLIC_URL}/${key}`: the public address (CDN, custom domain) can change without a data
migration. Seed photos are full `https://` URLs and are returned as they are.

Invariants kept by the API (contract §3/§4): positions are `0..n-1` without gaps and a listing
with photos has exactly one cover. Reordering moves every photo to negative positions first,
because `(propertyId, position)` is unique and not deferrable. Two concurrent confirms get the
same position and the unique index refuses one (`CONFLICT`), which also keeps the 15 limit.

## Consequences

**Positive**

- No upload traffic or temporary files on the app server; the 5 MB limit is enforced by the
  storage itself.
- Provider-agnostic, with a local stack that works the same on Linux, macOS and Windows.
- The detail page and the cards get lighter images without original metadata.

**Negative / trade-offs**

- `confirm` downloads and processes each photo (a few hundred ms, ≤ 5 MB in memory).
- Files of uploads that are never confirmed stay in the bucket. Fix later with a lifecycle rule
  (delete `properties/` objects not referenced after a day) or a cleanup job.
- Files are deleted from the storage only by `property.photos.delete`. Hard-deleting a listing
  or an account (cascade) leaves its files: whoever implements US-07 (delete account) must
  delete them (contract §5).
- Staging needs a bucket, its keys in the App Service settings and CORS for the staging origin
  (`S3_CORS_ORIGINS` + `pnpm storage:setup`, or the provider's dashboard).
- The full Docker Compose stack (`docker compose up`) doesn't wire the app to the local storage:
  signed URLs must use an address the browser can reach. Use `pnpm dev` for photos.
