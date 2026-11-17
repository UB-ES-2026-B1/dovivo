/**
 * Search keys for location filters (US-10). Postgres `mode: "insensitive"` and citext ignore case
 * but not accents, so we store a normalised copy of `city` and `neighborhood` and filter on it
 * with a plain, indexed equals. The same function normalises what the user types.
 *
 * Keep it in sync with the backfill in
 * `prisma/migrations/20261109100000_property_search_columns/migration.sql`.
 */

/**
 * Lower case, no accents (`Martí` → `marti`), no Catalan middle dot or full stops (`Paral·lel`,
 * `Paral.lel` → `parallel`), typographic apostrophes as `'` and single spaces.
 */
export function normalizeSearchText(text: string): string {
  return (
    text
      // `ŀ` (U+0140) has no canonical decomposition, so NFD alone would keep it.
      .replace(/[ŀĿ]/g, "l")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[’‘`´]/g, "'")
      .replace(/[·.]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Search columns to store with a listing whenever its `city` or `neighborhood` is written. */
export function propertySearchColumns({
  city,
  neighborhood,
}: {
  city: string;
  neighborhood?: string | null;
}): { citySearch: string; neighborhoodSearch: string | null } {
  const neighborhoodSearch = neighborhood
    ? normalizeSearchText(neighborhood)
    : "";
  return {
    citySearch: normalizeSearchText(city),
    neighborhoodSearch: neighborhoodSearch || null,
  };
}
