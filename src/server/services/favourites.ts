import { type ListingStatus, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { type FavouriteListParams } from "~/lib/validators/favourite";
import { type AppPrismaClient } from "~/server/db-omit";
import {
  type PropertyCard,
  propertyCardSelect,
  toPropertyCard,
} from "~/server/services/property-card";
import { canViewPropertyDetail } from "~/server/services/property-detail";

/**
 * Favourites (US-14). The `Favourite` table has the composite key `(userId, propertyId)`, so a
 * listing can't be saved twice. Pure functions: the database is passed in, so the router and the
 * unit tests (with a fake) run the same code.
 */

/** The slice of Prisma these functions use; tests pass a fake implementing only this. */
export type FavouritesDb = {
  property: Pick<AppPrismaClient["property"], "findUnique">;
  favourite: Pick<
    AppPrismaClient["favourite"],
    "createMany" | "deleteMany" | "findMany"
  >;
};

/**
 * Whether a saved listing can still be visited, so the favourites page can mark the rest instead
 * of hiding them (US-14):
 * - `AVAILABLE`: published.
 * - `RESERVED` / `CLOSED` (sold or rented, see `listingType`): the detail page still opens.
 * - `UNAVAILABLE`: deleted by its owner or back to draft. The detail page answers `NOT_FOUND`, so
 *   don't link to it.
 */
export type FavouriteAvailability =
  "AVAILABLE" | "RESERVED" | "CLOSED" | "UNAVAILABLE";

export function favouriteAvailability(property: {
  status: ListingStatus;
  deletedAt: Date | null;
}): FavouriteAvailability {
  if (property.deletedAt) return "UNAVAILABLE";
  switch (property.status) {
    case "PUBLISHED":
      return "AVAILABLE";
    case "RESERVED":
    case "CLOSED":
      return property.status;
    default:
      // DRAFT, and any status added later (e.g. BLOCKED for moderation, contract §10).
      return "UNAVAILABLE";
  }
}

export type FavouriteItem = PropertyCard & {
  availability: FavouriteAvailability;
  /** When the user saved it. The list is ordered by this, newest first. */
  savedAt: Date;
};

export type FavouritePage = {
  items: FavouriteItem[];
  /** Pass it back as `cursor` to get the next page; `undefined` on the last page. */
  nextCursor: string | undefined;
};

export type FavouriteState = { propertyId: string; isFavourite: boolean };

/** The card fields plus what decides the availability (never returned as such). */
const favouritePropertySelect = {
  ...propertyCardSelect,
  status: true,
  deletedAt: true,
} satisfies Prisma.PropertySelect;

/** Newest saved first. `propertyId` breaks ties, so pages never repeat or skip a favourite. */
const favouriteOrderBy = [
  { createdAt: "desc" },
  { propertyId: "desc" },
] satisfies Prisma.FavouriteOrderByWithRelationInput[];

/**
 * Saves a listing. Idempotent: saving it again changes nothing (and keeps the first date).
 * Only listings the user could open can be saved: `NOT_FOUND` if it is missing, deleted or
 * someone else's draft, as `property.byId`.
 */
export async function addFavourite(
  db: FavouritesDb,
  userId: string,
  propertyId: string,
): Promise<FavouriteState> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { status: true, deletedAt: true, ownerId: true },
  });
  if (
    !property ||
    !canViewPropertyDetail(
      { ...property, owner: { id: property.ownerId } },
      userId,
    )
  ) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  try {
    // One statement: two parallel calls (double click) can't both insert or fail on the key.
    await db.favourite.createMany({
      data: [{ userId, propertyId }],
      skipDuplicates: true,
    });
  } catch (error) {
    // The listing (or the account) was hard-deleted between the check and the insert.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    throw error;
  }
  return { propertyId, isFavourite: true };
}

/**
 * Removes a listing from the favourites. Idempotent, and works whatever the listing's state: a
 * deleted or unavailable listing must be removable from the list.
 */
export async function removeFavourite(
  db: FavouritesDb,
  userId: string,
  propertyId: string,
): Promise<FavouriteState> {
  await db.favourite.deleteMany({ where: { userId, propertyId } });
  return { propertyId, isFavourite: false };
}

/**
 * The user's favourites as listing cards, newest saved first, with cursor pagination as
 * `property.list`. Unavailable listings (deleted, draft, reserved, closed) are kept and marked
 * with `availability` instead of hidden.
 */
export async function listFavourites(
  db: FavouritesDb,
  userId: string,
  { limit, cursor }: FavouriteListParams,
): Promise<FavouritePage> {
  const rows = await db.favourite.findMany({
    where: { userId },
    select: { createdAt: true, property: { select: favouritePropertySelect } },
    orderBy: favouriteOrderBy,
    // One extra row: if it comes back, it is the first favourite of the next page (the cursor is
    // inclusive). So the cursor is a favourite the user hasn't seen yet, not one they may remove.
    take: limit + 1,
    cursor: cursor
      ? { userId_propertyId: { userId, propertyId: cursor } }
      : undefined,
  });

  const nextCursor = rows.length > limit ? rows.pop()?.property.id : undefined;
  const items = rows.map(
    ({ createdAt, property: { status, deletedAt, ...card } }) => ({
      ...toPropertyCard(card),
      availability: favouriteAvailability({ status, deletedAt }),
      savedAt: createdAt,
    }),
  );
  return { items, nextCursor };
}

/**
 * Ids of every listing the user saved, unavailable ones included, so the UI can fill the hearts
 * of the list and the detail page after signing in (US-14.F1/F2) without loading the cards.
 */
export async function listFavouriteIds(
  db: FavouritesDb,
  userId: string,
): Promise<string[]> {
  const rows = await db.favourite.findMany({
    where: { userId },
    select: { propertyId: true },
    orderBy: favouriteOrderBy,
  });
  return rows.map((row) => row.propertyId);
}
