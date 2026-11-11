import { describe, expect, it } from "vitest";

import {
  createPropertySchema,
  DB_INT_MAX,
  savedSearchFiltersSchema,
} from "./property";

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

const validListing = {
  title: "Pis lluminós a Gràcia",
  description: "Pis de 80 m² amb balcó, molt a prop del metro i de botigues.",
  listingType: "RENT",
  propertyType: "APARTMENT",
  priceCents: 120_000,
  address: "Carrer de Verdi, 10",
  city: "Barcelona",
  province: "Barcelona",
};

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

  it("treats empty optional text fields as not set", () => {
    const parsed = createPropertySchema.parse({
      ...validListing,
      floor: "",
      neighborhood: "  ",
      postalCode: "",
    });
    expect(parsed.floor).toBeUndefined();
    expect(parsed.neighborhood).toBeUndefined();
    expect(parsed.postalCode).toBeUndefined();
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
