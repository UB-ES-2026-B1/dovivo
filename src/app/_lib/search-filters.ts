import { normalizeSearchText } from "~/lib/search-text";
import {
  DB_INT_MAX,
  type PropertyFilters,
  propertyTypeSchema,
} from "~/lib/validators/property";

/**
 * Search filters in the URL (US-10.F2). The query string is the single source of truth: the
 * filter form writes it, the listing pages read it, and a shared link opens the same search.
 *
 * Kept free of React so it can be unit tested. Anything invalid in the URL (a typo, a negative
 * price, text with no letters) is dropped instead of being sent: `property.list` would answer
 * BAD_REQUEST and the page would break.
 */

type PropertyType = (typeof propertyTypeSchema.options)[number];

/** What the filter form shows. Strings, as in the inputs; `""` means "any". */
export type SearchFormValues = {
  city: string;
  neighborhood: string;
  type: PropertyType | "";
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  bathrooms: string;
  minArea: string;
  maxArea: string;
  parking: boolean;
};

/** The `property.list` filters a search adds; the operation comes from the page (/buy, /rent). */
export type SearchFilters = Pick<
  PropertyFilters,
  | "city"
  | "neighborhood"
  | "propertyType"
  | "minPriceCents"
  | "maxPriceCents"
  | "minBedrooms"
  | "minBathrooms"
  | "minAreaM2"
  | "maxAreaM2"
  | "hasParking"
>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

const MAX_TEXT_LENGTH = 100;
/** Longest number kept from the URL; longer ones lose precision as a JS number. */
const MAX_DIGITS = 15;

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/** A whole number of 0 or more written with digits only (`"007"` → `"7"`), or `""`. */
function wholeNumber(value: string): string {
  if (!/^\d+$/.test(value) || value.length > MAX_DIGITS) return "";
  return String(Number(value));
}

/** Location text the API accepts: at most 100 characters and some letter or number. */
function locationText(value: string): string {
  if (value.length > MAX_TEXT_LENGTH) return "";
  return normalizeSearchText(value) === "" ? "" : value;
}

function propertyType(value: string): PropertyType | "" {
  const upper = value.toUpperCase();
  return propertyTypeSchema.options.find((type) => type === upper) ?? "";
}

/**
 * The number for the API, capped at the largest value an `Int` column holds (`DB_INT_MAX`).
 * Capping instead of dropping keeps the meaning: a minimum price of 999,999,999 € finds nothing,
 * and a huge maximum is the same as no maximum.
 */
const toNumber = (value: string, scale = 1): number | undefined =>
  value === "" ? undefined : Math.min(Number(value) * scale, DB_INT_MAX);

/**
 * Reads the filters from the URL (`searchParams` of a page, or a submitted form). Returns the
 * values for the form and the filters for `property.list`, both already cleaned.
 */
export function parseSearchParams(raw: RawSearchParams): {
  values: SearchFormValues;
  filters: SearchFilters;
} {
  const values: SearchFormValues = {
    city: locationText(first(raw.city)),
    neighborhood: locationText(first(raw.neighborhood)),
    type: propertyType(first(raw.type)),
    minPrice: wholeNumber(first(raw.minPrice)),
    maxPrice: wholeNumber(first(raw.maxPrice)),
    bedrooms: wholeNumber(first(raw.bedrooms)),
    bathrooms: wholeNumber(first(raw.bathrooms)),
    minArea: wholeNumber(first(raw.minArea)),
    maxArea: wholeNumber(first(raw.maxArea)),
    parking: ["1", "true", "on"].includes(first(raw.parking).toLowerCase()),
  };

  const filters: SearchFilters = {
    city: values.city || undefined,
    neighborhood: values.neighborhood || undefined,
    propertyType: values.type || undefined,
    // Prices are typed in whole euros and sent in cents.
    minPriceCents: toNumber(values.minPrice, 100),
    maxPriceCents: toNumber(values.maxPrice, 100),
    minBedrooms: toNumber(values.bedrooms),
    minBathrooms: toNumber(values.bathrooms),
    minAreaM2: toNumber(values.minArea),
    maxAreaM2: toNumber(values.maxArea),
    // Only `true` filters; an unticked box means "don't care".
    hasParking: values.parking || undefined,
  };

  // Leave out the filters that aren't set, so the query key is the same as without them.
  for (const key of Object.keys(filters) as (keyof SearchFilters)[]) {
    if (filters[key] === undefined) delete filters[key];
  }

  return { values, filters };
}

/** Order of the parameters in the URL, so the same search always gives the same link. */
const URL_KEYS = [
  "city",
  "neighborhood",
  "type",
  "minPrice",
  "maxPrice",
  "bedrooms",
  "bathrooms",
  "minArea",
  "maxArea",
] as const;

/** Query string for the form values, without `?`. Empty fields are left out. */
export function searchQuery(values: SearchFormValues): string {
  const params = new URLSearchParams();
  for (const key of URL_KEYS) {
    const value = values[key];
    if (value !== "")
      params.set(key, key === "type" ? value.toLowerCase() : value);
  }
  if (values.parking) params.set("parking", "1");
  return params.toString();
}

const SEARCH_FILTER_KEYS = [
  "city",
  "neighborhood",
  "propertyType",
  "minPriceCents",
  "maxPriceCents",
  "minBedrooms",
  "minBathrooms",
  "minAreaM2",
  "maxAreaM2",
  "hasParking",
] as const satisfies readonly (keyof SearchFilters)[];

/**
 * Whether any search filter is set. The operation (/buy, /rent) and the paging don't count:
 * without filters, an empty list is "no homes yet", not "relax your filters".
 */
export function hasSearchFilters(filters: Partial<PropertyFilters>): boolean {
  return SEARCH_FILTER_KEYS.some((key) => filters[key] !== undefined);
}

/** Results counter (US-10.F3): "1 result", "1,234 results". */
export function resultsCountLabel(total: number): string {
  return `${total.toLocaleString("en-US")} ${total === 1 ? "result" : "results"}`;
}

/** Shown when a search finds nothing (US-10.F3): suggests relaxing the filters. */
export const NO_SEARCH_RESULTS_MESSAGE =
  "No listings match these filters. Try a wider price range, fewer bedrooms or another location.";
