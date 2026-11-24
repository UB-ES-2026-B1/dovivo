import Link from "next/link";

import { FavouriteButton } from "~/app/_components/favourite-button";
import {
  availabilityLabel,
  canOpenFavourite,
  type FavouriteAvailability,
} from "~/app/_lib/favourite-text";
import { cardFeatures, cardLocation } from "~/app/_lib/listing-text";
import { formatPrice } from "~/lib/format";
import { type RouterOutputs } from "~/trpc/react";

export type PropertyCardData =
  RouterOutputs["property"]["list"]["items"][number] & {
    /** Only on the favourites page (US-14.F2): marks the listings that can't be visited as usual. */
    availability?: FavouriteAvailability;
  };

const cardClass =
  "group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";

/**
 * Listing card (US-09): cover photo, price, title, location, bedrooms and m², plus the favourite
 * heart (US-14.F1). Reusable in every list of cards (home, /buy, /rent, search, favourites).
 *
 * The heart is a sibling of the link, not inside it (a button inside a link is invalid HTML and
 * screen readers would read it as part of the link), and sits on top of the photo.
 */
export function PropertyCard({
  property,
  signedIn,
}: {
  property: PropertyCardData;
  signedIn: boolean;
}) {
  const { cover } = property;
  const features = cardFeatures(property);
  const availability = property.availability ?? "AVAILABLE";
  const badge = availabilityLabel(availability, property.listingType);
  const canOpen = canOpenFavourite(availability);

  const content = (
    <>
      <div className="relative aspect-[3/2] bg-slate-100">
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
            className={`h-full w-full object-cover ${canOpen ? "" : "opacity-50 grayscale"}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No photo yet
          </div>
        )}
        {badge && (
          <span
            className={`absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold ${canOpen ? "bg-amber-100 text-amber-900" : "bg-slate-800 text-white"}`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <p
          className={`text-lg font-bold ${canOpen ? "text-slate-900" : "text-slate-500"}`}
        >
          {formatPrice(property.priceCents, {
            currency: property.currency,
            listingType: property.listingType,
          })}
        </p>
        <h3
          className={`truncate font-medium ${canOpen ? "text-slate-800 group-hover:text-emerald-700" : "text-slate-500"}`}
        >
          {property.title}
        </h3>
        <p className="truncate text-sm text-slate-500">
          {cardLocation(property)}
        </p>
        {features.length > 0 && (
          <p className="text-sm text-slate-600">{features.join(" · ")}</p>
        )}
      </div>
    </>
  );

  return (
    <div className="relative h-full">
      {canOpen ? (
        <Link
          href={`/properties/${property.id}`}
          className={`${cardClass} transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none`}
        >
          {content}
        </Link>
      ) : (
        // Deleted or back to draft: its detail page is a 404, so no link (US-14.F2). The heart
        // stays, so the user can remove it from the list.
        <div className={`${cardClass} bg-slate-50`}>{content}</div>
      )}
      <div className="absolute top-3 right-3">
        <FavouriteButton
          propertyId={property.id}
          title={property.title}
          signedIn={signedIn}
        />
      </div>
    </div>
  );
}
