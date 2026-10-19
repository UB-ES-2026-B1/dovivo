import { z } from "zod";

/**
 * Shared zod schemas for email + password authentication. Used by the tRPC `auth` router and the
 * Credentials provider (server-side validation) and can be reused by the sign-up / sign-in forms so
 * both sides report the same per-field errors.
 */

/**
 * Emails are stored trimmed and lowercased. Uniqueness doesn't rely on it: `User.email` is citext,
 * so it is case-insensitive for every sign-up path (OAuth emails aren't lowercased by us).
 */
const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const PASSWORD_MIN_LENGTH = 8;
/**
 * bcrypt only uses the first 72 BYTES of the password and silently ignores the rest, so longer
 * passwords are rejected instead of giving a false sense of security. The limit is checked on the
 * UTF-8 byte length (not `.max(72)` characters): accented letters take 2 bytes and most emoji 4,
 * so a 72-character password can exceed it. A single byte rule avoids reporting two errors for the
 * same problem; forms can still use `maxLength={PASSWORD_MAX_BYTES}` as a first hint.
 */
export const PASSWORD_MAX_BYTES = 72;

// More characters than bytes allowed can never fit, so huge inputs are rejected without encoding.
const fitsBcrypt = (password: string) =>
  password.length <= PASSWORD_MAX_BYTES &&
  new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES;
const tooLongMessage = `Password is too long (max ${PASSWORD_MAX_BYTES} bytes; accented characters and emoji count as more than one)`;

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .refine(fitsBcrypt, { message: tooLongMessage }),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).refine(fitsBcrypt, { message: tooLongMessage }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
