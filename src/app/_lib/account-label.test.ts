import { describe, expect, it } from "vitest";

import { ACCOUNT_FALLBACK_LABEL, accountLabel } from "./account-label";

describe("accountLabel", () => {
  it("shows the user's name, trimmed", () => {
    expect(accountLabel("  Ada Lovelace ")).toBe("Ada Lovelace");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["whitespace only", "   "],
  ])("falls back to “My profile” for %s", (_label, name) => {
    expect(accountLabel(name)).toBe(ACCOUNT_FALLBACK_LABEL);
  });
});
