import {
  PropertyFeed,
  type PropertyFeedFilters,
} from "~/app/_components/property-feed";
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
  // Awaited, not `void`: the first page must be in the cache before the feed renders, so the
  // cards are in the server HTML (and visible without JavaScript).
  await api.property.list.prefetchInfinite(filters);

  return (
    <HydrateClient>
      <PropertyFeed filters={filters} />
    </HydrateClient>
  );
}
