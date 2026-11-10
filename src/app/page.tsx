import Link from "next/link";

import { PublicListings } from "~/app/_components/public-listings";

export const dynamic = "force-dynamic";

/** Home page: short intro and the public listing of homes for sale and rent (US-09). */
export default function Home() {
  return (
    <main className="container mx-auto px-4 py-10">
      <section className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Find where you <span className="text-emerald-700">live</span>.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Buy, rent or{" "}
          <Link
            href="/publish"
            className="font-medium text-emerald-700 underline-offset-4 hover:underline"
          >
            publish
          </Link>{" "}
          homes with dovivo.
        </p>
      </section>
      <h2 className="mb-4 text-2xl font-bold">Latest homes</h2>
      <PublicListings listingType={undefined} />
    </main>
  );
}
