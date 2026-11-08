import { type Metadata } from "next";

import { PublicListings } from "~/app/_components/public-listings";

export const metadata: Metadata = { title: "Homes for rent" };
export const dynamic = "force-dynamic";

// TODO(frontend): read filters (city, price, bedrooms...) from searchParams (US-10).
export default function RentPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Homes for rent</h1>
      <PublicListings listingType="RENT" />
    </main>
  );
}
