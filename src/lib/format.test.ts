import { describe, expect, it } from "vitest";

import { formatPrice } from "~/lib/format";

// Intl may use a narrow no-break space (U+202F / U+00A0) depending on the OS/ICU build,
// so normalise whitespace to keep the test identical on Linux, macOS and Windows.
const normalise = (s: string) => s.replace(/\s/g, " ");

describe("formatPrice", () => {
  it("formats sale prices in euros", () => {
    expect(normalise(formatPrice(25_000_000))).toBe("250.000 €");
  });

  it("adds a monthly suffix for rentals", () => {
    expect(normalise(formatPrice(95_000, { listingType: "RENT" }))).toBe(
      "950 €/month",
    );
  });
});
