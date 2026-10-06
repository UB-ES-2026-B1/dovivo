import Link from "next/link";

import { formatPrice } from "~/lib/format";
import { type RouterOutputs } from "~/trpc/react";

type PropertyListItem = RouterOutputs["property"]["list"]["items"][number];

export function PropertyCard({ property }: { property: PropertyListItem }) {
  const cover = property.images[0];

  return (
    <Link
      href={`/properties/${property.id}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="aspect-video bg-slate-100">
        {cover && (
          // TODO(frontend): switch to next/image once an image host is configured
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={cover.alt ?? property.title}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-lg font-bold text-slate-900">
          {formatPrice(property.priceCents, {
            currency: property.currency,
            listingType: property.listingType,
          })}
        </p>
        <h3 className="font-medium text-slate-800">{property.title}</h3>
        <p className="text-sm text-slate-500">
          {property.city}
          {property.bedrooms != null && ` · ${property.bedrooms} bd`}
          {property.areaM2 != null && ` · ${property.areaM2} m²`}
        </p>
      </div>
    </Link>
  );
}
