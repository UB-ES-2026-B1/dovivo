import { describe, expect, it } from "vitest";

import {
  availabilityLabel,
  canOpenFavourite,
  favouriteButtonLabel,
  favouriteFormReturnTo,
  loginToFavouriteHref,
  parseFavouriteForm,
  toggleFavouriteIds,
} from "~/app/_lib/favourite-text";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("loginToFavouriteHref", () => {
  it("sends the visitor to the login and back to the page they were on", () => {
    expect(loginToFavouriteHref("/rent")).toBe("/login?callbackUrl=%2Frent");
    expect(loginToFavouriteHref("/properties/abc")).toBe(
      "/login?callbackUrl=%2Fproperties%2Fabc",
    );
  });

  it("keeps the search, so the user comes back to the same results", () => {
    expect(loginToFavouriteHref("/rent?city=Girona&minPrice=500")).toBe(
      "/login?callbackUrl=%2Frent%3Fcity%3DGirona%26minPrice%3D500",
    );
  });

  it("never comes back to another site", () => {
    expect(loginToFavouriteHref("https://evil.com")).toBe(
      "/login?callbackUrl=%2F",
    );
    expect(loginToFavouriteHref("//evil.com")).toBe("/login?callbackUrl=%2F");
  });
});

describe("favouriteButtonLabel", () => {
  it("says what pressing the heart will do, with the listing's title", () => {
    expect(favouriteButtonLabel(false, "Pis a Gràcia")).toBe(
      'Save "Pis a Gràcia" to favourites',
    );
    expect(favouriteButtonLabel(true, "Pis a Gràcia")).toBe(
      'Remove "Pis a Gràcia" from favourites',
    );
  });
});

describe("availabilityLabel", () => {
  it("shows no badge for an available listing", () => {
    expect(availabilityLabel("AVAILABLE", "SALE")).toBeNull();
  });

  it("marks reserved listings", () => {
    expect(availabilityLabel("RESERVED", "RENT")).toBe("Reserved");
  });

  it("says sold or rented depending on the operation", () => {
    expect(availabilityLabel("CLOSED", "SALE")).toBe("Sold");
    expect(availabilityLabel("CLOSED", "RENT")).toBe("Rented");
  });

  it("marks deleted listings or listings back to draft as no longer available", () => {
    expect(availabilityLabel("UNAVAILABLE", "SALE")).toBe(
      "No longer available",
    );
  });
});

describe("canOpenFavourite", () => {
  it("links every listing whose detail page still opens", () => {
    expect(canOpenFavourite("AVAILABLE")).toBe(true);
    expect(canOpenFavourite("RESERVED")).toBe(true);
    expect(canOpenFavourite("CLOSED")).toBe(true);
  });

  it("doesn't link an unavailable listing (its page is a 404)", () => {
    expect(canOpenFavourite("UNAVAILABLE")).toBe(false);
  });
});

describe("toggleFavouriteIds", () => {
  it("puts a newly saved listing first", () => {
    expect(toggleFavouriteIds(["a", "b"], "c", true)).toEqual(["c", "a", "b"]);
  });

  it("never saves a listing twice (double click)", () => {
    expect(toggleFavouriteIds(["a", "b"], "b", true)).toEqual(["b", "a"]);
  });

  it("removes a listing", () => {
    expect(toggleFavouriteIds(["a", "b"], "a", false)).toEqual(["b"]);
  });

  it("removing one that isn't saved changes nothing", () => {
    expect(toggleFavouriteIds(["a"], "z", false)).toEqual(["a"]);
    expect(toggleFavouriteIds([], "z", false)).toEqual([]);
  });

  it("doesn't change the list it was given (the cache)", () => {
    const ids = ["a", "b"];
    toggleFavouriteIds(ids, "c", true);
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("parseFavouriteForm", () => {
  it("reads a save", () => {
    expect(
      parseFavouriteForm(
        form({ propertyId: "p1", intent: "save", returnTo: "/rent" }),
      ),
    ).toEqual({ propertyId: "p1", save: true, returnTo: "/rent" });
  });

  it("reads a removal", () => {
    expect(
      parseFavouriteForm(
        form({ propertyId: " p1 ", intent: "remove", returnTo: "/favourites" }),
      ),
    ).toEqual({ propertyId: "p1", save: false, returnTo: "/favourites" });
  });

  it("rejects a form without an id, with a blank or too long id", () => {
    expect(parseFavouriteForm(form({ intent: "save" }))).toBeNull();
    expect(
      parseFavouriteForm(form({ propertyId: "  ", intent: "save" })),
    ).toBeNull();
    expect(
      parseFavouriteForm(form({ propertyId: "x".repeat(51), intent: "save" })),
    ).toBeNull();
  });

  it("rejects an unknown intent", () => {
    expect(parseFavouriteForm(form({ propertyId: "p1" }))).toBeNull();
    expect(
      parseFavouriteForm(form({ propertyId: "p1", intent: "toggle" })),
    ).toBeNull();
  });

  it("keeps the search in returnTo", () => {
    expect(
      parseFavouriteForm(
        form({ propertyId: "p1", intent: "save", returnTo: "/buy?city=Reus" }),
      )?.returnTo,
    ).toBe("/buy?city=Reus");
  });

  it("goes back home when returnTo is missing or points to another site", () => {
    expect(
      parseFavouriteForm(form({ propertyId: "p1", intent: "save" }))?.returnTo,
    ).toBe("/");
    expect(
      parseFavouriteForm(
        form({ propertyId: "p1", intent: "save", returnTo: "//evil.com" }),
      )?.returnTo,
    ).toBe("/");
  });
});

describe("favouriteFormReturnTo", () => {
  it("keeps a same-site path and drops anything else", () => {
    expect(favouriteFormReturnTo(form({ returnTo: "/buy" }))).toBe("/buy");
    expect(favouriteFormReturnTo(form({ returnTo: "https://evil.com" }))).toBe(
      "/",
    );
    expect(favouriteFormReturnTo(form({}))).toBe("/");
  });
});
