import Link from "next/link";

import { cardFeatures, cardLocation } from "~/app/_lib/listing-text";
import { formatPrice } from "~/lib/format";
import { type RouterOutputs } from "~/trpc/react";

export type PropertyCardData =
  RouterOutputs["property"]["list"]["items"][number];

/**
 * Listing card (US-09): cover photo, price, title, location, bedrooms and m².
 * Reusable in every list of cards (home, /buy, /rent, search, favourites).
 */
export function PropertyCard({ property }: { property: PropertyCardData }) {
  const { cover } = property;
  const features = cardFeatures(property);

  return (
    <Link
      href={`/properties/${property.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none"
    >
      <div className="aspect-[3/2] bg-slate-100">
        {cover ? (
          // TODO(frontend): switch to next/image once an image host is configured
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.thumbnailUrl ?? cover.url}
            // The link text below already names the listing, so the photo is decorative here and
            // screen readers don't read "Foto 1" before every card.
            alt=""
            width={cover.width ?? undefined}
            height={cover.height ?? undefined}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No photo yet
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <p className="text-lg font-bold text-slate-900">
          {formatPrice(property.priceCents, {
            currency: property.currency,
            listingType: property.listingType,
          })}
        </p>
        <h3 className="truncate font-medium text-slate-800 group-hover:text-emerald-700">
          {property.title}
        </h3>
        <p className="truncate text-sm text-slate-500">
          {cardLocation(property)}
        </p>
        {features.length > 0 && (
          <p className="text-sm text-slate-600">{features.join(" · ")}</p>
        )}
      </div>
    </Link>
  );
}
