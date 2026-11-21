import { type Metadata } from "next";

import { PublicListings } from "~/app/_components/public-listings";
import { type RawSearchParams } from "~/app/_lib/search-filters";

export const metadata: Metadata = { title: "Homes for sale" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<RawSearchParams> };

/** Search filters (US-10) come from the URL, so a search can be shared. */
export default async function BuyPage({ searchParams }: Props) {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Homes for sale</h1>
      <PublicListings
        listingType="SALE"
        path="/buy"
        searchParams={await searchParams}
      />
    </main>
  );
}
