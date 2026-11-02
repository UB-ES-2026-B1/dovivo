"use client";

import { PropertyGrid } from "~/app/_components/property-grid";
import { emptyListingsMessage } from "~/app/_lib/listing-text";
import { type PropertyFilters } from "~/lib/validators/property";
import { api } from "~/trpc/react";

export type PropertyFeedFilters = Omit<Partial<PropertyFilters>, "cursor">;

/**
 * The listing grid with "Load more" (US-09). The first page is prefetched on the server
 * (`PropertyList`), so it is in the HTML; the next pages ask `property.list` again with the
 * previous page's `nextCursor`.
 */
export function PropertyFeed({ filters }: { filters: PropertyFeedFilters }) {
  const [data, query] = api.property.list.useSuspenseInfiniteQuery(filters, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const properties = data.pages.flatMap((page) => page.items);

  if (properties.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
        {emptyListingsMessage(filters.listingType)}
      </p>
    );
  }

  return (
    <div className="space-y-8">
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
