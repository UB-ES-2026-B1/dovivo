import { describe, expect, it } from "vitest";

import { createPropertySchema } from "~/lib/validators/property";

import {
  MAX_PRICE_EUROS,
  parseEuros,
  parseWholeNumber,
  readPropertyForm,
  toFormErrors,
} from "./property-form";

/** A valid form, as the browser sends it (checkboxes only when ticked). */
function validForm(overrides: Record<string, string | null> = {}): FormData {
  const fields: Record<string, string | null> = {
    title: "Bright flat near the beach",
    listingType: "SALE",
    propertyType: "APARTMENT",
    price: "250.000",
    areaM2: "85",
    bedrooms: "3",
    bathrooms: "2",
    floor: "3rd",
    address: "Carrer de Mallorca 120",
    neighborhood: "",
    city: "Barcelona",
    province: "Barcelona",
    postalCode: "08 036",
    description:
      "A bright flat with a balcony, close to the beach and the metro.",
    hasParking: "on",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) form.set(key, value);
  }
  return form;
}

describe("parseEuros", () => {
  it("reads whole euros and returns cents", () => {
    expect(parseEuros("250000")).toEqual({ ok: true, value: 25_000_000 });
  });

  it("accepts spaces and dots as thousands separators", () => {
    expect(parseEuros("250 000")).toEqual({ ok: true, value: 25_000_000 });
    expect(parseEuros("1.250.000")).toEqual({ ok: true, value: 125_000_000 });
  });

  it("gives undefined for an empty field, so the schema says it's required", () => {
    expect(parseEuros("  ")).toEqual({ ok: true, value: undefined });
  });

  it("refuses decimals and other text instead of guessing", () => {
    for (const text of ["1.5", "1500,50", "12.34.5", "-100", "abc", "1e6"]) {
      expect(parseEuros(text).ok, text).toBe(false);
    }
  });

  it("refuses prices that don't fit the database", () => {
    expect(parseEuros(String(MAX_PRICE_EUROS))).toEqual({
      ok: true,
      value: MAX_PRICE_EUROS * 100,
    });
    expect(parseEuros(String(MAX_PRICE_EUROS + 1))).toMatchObject({
      ok: false,
    });
  });
});

describe("parseWholeNumber", () => {
  it("reads whole numbers, including 0", () => {
    expect(parseWholeNumber(" 3 ")).toEqual({ ok: true, value: 3 });
    expect(parseWholeNumber("0")).toEqual({ ok: true, value: 0 });
  });

  it("gives undefined for an empty field (not given)", () => {
    expect(parseWholeNumber("")).toEqual({ ok: true, value: undefined });
  });

  it("refuses decimals, negatives and text", () => {
    for (const text of ["2.5", "-1", "two"]) {
      expect(parseWholeNumber(text).ok, text).toBe(false);
    }
  });
});

describe("toFormErrors", () => {
  it("shows the price errors on the price field", () => {
    expect(toFormErrors({ priceCents: ["Required"] })).toEqual({
      price: ["Required"],
    });
  });

  it("replaces zod's enum message with a friendly one", () => {
    expect(
      toFormErrors({
        listingType: ["Invalid enum value"],
        propertyType: ["Required"],
      }),
    ).toEqual({
      listingType: ["Choose sale or rent"],
      propertyType: ["Choose the type of property"],
    });
  });

  it("skips fields without messages", () => {
    expect(toFormErrors({ title: [], city: undefined })).toEqual({});
  });
});

describe("readPropertyForm", () => {
  it("returns an input that property.create accepts", () => {
    const result = readPropertyForm(validForm());

    expect(result.fieldErrors).toBeUndefined();
    expect(result.input).toMatchObject({
      priceCents: 25_000_000,
      bedrooms: 3,
      bathrooms: 2,
      areaM2: 85,
      hasParking: true,
      hasElevator: false,
      isFurnished: false,
    });
    const parsed = createPropertySchema.parse(result.input);
    expect(parsed.postalCode).toBe("08036");
    expect(parsed.neighborhood).toBeNull();
  });

  it("keeps the values as typed, to show the form again", () => {
    const { values } = readPropertyForm(validForm());
    expect(values.price).toBe("250.000");
    expect(values.postalCode).toBe("08 036");
    expect(values.hasParking).toBe(true);
    expect(values.hasElevator).toBe(false);
  });

  it("leaves out the optional numbers when they are empty", () => {
    const { input } = readPropertyForm(
      validForm({ areaM2: "", bedrooms: "", bathrooms: "" }),
    );
    expect(input).toMatchObject({
      areaM2: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
    });
  });

  it("names every missing required field", () => {
    const result = readPropertyForm(new FormData());

    expect(result.input).toBeUndefined();
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(
      [
        "address",
        "city",
        "description",
        "listingType",
        "price",
        "propertyType",
        "province",
        "title",
      ].sort(),
    );
    expect(result.fieldErrors?.listingType).toEqual(["Choose sale or rent"]);
    expect(result.fieldErrors?.title).toEqual(["This field is required"]);
    expect(result.fieldErrors?.price).toEqual(["This field is required"]);
  });

  it("explains a number it can't read instead of saying it's required", () => {
    const result = readPropertyForm(
      validForm({ price: "250k", bedrooms: "two" }),
    );
    expect(result.fieldErrors?.price?.[0]).toMatch(/whole euros/);
    expect(result.fieldErrors?.bedrooms?.[0]).toMatch(/whole number/);
  });

  it("refuses a listing with a 0 € price", () => {
    const result = readPropertyForm(validForm({ price: "0" }));
    expect(result.fieldErrors?.price).toBeDefined();
  });

  it("uses the schema's rules for the text fields", () => {
    const result = readPropertyForm(
      validForm({
        title: "Flat",
        postalCode: "99999",
        description: "Too short",
      }),
    );
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
      "description",
      "postalCode",
      "title",
    ]);
  });

  it("refuses an operation or type that doesn't exist", () => {
    const result = readPropertyForm(
      validForm({ listingType: "SWAP", propertyType: "CASTLE" }),
    );
    expect(result.fieldErrors).toMatchObject({
      listingType: ["Choose sale or rent"],
      propertyType: ["Choose the type of property"],
    });
  });

  it("ignores fields that aren't in the form, like an owner id", () => {
    const { input } = readPropertyForm(validForm({ ownerId: "someone-else" }));
    expect(input).not.toHaveProperty("ownerId");
  });
});
