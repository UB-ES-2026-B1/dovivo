import { describe, expect, it } from "vitest";

import { PASSWORD_MAX_BYTES, signInSchema, signUpSchema } from "./auth";

const validSignUp = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "password123",
};

describe("signUpSchema", () => {
  it("accepts a valid sign-up", () => {
    expect(signUpSchema.safeParse(validSignUp)).toMatchObject({
      success: true,
      data: validSignUp,
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["1 character", "A"],
  ])("rejects a %s name", (_label, name) => {
    const result = signUpSchema.safeParse({ ...validSignUp, name });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.name).toBeDefined();
  });

  it("rejects an invalid email", () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toBeDefined();
  });

  it("trims and lowercases the email", () => {
    const result = signUpSchema.parse({
      ...validSignUp,
      email: "  Ada@Example.COM ",
    });
    expect(result.email).toBe("ada@example.com");
  });

  it("trims the name", () => {
    expect(signUpSchema.parse({ ...validSignUp, name: "  Ada  " }).name).toBe(
      "Ada",
    );
  });

  it.each([
    [7, false],
    [8, true],
    [72, true],
    [73, false],
  ])("password of %i characters -> valid: %s", (length, valid) => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      password: "x".repeat(length),
    });
    expect(result.success).toBe(valid);
    if (!valid) {
      expect(result.error?.flatten().fieldErrors.password).toBeDefined();
    }
  });

  it.each([
    // "é" is 2 bytes in UTF-8, "😀" is 4.
    ["36 x 'é' = 72 bytes", "é".repeat(36), true],
    ["37 x 'é' = 74 bytes (37 characters)", "é".repeat(37), false],
    ["18 emoji = 72 bytes", "😀".repeat(18), true],
    ["19 emoji = 76 bytes", "😀".repeat(19), false],
  ])("checks the UTF-8 byte length: %s", (_label, password, valid) => {
    const result = signUpSchema.safeParse({ ...validSignUp, password });
    expect(result.success).toBe(valid);
    if (!valid) {
      expect(result.error?.flatten().fieldErrors.password).toEqual([
        expect.stringContaining(`${PASSWORD_MAX_BYTES} bytes`),
      ]);
    }
  });

  it("reports a single error for an over-long ASCII password", () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      password: "x".repeat(500),
    });
    expect(result.error?.flatten().fieldErrors.password).toHaveLength(1);
  });

  it("reports every invalid field at once", () => {
    const result = signUpSchema.safeParse({
      name: "",
      email: "nope",
      password: "short",
    });
    expect(Object.keys(result.error?.flatten().fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
  });
});

describe("signInSchema", () => {
  it("accepts any non-empty password (length rules are for sign-up)", () => {
    expect(
      signInSchema.safeParse({ email: "ada@example.com", password: "x" })
        .success,
    ).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = signInSchema.safeParse({
      email: "ada@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password).toBeDefined();
  });

  it("rejects a password over 72 bytes", () => {
    const result = signInSchema.safeParse({
      email: "ada@example.com",
      password: "é".repeat(37),
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password).toBeDefined();
  });

  it("normalises the email like sign-up", () => {
    expect(
      signInSchema.parse({ email: " ADA@example.com", password: "x" }).email,
    ).toBe("ada@example.com");
  });
});
