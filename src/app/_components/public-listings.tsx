import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ListingTypeTabs } from "~/app/_components/listing-type-tabs";
import { type PropertyFeedFilters } from "~/app/_components/property-feed";
import { PropertyGridSkeleton } from "~/app/_components/property-grid";
import { PropertyList } from "~/app/_components/property-list";
import { SearchFiltersForm } from "~/app/_components/search-filters-form";
import {
  parseSearchParams,
  receivedQuery,
  RESULTS_HEADING_ID,
  searchQuery,
  type RawSearchParams,
} from "~/app/_lib/search-filters";

/**
 * Operation selector, search filters and grid, shared by the home page, /buy and /rent
 * (US-09, US-10). The filters come from the URL, so a search can be shared.
 */
export function PublicListings({
  listingType,
  path,
  searchParams,
}: {
  listingType: PropertyFeedFilters["listingType"];
  /** The page's own path, for the redirect to the clean URL. */
  path: "/" | "/buy" | "/rent";
  searchParams: RawSearchParams;
}) {
  const { values, filters } = parseSearchParams(searchParams);
  const query = searchQuery(values);

  // Without JavaScript the form sends every field, also the empty ones (`?city=x&minPrice=&…`),
  // and a link can carry invalid values. Send those to the clean URL, the one that gets shared.
  if (receivedQuery(searchParams) !== query) {
    redirect(query ? `${path}?${query}` : path);
  }

  return (
    <section aria-label="Listings">
      <ListingTypeTabs active={listingType} query={query} />
      <SearchFiltersForm values={values} />
      {/* Focused after a search, so keyboard and screen reader users land on the results. */}
      <h2 id={RESULTS_HEADING_ID} tabIndex={-1} className="sr-only">
        Search results
      </h2>
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
