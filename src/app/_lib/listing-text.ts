import { type z } from "zod";

import {
  type listingTypeSchema,
  type propertyTypeSchema,
} from "~/lib/validators/property";

// Plain shapes instead of importing the tRPC types: this file stays importable from unit tests
// without loading the React client. The card from `property.list` fits them.
type ListingType = z.infer<typeof listingTypeSchema>;
type CardLocation = { neighborhood: string | null; city: string };
type CardFeatures = { bedrooms: number | null; areaM2: number | null };

/** "Gràcia, Barcelona" when the listing has a neighbourhood, otherwise just the city. */
export function cardLocation({ neighborhood, city }: CardLocation): string {
  const parts = [neighborhood?.trim(), city.trim()].filter(Boolean);
  return parts.join(", ");
}

/**
 * The short facts under the price: bedrooms and m², only the ones the listing has.
 * 0 bedrooms is a real value (studios, offices), so it is shown; `null` means "not given".
 */
export function cardFeatures({ bedrooms, areaM2 }: CardFeatures): string[] {
  const features: string[] = [];
  if (bedrooms != null) {
    features.push(bedrooms === 1 ? "1 bedroom" : `${bedrooms} bedrooms`);
  }
  if (areaM2 != null) features.push(`${areaM2} m²`);
  return features;
}

/** Message shown when the list has no listings (US-09: "veig un missatge informatiu"). */
export function emptyListingsMessage(listingType?: ListingType): string {
  switch (listingType) {
    case "SALE":
      return "There are no homes for sale right now. Check back soon.";
    case "RENT":
      return "There are no homes for rent right now. Check back soon.";
    default:
      return "There are no homes listed right now. Check back soon.";
  }
}

// --- Listing detail (US-12) ---

type PropertyType = z.infer<typeof propertyTypeSchema>;
type ListingStatus = "DRAFT" | "PUBLISHED" | "RESERVED" | "CLOSED";
type DetailFacts = {
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
};
type DetailAmenities = {
  hasElevator: boolean;
  hasParking: boolean;
  isFurnished: boolean;
};
type DetailLocation = {
  address: string;
  neighborhood: string | null;
  postalCode: string | null;
  city: string;
  province: string;
};

/** "For sale" / "For rent": the operation shown next to the price. */
export function listingTypeLabel(listingType: ListingType): string {
  return listingType === "RENT" ? "For rent" : "For sale";
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: "Apartment",
  HOUSE: "House",
  STUDIO: "Studio",
  ROOM: "Room",
  OFFICE: "Office",
  LAND: "Land",
  OTHER: "Other",
};

export function propertyTypeLabel(propertyType: PropertyType): string {
  return PROPERTY_TYPE_LABELS[propertyType];
}

/**
 * The facts table of the detail page: area, bedrooms, bathrooms and floor, only the ones the
 * listing has. As on the cards, 0 is a real value and `null` means "not given".
 */
export function detailFacts({
  areaM2,
  bedrooms,
  bathrooms,
  floor,
}: DetailFacts): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  if (areaM2 != null) facts.push({ label: "Area", value: `${areaM2} m²` });
  if (bedrooms != null) facts.push({ label: "Bedrooms", value: `${bedrooms}` });
  if (bathrooms != null) {
    facts.push({ label: "Bathrooms", value: `${bathrooms}` });
  }
  const trimmedFloor = floor?.trim();
  if (trimmedFloor) facts.push({ label: "Floor", value: trimmedFloor });
  return facts;
}

/** Extras the listing has: lift, parking and furnished. */
export function detailAmenities({
  hasElevator,
  hasParking,
  isFurnished,
}: DetailAmenities): string[] {
  const amenities: string[] = [];
  if (hasElevator) amenities.push("Lift");
  if (hasParking) amenities.push("Parking");
  if (isFurnished) amenities.push("Furnished");
  return amenities;
}

/**
 * Full location on one line: "Carrer de Verdi 12, Gràcia, 08012 Barcelona". The province is only
 * added when it isn't the same as the city ("Sant Cugat del Vallès, Barcelona").
 */
export function detailLocation({
  address,
  neighborhood,
  postalCode,
  city,
  province,
}: DetailLocation): string {
  const cityLine = [postalCode?.trim(), city.trim()].filter(Boolean).join(" ");
  const sameProvince =
    province.trim().toLowerCase() === city.trim().toLowerCase();
  return [
    address.trim(),
    neighborhood?.trim(),
    cityLine,
    sameProvince ? undefined : province.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Banner for listings that can't be contacted as usual. `null` for a published listing.
 * Reserved and closed listings stay visible so shared links keep working (US-12).
 */
export function listingStatusNotice(
  status: ListingStatus,
  listingType: ListingType,
): string | null {
  switch (status) {
    case "DRAFT":
      return "This listing is a draft: only you can see it.";
    case "RESERVED":
      return "This home is reserved.";
    case "CLOSED":
      return listingType === "RENT"
        ? "This home has already been rented."
        : "This home has already been sold.";
    case "PUBLISHED":
      return null;
  }
}

/** Login link that comes back to the listing afterwards (Contact without a session, US-12.F2). */
export function loginToContactHref(propertyId: string): string {
  return `/login?callbackUrl=${encodeURIComponent(`/properties/${propertyId}`)}`;
}
