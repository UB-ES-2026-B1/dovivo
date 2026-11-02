import { type z } from "zod";

import { type listingTypeSchema } from "~/lib/validators/property";

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
