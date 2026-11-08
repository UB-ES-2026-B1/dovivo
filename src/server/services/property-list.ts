import { type Prisma } from "@prisma/client";

import { type PropertyFilters } from "~/lib/validators/property";
import { type AppPrismaClient } from "~/server/db-omit";
import {
  type PropertyCard,
  propertyCardSelect,
  toPropertyCard,
} from "~/server/services/property-card";

/**
 * Public listing search (US-09). Pure function: the database is passed in, so the router, unit
 * tests (with a fake) and the benchmark (`prisma/bench-list.ts`, real database) run the same query.
 */

/** The slice of Prisma this function uses; tests pass a fake implementing only this. */
export type PropertyListDb = {
  property: Pick<AppPrismaClient["property"], "findMany">;
};

export type PropertyListPage = {
  items: PropertyCard[];
  /** Pass it back as `cursor` to get the next page; `undefined` on the last page. */
  nextCursor: string | undefined;
};

/** Only listings visitors can see: published and not soft-deleted. */
export function propertyListWhere({
  minPriceCents,
  maxPriceCents,
  ...filters
}: Omit<PropertyFilters, "limit" | "cursor">): Prisma.PropertyWhereInput {
  return {
    status: "PUBLISHED",
    deletedAt: null,
    listingType: filters.listingType,
    propertyType: filters.propertyType,
    // `city` is citext, so a plain equals is case-insensitive and uses the index.
    city: filters.city,
    bedrooms: filters.minBedrooms ? { gte: filters.minBedrooms } : undefined,
    priceCents: { gte: minPriceCents, lte: maxPriceCents },
  };
}

/** Newest first. `id` breaks ties so cursor pagination never repeats or skips a listing. */
export const propertyListOrderBy = [
  { publishedAt: "desc" },
  { id: "desc" },
] satisfies Prisma.PropertyOrderByWithRelationInput[];

export async function listPropertyCards(
  db: PropertyListDb,
  { limit, cursor, ...filters }: PropertyFilters,
): Promise<PropertyListPage> {
  const rows = await db.property.findMany({
    where: propertyListWhere(filters),
    select: propertyCardSelect,
    orderBy: propertyListOrderBy,
    // One extra row: if it comes back, it is the first listing of the next page (the cursor is
    // inclusive).
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
  });

  const nextCursor = rows.length > limit ? rows.pop()?.id : undefined;
  return { items: rows.map(toPropertyCard), nextCursor };
}
