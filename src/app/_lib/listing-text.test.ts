import { describe, expect, it } from "vitest";

import {
  cardFeatures,
  cardLocation,
  emptyListingsMessage,
} from "./listing-text";

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
