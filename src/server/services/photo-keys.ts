import { randomUUID } from "node:crypto";

import { type PhotoMimeType } from "~/lib/validators/photo";

/**
 * Object keys of the listing photos in the storage (US-18). `PropertyImage.url` and
 * `thumbnailUrl` store the key, not the full URL, so the storage's public address can change
 * without touching the database. Seed photos are full `https://` URLs and are returned as they are.
 *
 * Keys always use `/` (they are object names, not file paths):
 *   properties/<propertyId>/<uuid>.jpg        original, re-encoded on confirm
 *   properties/<propertyId>/<uuid>-thumb.webp thumbnail for the cards
 */

const EXTENSIONS: Record<PhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** A new, unguessable key for a photo of the listing. */
export function newPhotoKey(
  propertyId: string,
  mimeType: PhotoMimeType,
  uuid: string = randomUUID(),
): string {
  return `properties/${propertyId}/${uuid}.${EXTENSIONS[mimeType]}`;
}

/**
 * Whether `key` is one that `newPhotoKey` could have made for this listing. `confirm` only accepts
 * those, so nobody can register another listing's file or an arbitrary object of the bucket.
 */
export function isPhotoKeyOf(propertyId: string, key: string): boolean {
  const prefix = `properties/${propertyId}/`;
  if (!key.startsWith(prefix)) return false;
  return new RegExp(`^${UUID}\\.(jpg|png)$`).test(key.slice(prefix.length));
}

/** Key of the thumbnail generated for an original. */
export function thumbnailKeyFor(key: string): string {
  return key.replace(/\.(jpg|png)$/, "-thumb.webp");
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
