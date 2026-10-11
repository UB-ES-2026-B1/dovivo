import { z } from "zod";

/**
 * Shared zod schemas for properties. Used by the tRPC router (server-side validation) and can be
 * reused by frontend forms (e.g. with react-hook-form's zodResolver) so both sides stay in sync.
 *
 * Keep the enum values aligned with `prisma/schema.prisma`.
 */
export const listingTypeSchema = z.enum(["SALE", "RENT"]);
export const propertyTypeSchema = z.enum([
  "APARTMENT",
  "HOUSE",
  "STUDIO",
  "ROOM",
  "OFFICE",
  "LAND",
  "OTHER",
]);

export const propertyFiltersSchema = z.object({
  listingType: listingTypeSchema.optional(),
  propertyType: propertyTypeSchema.optional(),
  city: z.string().trim().min(1).optional(),
  minPriceCents: z.number().int().nonnegative().optional(),
  maxPriceCents: z.number().int().nonnegative().optional(),
  minBedrooms: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const createPropertySchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(5000),
  listingType: listingTypeSchema,
  propertyType: propertyTypeSchema,
  priceCents: z.number().int().positive(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  areaM2: z.number().int().positive().optional(),
  address: z.string().trim().min(3),
  city: z.string().trim().min(2),
  province: z.string().trim().min(2),
  postalCode: z.string().trim().optional(),
});

export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
