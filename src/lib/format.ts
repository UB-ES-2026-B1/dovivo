import { type z } from "zod";

import { type listingTypeSchema } from "~/lib/validators/property";

/** Formats a price stored in cents, e.g. 125000000 -> "1.250.000 €". */
export function formatPrice(
  priceCents: number,
  {
    currency = "EUR",
    locale = "es-ES",
    listingType,
  }: {
    currency?: string;
    locale?: string;
    listingType?: z.infer<typeof listingTypeSchema>;
  } = {},
): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);

  return listingType === "RENT" ? `${formatted}/month` : formatted;
}
