import { $Enums } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { contactStatusSchema } from "./contact";
import { listingTypeSchema, propertyTypeSchema } from "./property";
import { reportReasonSchema, reportStatusSchema } from "./report";

/**
 * Guards AGENTS.md rule 4: zod enums must match the Prisma enums. If this fails, update the zod
 * schema in `src/lib/validators/` to mirror `prisma/schema.prisma` (same values, same order).
 */
describe("zod enums stay in sync with Prisma", () => {
  it.each([
    [
      "ListingType",
      listingTypeSchema.options,
      Object.values($Enums.ListingType),
    ],
    [
      "PropertyType",
      propertyTypeSchema.options,
      Object.values($Enums.PropertyType),
    ],
    [
      "ReportReason",
      reportReasonSchema.options,
      Object.values($Enums.ReportReason),
    ],
    [
      "ReportStatus",
      reportStatusSchema.options,
      Object.values($Enums.ReportStatus),
    ],
    [
      "ContactStatus",
      contactStatusSchema.options,
      Object.values($Enums.ContactStatus),
    ],
  ])("%s", (_name, zodValues, prismaValues) => {
    expect(zodValues).toEqual(prismaValues);
  });
});
