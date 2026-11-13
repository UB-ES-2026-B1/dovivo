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

/** Identifies one listing (detail page, publish...). Ids are cuids, so 50 chars is plenty. */
export const propertyIdSchema = z.object({
  id: z.string().trim().min(1).max(50),
});

/** Largest value of a Postgres `integer` column. Bigger numbers would fail in the database. */
export const DB_INT_MAX = 2_147_483_647;

/** Integer that fits an `Int` column; `.positive()` / `.nonnegative()` are added per field. */
const dbIntSchema = z.number().int().max(DB_INT_MAX);

export const propertyFiltersSchema = z.object({
  listingType: listingTypeSchema.optional(),
  propertyType: propertyTypeSchema.optional(),
  city: z.string().trim().min(1).optional(),
  // Compared against `Int` columns: a bigger number would make Postgres fail with a 500.
  minPriceCents: dbIntSchema.nonnegative().optional(),
  maxPriceCents: dbIntSchema.nonnegative().optional(),
  minBedrooms: dbIntSchema.nonnegative().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

/** Filters stored in SavedSearch.filters: the search filters without pagination state. */
export const savedSearchFiltersSchema = propertyFiltersSchema.omit({
  limit: true,
  cursor: true,
});

/**
 * Optional free text. Forms send `""` for an empty field, which is stored as `null` instead of an
 * empty string. `null` (not `undefined`) so the same schema can clear the column when editing:
 * for Prisma `undefined` means "leave it unchanged".
 */
const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/**
 * Spanish postal code (listings are in Spain, `Property.country` defaults to "ES"): 5 digits, the
 * first two being the province (01-52).
 */
const POSTAL_CODE_PATTERN = /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/;

/**
 * Stored without spaces ("08 012" → "08012"). The length is only capped loosely before removing
 * them, so a code typed with spaces gets the postal code error instead of a generic length one.
 * Empty clears it to `null`, as in `optionalTextSchema`.
 */
const postalCodeSchema = z
  .string()
  .max(20)
  .transform((code) => code.replace(/\s/g, ""))
  .refine((code) => code === "" || POSTAL_CODE_PATTERN.test(code), {
    message: "Invalid postal code (5 digits, starting with 01-52)",
  })
  .transform((code) => (code === "" ? null : code))
  .nullable()
  .optional();

/**
 * Publish flow (US-17). Required: title, description, operation, type, price, address, city and
 * province. Owner, status and dates are not here: the owner comes from the session and the listing
 * starts as DRAFT until `property.publish`. Unknown keys are stripped by zod.
 */
export const createPropertySchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(5000),
  listingType: listingTypeSchema,
  propertyType: propertyTypeSchema,
  // > 0 as in the backend contract; ~21 M€ is the most an Int can hold.
  priceCents: dbIntSchema.positive(),
  // Optional because they don't apply to every type (land, offices...).
  bedrooms: dbIntSchema.nonnegative().optional(),
  bathrooms: dbIntSchema.nonnegative().optional(),
  areaM2: dbIntSchema.positive().optional(),
  floor: optionalTextSchema(20),
  address: z.string().trim().min(3).max(200),
  neighborhood: optionalTextSchema(100),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  postalCode: postalCodeSchema,
  hasElevator: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  isFurnished: z.boolean().optional(),
});

export type PropertyIdInput = z.infer<typeof propertyIdSchema>;
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;
export type SavedSearchFilters = z.infer<typeof savedSearchFiltersSchema>;
/** What the form sends (before the transforms), e.g. for react-hook-form with `zodResolver`. */
export type CreatePropertyInput = z.input<typeof createPropertySchema>;
