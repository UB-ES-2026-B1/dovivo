import { describe, expect, it } from "vitest";

import { MESSAGE_MAX_LENGTH, startConversationSchema } from "./conversation";

describe("startConversationSchema", () => {
  it("trims the message and accepts it", () => {
    expect(
      startConversationSchema.parse({
        propertyId: " prop_1 ",
        body: "  Is it still available?  ",
      }),
    ).toEqual({ propertyId: "prop_1", body: "Is it still available?" });
  });

  it("keeps the line breaks inside the message", () => {
    expect(
      startConversationSchema.parse({
        propertyId: "prop_1",
        body: "Hello,\n\nCan I visit it?",
      }).body,
    ).toBe("Hello,\n\nCan I visit it?");
  });

  it.each([
    ["an empty message", ""],
    ["a blank message", " \n\t "],
  ])("refuses %s (US-21)", (_case, body) => {
    const result = startConversationSchema.safeParse({
      propertyId: "prop_1",
      body,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.body).toEqual([
      "Write a message.",
    ]);
  });

  it("accepts the longest message and refuses a longer one", () => {
    const longest = "a".repeat(MESSAGE_MAX_LENGTH);
    expect(
      startConversationSchema.safeParse({ propertyId: "p", body: longest })
        .success,
    ).toBe(true);
    expect(
      startConversationSchema.safeParse({
        propertyId: "p",
        body: `${longest}a`,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["an empty id", ""],
    ["a too long id", "x".repeat(51)],
  ])("refuses %s", (_case, propertyId) => {
    expect(
      startConversationSchema.safeParse({ propertyId, body: "Hi" }).success,
    ).toBe(false);
  });
});
