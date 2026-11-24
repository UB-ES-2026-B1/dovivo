import {
  PropertyFeed,
  type PropertyFeedFilters,
} from "~/app/_components/property-feed";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

/**
 * Public listing (US-09). Loads the first page on the server and hands it to the client feed,
 * which adds "Load more". Wrap it in <Suspense> to show a skeleton while it loads.
 */
export async function PropertyList({
  filters,
}: {
  filters: PropertyFeedFilters;
}) {
  const session = await auth();
  // Awaited, not `void`: the first page must be in the cache before the feed renders, so the
  // cards are in the server HTML (and visible without JavaScript). For a signed-in user the
  // saved ids come along, so the hearts are painted right from the start (US-14.F2).
  await Promise.all([
    api.property.list.prefetchInfinite(filters),
    session ? api.favourite.ids.prefetch() : undefined,
  ]);

  return (
    <HydrateClient>
      <PropertyFeed filters={filters} signedIn={!!session} />
    </HydrateClient>
  );
}
