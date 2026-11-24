import { z } from "zod";

/**
 * Shared zod schemas for favourites (US-14): `favourite.add`, `favourite.remove` and
 * `favourite.list`. The heart button and the favourites page can reuse them.
 */

/** One listing to add to or remove from the favourites. Ids are cuids, so 50 chars is plenty. */
export const favouritePropertySchema = z.object({
  propertyId: z.string().trim().min(1).max(50),
});

/** Cursor pagination, as `property.list`: newest saved first. */
export const favouriteListSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  /** `nextCursor` of the previous page (a listing id). */
  cursor: z.string().trim().min(1).max(50).optional(),
});

export type FavouritePropertyInput = z.input<typeof favouritePropertySchema>;
export type FavouriteListInput = z.input<typeof favouriteListSchema>;
export type FavouriteListParams = z.output<typeof favouriteListSchema>;
