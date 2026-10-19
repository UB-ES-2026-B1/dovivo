import { z } from "zod";

/**
 * Shared zod schemas for messages to the dovivo team (contact form, US-25). Used by the tRPC
 * router (server-side validation) and can be reused by frontend forms so both sides stay in sync.
 *
 * Keep the enum values aligned with `prisma/schema.prisma`.
 */
export const contactStatusSchema = z.enum(["OPEN", "ANSWERED", "CLOSED"]);

export type ContactStatus = z.infer<typeof contactStatusSchema>;
