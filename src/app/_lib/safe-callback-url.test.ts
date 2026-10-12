import { describe, expect, it } from "vitest";

import { safeCallbackUrl } from "./safe-callback-url";

describe("safeCallbackUrl", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackUrl("/publish")).toBe("/publish");
    expect(safeCallbackUrl("/buy?city=Barcelona")).toBe("/buy?city=Barcelona");
  });

  it("falls back to / for missing or external urls", () => {
    expect(safeCallbackUrl(undefined)).toBe("/");
    expect(safeCallbackUrl("https://evil.com")).toBe("/");
    expect(safeCallbackUrl("//evil.com")).toBe("/");
    expect(safeCallbackUrl("/\\evil.com")).toBe("/");
  });

  it("uses the first value when the param is repeated", () => {
    expect(safeCallbackUrl(["/rent", "https://evil.com"])).toBe("/rent");
  });
});
