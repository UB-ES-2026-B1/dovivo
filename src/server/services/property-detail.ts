import { type Prisma } from "@prisma/client";

/**
 * Listing detail resource (US-12): what the public detail page shows. Every field is listed
 * explicitly, so internal columns (`ownerId`, `deletedAt`, `createdAt`, image upload metadata)
 * and the owner's contact data (email, phone) never reach the response.
 */

/** Public image fields. Upload metadata (`mimeType`, `sizeBytes`) is internal. */
export const publicImageSelect = {
  id: true,
  url: true,
  thumbnailUrl: true,
  alt: true,
  position: true,
  isCover: true,
  width: true,
  height: true,
} satisfies Prisma.PropertyImageSelect;

/** Gallery order. `position` is unique per listing, so the order is deterministic. */
export const galleryOrderBy = {
  position: "asc",
} satisfies Prisma.PropertyImageOrderByWithRelationInput;

/** Advertiser shown on the detail page: name and avatar only, no contact data. */
export const publicOwnerSelect = {
  id: true,
  name: true,
  image: true,
} satisfies Prisma.UserSelect;

export const propertyDetailSelect = {
  id: true,
  title: true,
  description: true,
  listingType: true,
  propertyType: true,
  status: true,
  priceCents: true,
  currency: true,
  bedrooms: true,
  bathrooms: true,
  areaM2: true,
  floor: true,
  address: true,
  neighborhood: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  latitude: true,
  longitude: true,
  hasElevator: true,
  hasParking: true,
  isFurnished: true,
  publishedAt: true,
  updatedAt: true,
  images: { select: publicImageSelect, orderBy: galleryOrderBy },
  owner: { select: publicOwnerSelect },
  // Only needed to decide visibility; stripped by `toPropertyDetail`.
  deletedAt: true,
} satisfies Prisma.PropertySelect;

export type PropertyDetailRow = Prisma.PropertyGetPayload<{
  select: typeof propertyDetailSelect;
}>;

export type PropertyDetail = Omit<PropertyDetailRow, "deletedAt">;

/**
 * Who may see a listing's detail: nobody if it is soft-deleted (not even its owner), only the
 * owner while it is a draft, and everyone once published, reserved or closed.
 */
export function canViewPropertyDetail(
  row: Pick<PropertyDetailRow, "deletedAt" | "status" | "owner">,
  viewerId: string | undefined,
): boolean {
  if (row.deletedAt) return false;
  if (row.status === "DRAFT") return row.owner.id === viewerId;
  return true;
}

export function toPropertyDetail({
  deletedAt: _deletedAt,
  ...detail
}: PropertyDetailRow): PropertyDetail {
  return detail;
}
