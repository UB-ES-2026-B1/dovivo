import { z } from "zod";

import { propertyIdSchema } from "./property";

/**
 * Listing photos (US-18). Shared by the `property.photos.*` procedures and the upload component,
 * so the browser can reject a file before uploading it with the same limits as the API.
 */

/** At most 15 photos per listing (US-18). */
export const MAX_PHOTOS_PER_PROPERTY = 15;

/** 5 MB per photo (US-18), as in `PropertyImage.sizeBytes`. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Accepted formats. The API checks the real content too, not only what the browser says. */
export const photoMimeTypeSchema = z.enum(["image/jpeg", "image/png"], {
  errorMap: () => ({ message: "Only JPG or PNG photos are allowed" }),
});

/** Ids are cuids, so 50 chars is plenty (as in `propertyIdSchema`). */
const idSchema = z.string().trim().min(1).max(50);

/** Step 1: ask for a signed URL to upload one file straight to the storage. */
export const createPhotoUploadSchema = z.object({
  propertyId: propertyIdSchema.shape.id,
  mimeType: photoMimeTypeSchema,
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_PHOTO_BYTES, { message: "Each photo can be at most 5 MB" }),
});

/** Step 2: once the file is uploaded, register it with the `key` returned by step 1. */
export const confirmPhotoSchema = z.object({
  propertyId: propertyIdSchema.shape.id,
  key: z.string().trim().min(1).max(200),
  // Alternative text for screen readers. Empty is stored as `null`.
  alt: z
    .string()
    .trim()
    .max(200)
    .transform((value) => (value === "" ? null : value))
    .optional(),
});

/**
 * Reorder the gallery and/or choose the cover. `order` lists every photo id of the listing once,
 * in the new order (first = position 0).
 */
export const updatePhotosSchema = z
  .object({
    propertyId: propertyIdSchema.shape.id,
    order: z
      .array(idSchema)
      .min(1)
      .max(MAX_PHOTOS_PER_PROPERTY)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Each photo can appear only once",
      })
      .optional(),
    coverImageId: idSchema.optional(),
  })
  .refine((input) => input.order ?? input.coverImageId, {
    message: "Send the new order, the new cover or both",
  });

/** Delete one photo (and its files). */
export const deletePhotoSchema = z.object({ imageId: idSchema });

export type PhotoMimeType = z.infer<typeof photoMimeTypeSchema>;
export type CreatePhotoUploadInput = z.infer<typeof createPhotoUploadSchema>;
export type ConfirmPhotoInput = z.input<typeof confirmPhotoSchema>;
export type UpdatePhotosInput = z.infer<typeof updatePhotosSchema>;
export type DeletePhotoInput = z.infer<typeof deletePhotoSchema>;
