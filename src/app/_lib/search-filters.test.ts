import { describe, expect, it } from "vitest";

import { DB_INT_MAX, propertyFiltersSchema } from "~/lib/validators/property";

import {
  hasSearchFilters,
  NO_SEARCH_RESULTS_MESSAGE,
  parseSearchParams,
  resultsCountLabel,
  searchQuery,
} from "./search-filters";

describe("parseSearchParams", () => {
  it("reads every filter from the URL and sends prices in cents", () => {
    const { values, filters } = parseSearchParams({
      city: "Barcelona",
      neighborhood: "Gràcia",
      type: "apartment",
      minPrice: "100000",
      maxPrice: "300000",
      bedrooms: "2",
      bathrooms: "1",
      minArea: "60",
      maxArea: "120",
      parking: "1",
    });

    expect(filters).toEqual({
      city: "Barcelona",
      neighborhood: "Gràcia",
      propertyType: "APARTMENT",
      minPriceCents: 10_000_000,
      maxPriceCents: 30_000_000,
      minBedrooms: 2,
      minBathrooms: 1,
      minAreaM2: 60,
      maxAreaM2: 120,
      hasParking: true,
    });
    expect(values).toMatchObject({ type: "APARTMENT", minPrice: "100000" });
  });

  it("returns no filters for an empty URL", () => {
    const { values, filters } = parseSearchParams({});
    expect(filters).toEqual({});
    expect(values).toEqual({
      city: "",
      neighborhood: "",
      type: "",
      minPrice: "",
      maxPrice: "",
      bedrooms: "",
      bathrooms: "",
      minArea: "",
      maxArea: "",
      parking: false,
    });
  });

  it("drops values the API would reject instead of breaking the page", () => {
    const { filters } = parseSearchParams({
      minPrice: "-5",
      maxPrice: "1e5",
      bedrooms: "2.5",
      bathrooms: "abc",
      minArea: "1".repeat(16),
      maxArea: "",
      type: "castle",
      city: ".",
      neighborhood: "·",
    });
    expect(filters).toEqual({});
  });

  it("caps numbers that don't fit the database, so a huge minimum finds nothing", () => {
    const { values, filters } = parseSearchParams({
      minPrice: "999999999",
      maxArea: "99999999999",
    });
    expect(filters).toEqual({
      minPriceCents: DB_INT_MAX,
      maxAreaM2: DB_INT_MAX,
    });
    // The form and the shared link keep what the user typed.
    expect(values).toMatchObject({
      minPrice: "999999999",
      maxArea: "99999999999",
    });
    expect(propertyFiltersSchema.safeParse(filters).success).toBe(true);
  });

  it("sends the largest price that fits in cents as it is", () => {
    expect(parseSearchParams({ minPrice: "21474836" }).filters).toEqual({
      minPriceCents: 2_147_483_600,
    });
  });

  it("removes leading zeros", () => {
    expect(parseSearchParams({ bedrooms: "007" }).values.bedrooms).toBe("7");
  });

  it("keeps text with symbols as long as it has letters (the API escapes it)", () => {
    expect(
      parseSearchParams({ city: `"><script>alert(1)</script>` }).filters,
    ).toEqual({ city: `"><script>alert(1)</script>` });
    expect(parseSearchParams({ city: "😀" }).filters).toEqual({ city: "😀" });
    expect(parseSearchParams({ city: "a".repeat(101) }).filters).toEqual({});
  });

  it("trims values and takes the first one when a key is repeated", () => {
    expect(
      parseSearchParams({ city: ["  Girona ", "Lleida"], bedrooms: " 3 " })
        .filters,
    ).toEqual({ city: "Girona", minBedrooms: 3 });
  });

  it("keeps 0 as a real minimum and ignores an unticked parking box", () => {
    expect(parseSearchParams({ minPrice: "0", parking: "0" }).filters).toEqual({
      minPriceCents: 0,
    });
  });

  it("only produces filters that property.list accepts", () => {
    const { filters } = parseSearchParams({
      city: "Sant Martí",
      minPrice: "21474836",
      bedrooms: "2147483647",
      type: "HOUSE",
      parking: "true",
    });
    expect(propertyFiltersSchema.safeParse(filters).success).toBe(true);
  });
});

describe("searchQuery", () => {
  it("writes the filters in a fixed order and skips the empty ones", () => {
    const { values } = parseSearchParams({
      parking: "on",
      maxPrice: "300000",
      type: "HOUSE",
      city: "Sant Martí",
    });
    expect(searchQuery(values)).toBe(
      "city=Sant+Mart%C3%AD&type=house&maxPrice=300000&parking=1",
    );
  });

  it("is empty without filters", () => {
    expect(searchQuery(parseSearchParams({}).values)).toBe("");
  });

  it("opens the same search again from the link (shareable URL)", () => {
    const original = parseSearchParams({
      neighborhood: "Paral·lel",
      minArea: "50",
      bedrooms: "3",
    });
    const shared = Object.fromEntries(
      new URLSearchParams(searchQuery(original.values)),
    );
    expect(parseSearchParams(shared)).toEqual(original);
  });
});

describe("hasSearchFilters", () => {
  it("is true when any filter is set", () => {
    expect(hasSearchFilters({})).toBe(false);
    expect(hasSearchFilters({ minBedrooms: 0 })).toBe(true);
    expect(hasSearchFilters({ city: "Reus" })).toBe(true);
  });

  it("doesn't count the operation or the page size", () => {
    expect(hasSearchFilters({ listingType: "RENT", limit: 20 })).toBe(false);
  });
});

describe("resultsCountLabel", () => {
  it("counts results in singular and plural", () => {
    expect(resultsCountLabel(0)).toBe("0 results");
    expect(resultsCountLabel(1)).toBe("1 result");
    expect(resultsCountLabel(1234)).toBe("1,234 results");
  });
});

describe("NO_SEARCH_RESULTS_MESSAGE", () => {
  it("suggests relaxing the filters", () => {
    expect(NO_SEARCH_RESULTS_MESSAGE).toMatch(/^No listings match/);
    expect(NO_SEARCH_RESULTS_MESSAGE).toMatch(/wider|fewer|another/);
  });
});
