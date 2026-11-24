import { describe, expect, it } from "vitest";

import {
  charactersLeft,
  checkMessage,
  contactFailure,
  GENERIC_CONTACT_ERROR,
} from "~/app/_lib/contact-form";
import { MESSAGE_MAX_LENGTH } from "~/lib/validators/conversation";

/** A tRPC client error as the form receives it: `message` plus `data.code`. */
function trpcError(
  code: string,
  message = "",
  fieldErrors?: Record<string, string[]>,
) {
  return {
    message,
    data: { code, zodError: fieldErrors ? { fieldErrors } : null },
  };
}

describe("checkMessage", () => {
  it("refuses an empty or blank message, as the server does", () => {
    expect(checkMessage("")).toBe("Write a message.");
    expect(checkMessage("   \n\t ")).toBe("Write a message.");
  });

  it("accepts a message up to the limit, ignoring the spaces at the ends", () => {
    expect(checkMessage("Is it still available?")).toBeNull();
    expect(checkMessage(`  ${"a".repeat(MESSAGE_MAX_LENGTH)}  `)).toBeNull();
  });

  it("refuses a message over the limit", () => {
    expect(checkMessage("a".repeat(MESSAGE_MAX_LENGTH + 1))).toBe(
      `A message can have at most ${MESSAGE_MAX_LENGTH} characters.`,
    );
  });
});

describe("charactersLeft", () => {
  it("counts like the server, without the spaces at the ends", () => {
    expect(charactersLeft("")).toBe(MESSAGE_MAX_LENGTH);
    expect(charactersLeft("  hi  ")).toBe(MESSAGE_MAX_LENGTH - 2);
  });

  it("goes below zero when the message is too long", () => {
    expect(charactersLeft("a".repeat(MESSAGE_MAX_LENGTH + 5))).toBe(-5);
  });
});

describe("contactFailure", () => {
  it("sends to the login when the session has expired", () => {
    expect(contactFailure(trpcError("UNAUTHORIZED"))).toEqual({
      kind: "login",
    });
  });

  it("shows the server's message under the field for an invalid body", () => {
    expect(
      contactFailure(
        trpcError("BAD_REQUEST", "", { body: ["Write a message."] }),
      ),
    ).toEqual({ kind: "field", message: "Write a message." });
  });

  it("shows a general error for a bad request that isn't about the body", () => {
    expect(
      contactFailure(
        trpcError("BAD_REQUEST", "", { propertyId: ["Required"] }),
      ),
    ).toEqual({ kind: "form", message: GENERIC_CONTACT_ERROR });
  });

  it("shows the server's message for the own listing and the rate limit", () => {
    expect(
      contactFailure(
        trpcError(
          "FORBIDDEN",
          "You can't send a message about your own listing.",
        ),
      ),
    ).toEqual({
      kind: "form",
      message: "You can't send a message about your own listing.",
    });
    expect(
      contactFailure(
        trpcError(
          "TOO_MANY_REQUESTS",
          "Too many messages. Please try again later.",
        ),
      ),
    ).toEqual({
      kind: "form",
      message: "Too many messages. Please try again later.",
    });
  });

  it("says the listing is gone when it was deleted meanwhile", () => {
    expect(contactFailure(trpcError("NOT_FOUND"))).toEqual({
      kind: "form",
      message: "This listing isn't available any more.",
    });
  });

  it("shows a general error for server and network errors", () => {
    expect(
      contactFailure(trpcError("INTERNAL_SERVER_ERROR", "db down")),
    ).toEqual({ kind: "form", message: GENERIC_CONTACT_ERROR });
    expect(contactFailure(new TypeError("Failed to fetch"))).toEqual({
      kind: "form",
      message: GENERIC_CONTACT_ERROR,
    });
  });
});
