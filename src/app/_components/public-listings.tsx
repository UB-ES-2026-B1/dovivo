import { Suspense } from "react";

import { ListingTypeTabs } from "~/app/_components/listing-type-tabs";
import { type PropertyFeedFilters } from "~/app/_components/property-feed";
import { PropertyGridSkeleton } from "~/app/_components/property-grid";
import { PropertyList } from "~/app/_components/property-list";

/** Selector + grid shared by the home page, /buy and /rent (US-09). */
export function PublicListings({
  listingType,
}: {
  listingType: PropertyFeedFilters["listingType"];
}) {
  return (
    <section aria-label="Listings">
      <ListingTypeTabs active={listingType} />
      <Suspense fallback={<PropertyGridSkeleton />}>
        <PropertyList filters={{ listingType }} />
      </Suspense>
    </section>
  );
}
