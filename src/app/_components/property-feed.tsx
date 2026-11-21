"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PropertyGrid } from "~/app/_components/property-grid";
import { emptyListingsMessage } from "~/app/_lib/listing-text";
import {
  hasSearchFilters,
  NO_SEARCH_RESULTS_MESSAGE,
  resultsCountLabel,
} from "~/app/_lib/search-filters";
import { type PropertyFilters } from "~/lib/validators/property";
import { api } from "~/trpc/react";

export type PropertyFeedFilters = Omit<Partial<PropertyFilters>, "cursor">;

/**
 * The listing grid with "Load more" (US-09). The first page is prefetched on the server
 * (`PropertyList`), so it is in the HTML; the next pages ask `property.list` again with the
 * previous page's `nextCursor`. With search filters (US-10) it shows the number of results and,
 * if there are none, suggests relaxing the filters.
 */
export function PropertyFeed({ filters }: { filters: PropertyFeedFilters }) {
  const pathname = usePathname();
  const [data, query] = api.property.list.useSuspenseInfiniteQuery(filters, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const properties = data.pages.flatMap((page) => page.items);
  // `total` only comes with the first page (see docs/api.md).
  const total = data.pages[0]?.total;
  const isSearch = hasSearchFilters(filters);

  if (properties.length === 0) {
    return (
      <div
        role="status"
        className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500"
      >
        <p>
          {isSearch
            ? NO_SEARCH_RESULTS_MESSAGE
            : emptyListingsMessage(filters.listingType)}
        </p>
        {isSearch && (
          <Link
            href={pathname}
            scroll={false}
            className="mt-4 inline-block font-medium text-emerald-700 hover:underline"
          >
            Clear filters
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {total !== undefined && (
        <p aria-live="polite" className="text-sm font-medium text-slate-600">
          {resultsCountLabel(total)}
        </p>
      )}
      <PropertyGrid properties={properties} />

      {query.isFetchNextPageError && (
        <p role="alert" className="text-center text-sm text-red-700">
          We couldn&apos;t load more listings. Please try again.
        </p>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="rounded-full border border-slate-300 bg-white px-6 py-2 font-medium text-slate-700 hover:border-emerald-700 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
