import { describe, expect, it } from "vitest";

import { phoneSchema, updateProfileSchema } from "./user";

describe("phoneSchema", () => {
  it.each([
    ["a Spanish mobile", "600000000", "600000000"],
    ["an international number", "+34600000000", "+34600000000"],
    ["spaces", " +34 600 00 00 00 ", "+34600000000"],
    ["dashes, dots and brackets", "(+34) 600-00.00.00", "+34600000000"],
    ["the 15-digit maximum", "+123456789012345", "+123456789012345"],
  ])("accepts %s and strips separators", (_label, input, stored) => {
    expect(phoneSchema.parse(input)).toBe(stored);
  });

  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
  ])("clears the phone with %s", (_label, input) => {
    expect(phoneSchema.parse(input)).toBeNull();
  });

  it.each([
    ["letters", "600abc000"],
    ["too few digits", "60000000"],
    ["too many digits", "+1234567890123456"],
    ["a + in the middle", "600+000000"],
    ["only a +", "+"],
  ])("rejects %s", (_label, input) => {
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });

  it("rejects very long input before stripping separators", () => {
    // 9 digits once stripped, but 33 characters as typed.
    const padded = "600000000".split("").join("---");
    expect(phoneSchema.safeParse(padded).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts a name and a phone", () => {
    expect(
      updateProfileSchema.parse({ name: "  Ana  ", phone: "600 000 000" }),
    ).toEqual({ name: "Ana", phone: "600000000" });
  });

  it("accepts null to clear the phone", () => {
    expect(updateProfileSchema.parse({ phone: null })).toEqual({
      phone: null,
    });
  });

  it("accepts an empty object (nothing to change)", () => {
    expect(updateProfileSchema.parse({})).toEqual({});
  });

  it("strips fields that are not editable", () => {
    expect(
      updateProfileSchema.parse({
        name: "Ana",
        email: "other@example.com",
        role: "ADMIN",
      }),
    ).toEqual({ name: "Ana" });
  });

  it.each([
    ["empty", ""],
    ["1 character", "A"],
    ["null", null],
  ])("rejects a %s name", (_label, name) => {
    const result = updateProfileSchema.safeParse({ name });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.name).toBeDefined();
  });

  it("reports the invalid phone per field", () => {
    const result = updateProfileSchema.safeParse({
      name: "Ana",
      phone: "abc",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.phone).toBeDefined();
  });
});
