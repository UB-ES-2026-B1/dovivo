import { describe, expect, it } from "vitest";

import { normalizeSearchText, propertySearchColumns } from "./search-text";

describe("normalizeSearchText", () => {
  it.each([
    ["Sant Martí", "sant marti"],
    ["LLEIDA", "lleida"],
    ["Santa Eugènia", "santa eugenia"],
    ["Ca n’Aurell", "ca n'aurell"],
    ["Ca n´Aurell", "ca n'aurell"],
    ["Paral·lel", "parallel"],
    ["Paral.lel", "parallel"],
    ["paraŀlel", "parallel"],
    ["St. Cugat", "st cugat"],
    ["  Sant   Pere  i Sant Pau ", "sant pere i sant pau"],
    ["A Coruña", "a coruna"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });

  it("matches what users type without accents", () => {
    expect(normalizeSearchText("sant marti")).toBe(
      normalizeSearchText("Sant Martí"),
    );
  });
});

describe("propertySearchColumns", () => {
  it("normalises city and neighbourhood", () => {
    expect(
      propertySearchColumns({ city: "Girona", neighborhood: "Santa Eugènia" }),
    ).toEqual({ citySearch: "girona", neighborhoodSearch: "santa eugenia" });
  });

  it("stores no neighbourhood key when there is no neighbourhood", () => {
    for (const neighborhood of [undefined, null, "", "  "]) {
      expect(
        propertySearchColumns({ city: "Reus", neighborhood })
          .neighborhoodSearch,
      ).toBeNull();
    }
  });
});
