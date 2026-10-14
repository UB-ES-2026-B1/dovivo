import { describe, expect, it } from "vitest";

import { savedSearchFiltersSchema } from "./property";

describe("savedSearchFiltersSchema", () => {
  it("keeps the search filters but drops pagination state", () => {
    const parsed = savedSearchFiltersSchema.parse({
      listingType: "RENT",
      city: "Barcelona",
      maxPriceCents: 150_000,
      limit: 20,
      cursor: "prop_1",
    });

    expect(parsed).toEqual({
      listingType: "RENT",
      city: "Barcelona",
      maxPriceCents: 150_000,
    });
  });
});
