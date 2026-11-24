import {
  MESSAGE_MAX_LENGTH,
  messageBodySchema,
} from "~/lib/validators/conversation";

/**
 * Logic of the contact form on the listing page (US-21.F1 / F2), kept out of the React component
 * so it can be tested on its own. The checks use `messageBodySchema`, the same one as
 * `conversation.start`, so the form never sends a message the server would refuse.
 */

export const GENERIC_CONTACT_ERROR =
  "Your message couldn't be sent. Please try again.";

/** The error to show under the message, or `null` if it can be sent ("Write a message." if blank). */
export function checkMessage(text: string): string | null {
  const parsed = messageBodySchema.safeParse(text);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? null);
}

/** Characters still allowed, counted as the server does (without the spaces at the ends). */
export function charactersLeft(text: string): number {
  return MESSAGE_MAX_LENGTH - text.trim().length;
}

/** What to do when `conversation.start` fails. */
export type ContactFailure =
  /** No session any more: go to the login and come back to the listing. */
  | { kind: "login" }
  /** The message itself is wrong: show it under the field. */
  | { kind: "field"; message: string }
  /** Anything else: show it above the button, keeping what was typed. */
  | { kind: "form"; message: string };

type ErrorShape = {
  message?: unknown;
  data?: {
    code?: string;
    zodError?: { fieldErrors?: Record<string, string[] | undefined> } | null;
  } | null;
};

/** Reads a tRPC client error by its shape, so the tests don't need a real one. */
function asErrorShape(error: unknown): ErrorShape {
  return typeof error === "object" && error !== null ? error : {};
}

function serverMessage(error: ErrorShape, fallback: string): string {
  return typeof error.message === "string" && error.message !== ""
    ? error.message
    : fallback;
}

/** Turns a `conversation.start` error into what the form shows (docs/api.md, "Contact the advertiser"). */
export function contactFailure(error: unknown): ContactFailure {
  const shape = asErrorShape(error);
  switch (shape.data?.code) {
    case "UNAUTHORIZED":
      return { kind: "login" };
    case "BAD_REQUEST": {
      const message = shape.data.zodError?.fieldErrors?.body?.[0];
      return message
        ? { kind: "field", message }
        : { kind: "form", message: GENERIC_CONTACT_ERROR };
    }
    case "FORBIDDEN":
      return {
        kind: "form",
        message: serverMessage(
          shape,
          "You can't send a message about your own listing.",
        ),
      };
    case "NOT_FOUND":
      return {
        kind: "form",
        message: "This listing isn't available any more.",
      };
    case "TOO_MANY_REQUESTS":
      return {
        kind: "form",
        message: serverMessage(
          shape,
          "Too many messages. Please try again later.",
        ),
      };
    default:
      // Network errors (no `data`) and server errors: keep the text so the user can try again.
      return { kind: "form", message: GENERIC_CONTACT_ERROR };
  }
}
