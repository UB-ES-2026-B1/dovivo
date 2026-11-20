import { randomUUID } from "node:crypto";

import { type PhotoMimeType } from "~/lib/validators/photo";

/**
 * Object keys of the listing photos in the storage (US-18). `PropertyImage.url` and
 * `thumbnailUrl` store the key, not the full URL, so the storage's public address can change
 * without touching the database. Seed photos are full `https://` URLs and are returned as they are.
 *
 * Keys always use `/` (they are object names, not file paths):
 *   uploads/<propertyId>/<uuid>.jpg             upload as sent by the browser, deleted on confirm
 *   properties/<propertyId>/<uuid>-display.jpg  re-encoded photo for the detail page (`url`)
 *   properties/<propertyId>/<uuid>-thumb.webp   thumbnail for the cards (`thumbnailUrl`)
 * The published files never share a key with the upload, so the signed upload URL (valid for a
 * few minutes) can't overwrite what is shown.
 *
 * Uploads have their own prefix so a bucket lifecycle rule (`pnpm storage:setup`) can expire the
 * ones never confirmed (abandoned, failed, or uploaded without calling `confirm`, #108) without
 * ever touching a published photo.
 */

const EXTENSIONS: Record<PhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Prefix of the uploads waiting for `confirm`. Only objects under it expire. */
export const PENDING_UPLOAD_PREFIX = "uploads/";
/** Prefix of the published photos. Never expires. */
const PUBLISHED_PREFIX = "properties/";

/**
 * Days after which the bucket deletes an upload that was never confirmed. Lifecycle rules count
 * whole days and run about once a day, which is far longer than the 5 minutes a signed URL lasts.
 */
export const PENDING_UPLOAD_EXPIRATION_DAYS = 1;

/** A new, unguessable key for a photo of the listing, under the pending uploads. */
export function newPhotoKey(
  propertyId: string,
  mimeType: PhotoMimeType,
  uuid: string = randomUUID(),
): string {
  return `${PENDING_UPLOAD_PREFIX}${propertyId}/${uuid}.${EXTENSIONS[mimeType]}`;
}

/**
 * Whether `key` is one that `newPhotoKey` could have made for this listing. `confirm` only accepts
 * those, so nobody can register another listing's file or an arbitrary object of the bucket.
 */
export function isPhotoKeyOf(propertyId: string, key: string): boolean {
  const prefix = `${PENDING_UPLOAD_PREFIX}${propertyId}/`;
  if (!key.startsWith(prefix)) return false;
  return new RegExp(`^${UUID}\\.(jpg|png)$`).test(key.slice(prefix.length));
}

/** `uploads/<propertyId>/<uuid>.<ext>` → `properties/<propertyId>/<uuid><ending>`. */
function publishedKeyFor(uploadKey: string, ending: (ext: string) => string) {
  if (!uploadKey.startsWith(PENDING_UPLOAD_PREFIX)) {
    throw new Error(`Not an upload key: ${uploadKey}`);
  }
  const path = uploadKey
    .slice(PENDING_UPLOAD_PREFIX.length)
    .replace(/\.(jpg|png)$/, (_match, ext: string) => ending(ext));
  return `${PUBLISHED_PREFIX}${path}`;
}

/** Key of the re-encoded photo shown on the detail page, same format as the upload. */
export function displayKeyFor(uploadKey: string): string {
  return publishedKeyFor(uploadKey, (ext) => `-display.${ext}`);
}

/** Key of the thumbnail generated for an upload. */
export function thumbnailKeyFor(uploadKey: string): string {
  return publishedKeyFor(uploadKey, () => "-thumb.webp");
}

/** Whether the stored value is a key of our storage (and not a full URL, as the seed photos). */
export function isStorageKey(value: string): boolean {
  return !/^https?:\/\//i.test(value);
}

/**
 * Public URL of a stored photo. Full URLs (seed) are returned as they are. Without a public base
 * URL (storage not configured) the key is returned, so nothing crashes.
 */
export function photoUrl(value: string, publicBaseUrl: string | undefined) {
  if (!isStorageKey(value) || !publicBaseUrl) return value;
  return `${publicBaseUrl.replace(/\/+$/, "")}/${value}`;
}
