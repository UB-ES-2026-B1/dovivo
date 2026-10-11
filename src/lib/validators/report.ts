import { z } from "zod";

/**
 * Shared zod schemas for listing reports (moderation). Used by the tRPC router (server-side
 * validation) and can be reused by frontend forms so both sides stay in sync.
 *
 * Keep the enum values aligned with `prisma/schema.prisma`.
 */
export const reportReasonSchema = z.enum([
  "FRAUD",
  "WRONG_INFO",
  "DUPLICATE",
  "NOT_AVAILABLE",
  "OFFENSIVE",
  "OTHER",
]);
export const reportStatusSchema = z.enum(["PENDING", "RESOLVED", "DISMISSED"]);

export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
