import { z } from "zod";

import { nameSchema } from "./auth";

/**
 * Shared zod schemas for the signed-in user's own profile (US-05). Used by the tRPC `user` router
 * (server-side validation) and can be reused by the profile form so both sides report the same
 * per-field errors.
 */

/** Separators people type in phone numbers ("+34 600-00.00 (00)"). Not stored. */
const PHONE_SEPARATORS = /[\s().-]/g;
/** Optional leading `+`, then 9 digits (a Spanish number) up to 15 (the E.164 maximum). */
const PHONE_PATTERN = /^\+?\d{9,15}$/;

/**
 * Phones are stored without separators ("+34 600 00 00 00" → "+34600000000"). The phone is
 * optional, so an empty string (what the form sends for an empty field) clears it to `null`.
 */
export const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .transform((phone) => phone.replace(PHONE_SEPARATORS, ""))
  .refine((phone) => phone === "" || PHONE_PATTERN.test(phone), {
    message:
      "Invalid phone number (9 to 15 digits, optionally starting with +)",
  })
  .transform((phone) => (phone === "" ? null : phone));

/**
 * Only the name and the phone are editable. The email is not (#21), and unknown keys such as
 * `email` or `role` are stripped by zod, so they can never reach the database. Omitted fields are
 * left unchanged.
 */
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.nullable().optional(),
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
