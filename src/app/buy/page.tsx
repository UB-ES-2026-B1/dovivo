import { type Metadata } from "next";

import { PropertyList } from "~/app/_components/property-list";

export const metadata: Metadata = { title: "Homes for sale" };
export const dynamic = "force-dynamic";

// TODO(frontend): read filters (city, price, bedrooms...) from searchParams.
export default function BuyPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold">Homes for sale</h1>
      <PropertyList filters={{ listingType: "SALE" }} />
    </main>
  );
}
