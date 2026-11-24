import { safeCallbackUrl } from "~/app/_lib/safe-callback-url";

// Plain shapes instead of importing the tRPC types, so this file stays importable from unit tests
// without loading the React client (as `listing-text.ts`).
export type FavouriteAvailability =
  "AVAILABLE" | "RESERVED" | "CLOSED" | "UNAVAILABLE";
type ListingType = "SALE" | "RENT";

/**
 * Where a visitor goes when they press the heart (US-14): the login, and back to the page they
 * were on. `returnTo` goes through `safeCallbackUrl`, so it can never send them to another site.
 */
export function loginToFavouriteHref(returnTo: string): string {
  return `/login?callbackUrl=${encodeURIComponent(safeCallbackUrl(returnTo))}`;
}

/** Accessible name of the heart: says what pressing it will do, and for which listing. */
export function favouriteButtonLabel(
  isFavourite: boolean,
  title: string,
): string {
  return isFavourite
    ? `Remove "${title}" from favourites`
    : `Save "${title}" to favourites`;
}

/**
 * Badge for a saved listing that can't be visited as usual (US-14: "si un preferit s'elimina o es
 * marca com a no disponible, ho veig indicat"). `null` for an available one.
 */
export function availabilityLabel(
  availability: FavouriteAvailability,
  listingType: ListingType,
): string | null {
  switch (availability) {
    case "AVAILABLE":
      return null;
    case "RESERVED":
      return "Reserved";
    case "CLOSED":
      return listingType === "RENT" ? "Rented" : "Sold";
    case "UNAVAILABLE":
      return "No longer available";
  }
}

/**
 * Only `UNAVAILABLE` listings lose their link: their detail page answers 404. Reserved, sold and
 * rented ones still open (docs/api.md).
 */
export function canOpenFavourite(availability: FavouriteAvailability): boolean {
  return availability !== "UNAVAILABLE";
}

/**
 * The ids in the cache after saving or removing one, for the optimistic update of the hearts.
 * Saving puts it first (the list is newest saved first) and never twice; removing drops it.
 */
export function toggleFavouriteIds(
  ids: readonly string[],
  propertyId: string,
  save: boolean,
): string[] {
  const others = ids.filter((id) => id !== propertyId);
  return save ? [propertyId, ...others] : others;
}

export type FavouriteFormInput = {
  propertyId: string;
  /** `true` to save the listing, `false` to remove it. */
  save: boolean;
  /** Same-site path to come back to (no-JS form). */
  returnTo: string;
};

/**
 * Reads the heart's form (the no-JS path). `null` if it has no listing id or an unknown intent:
 * then nothing is saved or removed. The id length matches `favouritePropertySchema` (max 50).
 */
export function parseFavouriteForm(form: FormData): FavouriteFormInput | null {
  const returnTo = favouriteFormReturnTo(form);
  const rawId = form.get("propertyId");
  const intent = form.get("intent");
  const propertyId = typeof rawId === "string" ? rawId.trim() : "";

  if (propertyId === "" || propertyId.length > 50) return null;
  if (intent !== "save" && intent !== "remove") return null;
  return { propertyId, save: intent === "save", returnTo };
}

/** `returnTo` of a form even when the rest is invalid, so the user always lands back somewhere safe. */
export function favouriteFormReturnTo(form: FormData): string {
  const value = form.get("returnTo");
  return safeCallbackUrl(typeof value === "string" ? value : undefined);
}
