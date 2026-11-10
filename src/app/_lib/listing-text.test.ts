import { describe, expect, it } from "vitest";

import { propertyTypeSchema } from "~/lib/validators/property";

import {
  cardFeatures,
  cardLocation,
  detailAmenities,
  detailFacts,
  detailLocation,
  emptyListingsMessage,
  listingStatusNotice,
  listingTypeLabel,
  loginToContactHref,
  propertyTypeLabel,
} from "./listing-text";
import { safeCallbackUrl } from "./safe-callback-url";

describe("cardLocation", () => {
  it("shows the neighbourhood before the city", () => {
    expect(cardLocation({ neighborhood: "Gràcia", city: "Barcelona" })).toBe(
      "Gràcia, Barcelona",
    );
  });

  it("shows only the city when there is no neighbourhood", () => {
    expect(cardLocation({ neighborhood: null, city: "Girona" })).toBe("Girona");
  });

  it("ignores a blank neighbourhood", () => {
    expect(cardLocation({ neighborhood: "  ", city: "Lleida" })).toBe("Lleida");
  });
});

describe("cardFeatures", () => {
  it("shows bedrooms and area", () => {
    expect(cardFeatures({ bedrooms: 3, areaM2: 85 })).toEqual([
      "3 bedrooms",
      "85 m²",
    ]);
  });

  it("uses the singular for one bedroom", () => {
    expect(cardFeatures({ bedrooms: 1, areaM2: null })).toEqual(["1 bedroom"]);
  });

  it("keeps 0 bedrooms, which is a real value", () => {
    expect(cardFeatures({ bedrooms: 0, areaM2: 30 })).toEqual([
      "0 bedrooms",
      "30 m²",
    ]);
  });

  it("leaves out what the listing does not give", () => {
    expect(cardFeatures({ bedrooms: null, areaM2: null })).toEqual([]);
  });
});

describe("emptyListingsMessage", () => {
  it("names the operation the visitor chose", () => {
    expect(emptyListingsMessage("SALE")).toContain("for sale");
    expect(emptyListingsMessage("RENT")).toContain("for rent");
  });

  it("has a general message when there is no filter", () => {
    expect(emptyListingsMessage()).toBe(
      "There are no homes listed right now. Check back soon.",
    );
  });
});

describe("listingTypeLabel", () => {
  it("names the operation", () => {
    expect(listingTypeLabel("SALE")).toBe("For sale");
    expect(listingTypeLabel("RENT")).toBe("For rent");
  });
});

describe("propertyTypeLabel", () => {
  it("has a label for every property type", () => {
    for (const type of propertyTypeSchema.options) {
      expect(propertyTypeLabel(type)).toMatch(/^[A-Z][a-z]+$/);
    }
  });
});

describe("detailFacts", () => {
  it("shows area, bedrooms, bathrooms and floor in that order", () => {
    expect(
      detailFacts({ areaM2: 85, bedrooms: 3, bathrooms: 2, floor: "3" }),
    ).toEqual([
      { label: "Area", value: "85 m²" },
      { label: "Bedrooms", value: "3" },
      { label: "Bathrooms", value: "2" },
      { label: "Floor", value: "3" },
    ]);
  });

  it("keeps 0 and skips the facts that aren't given", () => {
    expect(
      detailFacts({ areaM2: null, bedrooms: 0, bathrooms: null, floor: " " }),
    ).toEqual([{ label: "Bedrooms", value: "0" }]);
  });
});

describe("detailAmenities", () => {
  it("lists only the extras the listing has", () => {
    expect(
      detailAmenities({
        hasElevator: true,
        hasParking: false,
        isFurnished: true,
      }),
    ).toEqual(["Lift", "Furnished"]);
    expect(
      detailAmenities({
        hasElevator: false,
        hasParking: false,
        isFurnished: false,
      }),
    ).toEqual([]);
  });
});

describe("detailLocation", () => {
  it("joins address, neighbourhood, postal code and city", () => {
    expect(
      detailLocation({
        address: "Carrer de Verdi 12",
        neighborhood: "Gràcia",
        postalCode: "08012",
        city: "Barcelona",
        province: "Barcelona",
      }),
    ).toBe("Carrer de Verdi 12, Gràcia, 08012 Barcelona");
  });

  it("adds the province when it isn't the city and skips missing parts", () => {
    expect(
      detailLocation({
        address: "Rambla 5",
        neighborhood: null,
        postalCode: null,
        city: "Sant Cugat del Vallès",
        province: "Barcelona",
      }),
    ).toBe("Rambla 5, Sant Cugat del Vallès, Barcelona");
  });
});

describe("listingStatusNotice", () => {
  it("shows nothing for a published listing", () => {
    expect(listingStatusNotice("PUBLISHED", "SALE")).toBeNull();
  });

  it("says when a home is reserved, sold or rented, or still a draft", () => {
    expect(listingStatusNotice("RESERVED", "SALE")).toBe(
      "This home is reserved.",
    );
    expect(listingStatusNotice("CLOSED", "SALE")).toMatch(/sold/);
    expect(listingStatusNotice("CLOSED", "RENT")).toMatch(/rented/);
    expect(listingStatusNotice("DRAFT", "RENT")).toMatch(/only you/);
  });
});

describe("loginToContactHref", () => {
  it("goes to the login and back to the listing", () => {
    expect(loginToContactHref("clx123")).toBe(
      "/login?callbackUrl=%2Fproperties%2Fclx123",
    );
  });

  it("is accepted by the login's callbackUrl check", () => {
    const callbackUrl = new URL(
      loginToContactHref("clx123"),
      "http://localhost",
    ).searchParams.get("callbackUrl");
    expect(safeCallbackUrl(callbackUrl ?? undefined)).toBe(
      "/properties/clx123",
    );
  });
});
