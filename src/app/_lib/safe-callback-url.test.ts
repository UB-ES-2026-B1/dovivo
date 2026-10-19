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

  it("falls back to / when tabs or newlines would turn the path into //evil.com", () => {
    // `?callbackUrl=/%09/evil.com` reaches us as "/\t/evil.com"; browsers drop the tab.
    expect(safeCallbackUrl("/\t/evil.com")).toBe("/");
    expect(safeCallbackUrl("/\n/evil.com")).toBe("/");
    expect(safeCallbackUrl("/\r\n/evil.com")).toBe("/");
    expect(safeCallbackUrl("/\t\\evil.com")).toBe("/");
  });

  it("keeps the hash", () => {
    expect(safeCallbackUrl("/rent#map")).toBe("/rent#map");
  });

  it("uses the first value when the param is repeated", () => {
    expect(safeCallbackUrl(["/rent", "https://evil.com"])).toBe("/rent");
  });
});
