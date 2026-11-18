import { Suspense } from "react";

import { ListingTypeTabs } from "~/app/_components/listing-type-tabs";
import { type PropertyFeedFilters } from "~/app/_components/property-feed";
import { PropertyGridSkeleton } from "~/app/_components/property-grid";
import { PropertyList } from "~/app/_components/property-list";
import { SearchFiltersForm } from "~/app/_components/search-filters-form";
import {
  parseSearchParams,
  searchQuery,
  type RawSearchParams,
} from "~/app/_lib/search-filters";

/**
 * Operation selector, search filters and grid, shared by the home page, /buy and /rent
 * (US-09, US-10). The filters come from the URL, so a search can be shared.
 */
export function PublicListings({
  listingType,
  searchParams,
}: {
  listingType: PropertyFeedFilters["listingType"];
  searchParams: RawSearchParams;
}) {
  const { values, filters } = parseSearchParams(searchParams);
  const query = searchQuery(values);

  return (
    <section aria-label="Listings">
      <ListingTypeTabs active={listingType} query={query} />
      {/* Remounted when the URL changes, so the fields show the current search. */}
      <SearchFiltersForm key={query} values={values} />
      {/* A new key per search shows the skeleton while the new results load. */}
      <Suspense
        key={`${listingType ?? "ALL"}?${query}`}
        fallback={<PropertyGridSkeleton />}
      >
        <PropertyList filters={{ listingType, ...filters }} />
      </Suspense>
    </section>
  );
}
