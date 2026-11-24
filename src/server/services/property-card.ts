import { type Prisma } from "@prisma/client";

import { env } from "~/env";
import { photoUrl } from "~/server/services/photo-keys";

/**
 * Listing card resource (US-09): the fields a card shows (cover photo, price, location, m² and
 * bedrooms) and nothing else. Reused by every list of cards (search, favourites...), so the
 * exact address, coordinates, description and owner never reach a list response.
 */

/** The cover photo first; falls back to the first gallery photo if none is marked as cover. */
export const coverFirstOrderBy = [
  { isCover: "desc" },
  { position: "asc" },
] satisfies Prisma.PropertyImageOrderByWithRelationInput[];

export const propertyCardSelect = {
  id: true,
  title: true,
  listingType: true,
  propertyType: true,
  priceCents: true,
  currency: true,
  areaM2: true,
  bedrooms: true,
  neighborhood: true,
  city: true,
  province: true,
  // Loaded in the same findMany as the listings (one extra query for the whole page, not one
  // per listing). Upload metadata (`mimeType`, `sizeBytes`) stays internal.
  images: {
    select: {
      url: true,
      thumbnailUrl: true,
      alt: true,
      width: true,
      height: true,
    },
    orderBy: coverFirstOrderBy,
    take: 1,
  },
} satisfies Prisma.PropertySelect;

export type PropertyCardRow = Prisma.PropertyGetPayload<{
  select: typeof propertyCardSelect;
}>;

export type PropertyCardCover = PropertyCardRow["images"][number];

export type PropertyCard = Omit<PropertyCardRow, "images"> & {
  /** `null` when the listing has no photos yet. */
  cover: PropertyCardCover | null;
};

/**
 * Photos store the storage key (US-18); the API answers with the public URL. `publicBaseUrl` is a
 * parameter only so tests don't depend on the env.
 */
export function withPhotoUrls<
  T extends { url: string; thumbnailUrl: string | null },
>(image: T, publicBaseUrl: string | undefined = env.S3_PUBLIC_URL): T {
  return {
    ...image,
    url: photoUrl(image.url, publicBaseUrl),
    thumbnailUrl:
      image.thumbnailUrl === null
        ? null
        : photoUrl(image.thumbnailUrl, publicBaseUrl),
  };
}

export function toPropertyCard({
  images,
  ...property
}: PropertyCardRow): PropertyCard {
  const cover = images[0];
  return { ...property, cover: cover ? withPhotoUrls(cover) : null };
}
