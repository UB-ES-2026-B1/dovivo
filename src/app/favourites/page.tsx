import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { FavouritesFeed } from "~/app/favourites/favourites-feed";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export const metadata: Metadata = { title: "My favourites" };

/**
 * The signed-in user's favourites (US-14.F2): the US-09 cards, newest saved first, with the
 * listings that are no longer available marked. Private: without a session it goes to the login
 * and comes back here afterwards.
 *
 * No <Suspense> around the list on purpose: a streamed Suspense boundary needs JavaScript to
 * replace its fallback, so without JS the page would stay on the skeleton. Awaiting the first
 * page here puts the cards (and their heart forms) straight into the HTML.
 */
export default async function FavouritesPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/favourites");

  await Promise.all([
    api.favourite.list.prefetchInfinite({}),
    api.favourite.ids.prefetch(),
  ]);

  return (
    <HydrateClient>
      <main className="container mx-auto px-4 py-10">
        <h1 className="mb-6 text-3xl font-bold">My favourites</h1>
        <FavouritesFeed />
      </main>
    </HydrateClient>
  );
}
