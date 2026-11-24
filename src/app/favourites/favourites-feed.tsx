"use client";

import Link from "next/link";

import { PropertyGrid } from "~/app/_components/property-grid";
import { api } from "~/trpc/react";

/**
 * The favourites grid with "Load more" (US-14.F2). The first page comes prefetched from the
 * server. Removing a heart invalidates `favourite.list`, so the card leaves the grid.
 * Unavailable listings stay, marked, so the user knows what happened and can remove them.
 */
export function FavouritesFeed() {
  const [data, query] = api.favourite.list.useSuspenseInfiniteQuery(
    {},
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const favourites = data.pages.flatMap((page) => page.items);

  if (favourites.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
        <p>You haven&apos;t saved any homes yet.</p>
        <p className="mt-2">
          Tap the heart on a listing to keep it here.{" "}
          <Link
            href="/"
            className="font-medium text-emerald-700 underline-offset-4 hover:underline"
          >
            Browse homes
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PropertyGrid properties={favourites} signedIn />

      {query.isFetchNextPageError && (
        <p role="alert" className="text-center text-sm text-red-700">
          We couldn&apos;t load more favourites. Please try again.
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
