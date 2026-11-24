import { z } from "zod";

/**
 * Shared zod schemas for the chat (US-21, contract §7). Used by the tRPC router (server-side
 * validation) and by the contact form on the listing page, so both sides give the same errors.
 */

/** Longest message accepted. Long enough for any question about a home, short enough for an email. */
export const MESSAGE_MAX_LENGTH = 2000;

/** Text of a message: trimmed, never empty (US-21: "No es poden enviar missatges buits"). */
export const messageBodySchema = z
  .string()
  .trim()
  .min(1, "Write a message.")
  .max(
    MESSAGE_MAX_LENGTH,
    `A message can have at most ${MESSAGE_MAX_LENGTH} characters.`,
  );

/** `conversation.start`: first (or next) message of the signed-in user about one listing. */
export const startConversationSchema = z.object({
  /** Ids are cuids, so 50 chars is plenty. */
  propertyId: z.string().trim().min(1).max(50),
  body: messageBodySchema,
});

/** What the form sends, e.g. for react-hook-form with `zodResolver`. */
export type StartConversationInput = z.input<typeof startConversationSchema>;
export type StartConversationParams = z.output<typeof startConversationSchema>;
