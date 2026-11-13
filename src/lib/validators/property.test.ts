import { describe, expect, it } from "vitest";

import {
  createPropertySchema,
  DB_INT_MAX,
  propertyFiltersSchema,
  savedSearchFiltersSchema,
} from "./property";
import { validListing } from "./property.fixtures";

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

describe("propertyFiltersSchema", () => {
  it.each(["minPriceCents", "maxPriceCents", "minBedrooms"])(
    "rejects a %s that doesn't fit an Int and accepts the largest one",
    (field) => {
      expect(
        propertyFiltersSchema.safeParse({ [field]: DB_INT_MAX + 1 }).success,
      ).toBe(false);
      expect(
        propertyFiltersSchema.safeParse({ [field]: DB_INT_MAX }).success,
      ).toBe(true);
    },
  );

  it("applies the same limit to saved searches", () => {
    expect(
      savedSearchFiltersSchema.safeParse({ maxPriceCents: DB_INT_MAX + 1 })
        .success,
    ).toBe(false);
  });
});

const fieldErrors = (
  input: Record<string, unknown>,
): Record<string, string[] | undefined> =>
  createPropertySchema.safeParse(input).error?.flatten().fieldErrors ?? {};

describe("createPropertySchema", () => {
  it("accepts a listing with only the required fields", () => {
    expect(createPropertySchema.parse(validListing)).toEqual(validListing);
  });

  it("accepts every optional field", () => {
    const full = {
      ...validListing,
      bedrooms: 3,
      bathrooms: 0,
      areaM2: 80,
      floor: "3r",
      neighborhood: "Vila de Gràcia",
      postalCode: "08012",
      hasElevator: true,
      hasParking: false,
      isFurnished: true,
    };
    expect(createPropertySchema.parse(full)).toEqual(full);
  });

  it.each([
    "title",
    "description",
    "listingType",
    "propertyType",
    "priceCents",
    "address",
    "city",
    "province",
  ])("reports a missing %s on its field", (field) => {
    const input: Record<string, unknown> = { ...validListing };
    delete input[field];
    expect(fieldErrors(input)[field]).toBeDefined();
  });

  it.each([
    ["a zero price", { priceCents: 0 }, "priceCents"],
    ["a negative price", { priceCents: -100 }, "priceCents"],
    [
      "a price that doesn't fit an Int",
      { priceCents: DB_INT_MAX + 1 },
      "priceCents",
    ],
    ["a price with decimals", { priceCents: 100.5 }, "priceCents"],
    ["a zero area", { areaM2: 0 }, "areaM2"],
    ["negative bedrooms", { bedrooms: -1 }, "bedrooms"],
    ["negative bathrooms", { bathrooms: -1 }, "bathrooms"],
    ["an unknown property type", { propertyType: "CASTLE" }, "propertyType"],
    ["a blank city", { city: "   " }, "city"],
    ["a too long address", { address: "a".repeat(201) }, "address"],
    ["a postal code with letters", { postalCode: "08A12" }, "postalCode"],
    ["a too short postal code", { postalCode: "8012" }, "postalCode"],
    ["a too long postal code", { postalCode: "080123" }, "postalCode"],
    ["a postal code of province 00", { postalCode: "00000" }, "postalCode"],
    ["a postal code of province 53", { postalCode: "53001" }, "postalCode"],
    ["a postal code of province 99", { postalCode: "99999" }, "postalCode"],
  ])("rejects %s", (_label, change, field) => {
    expect(fieldErrors({ ...validListing, ...change })[field]).toBeDefined();
  });

  it("accepts the largest price an Int can hold", () => {
    expect(
      createPropertySchema.safeParse({
        ...validListing,
        priceCents: DB_INT_MAX,
      }).success,
    ).toBe(true);
  });

  it.each(["01001", "08012", "28013", "46001", "52001"])(
    "accepts the postal code %s",
    (postalCode) => {
      expect(
        createPropertySchema.parse({ ...validListing, postalCode }).postalCode,
      ).toBe(postalCode);
    },
  );

  it("removes the spaces of a postal code", () => {
    expect(
      createPropertySchema.parse({ ...validListing, postalCode: " 08 012 " })
        .postalCode,
    ).toBe("08012");
  });

  it("reports a postal code typed with spaces with the postal code message", () => {
    expect(fieldErrors({ ...validListing, postalCode: "08 0123" })).toEqual({
      postalCode: ["Invalid postal code (5 digits, starting with 01-52)"],
    });
  });

  it("stores empty optional text fields as null so they can be cleared", () => {
    const parsed = createPropertySchema.parse({
      ...validListing,
      floor: "",
      neighborhood: "  ",
      postalCode: "",
    });
    expect(parsed.floor).toBeNull();
    expect(parsed.neighborhood).toBeNull();
    expect(parsed.postalCode).toBeNull();
  });

  it("accepts null for the optional text fields", () => {
    const parsed = createPropertySchema.parse({
      ...validListing,
      floor: null,
      neighborhood: null,
      postalCode: null,
    });
    expect(parsed.floor).toBeNull();
    expect(parsed.neighborhood).toBeNull();
    expect(parsed.postalCode).toBeNull();
  });

  it("leaves omitted optional fields undefined", () => {
    const parsed = createPropertySchema.parse(validListing);
    expect(parsed).not.toHaveProperty("floor");
    expect(parsed).not.toHaveProperty("postalCode");
  });

  it("strips the owner, the status and other fields the client must not set", () => {
    const parsed = createPropertySchema.parse({
      ...validListing,
      ownerId: "someone_else",
      status: "PUBLISHED",
      publishedAt: new Date(),
    });
    expect(parsed).toEqual(validListing);
  });
});
