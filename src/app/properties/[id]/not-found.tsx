import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Listing not found" };

/**
 * Friendly 404 for a listing that doesn't exist, was deleted or is someone else's draft
 * (US-12.F2). Offers a way back to the listings instead of a dead end.
 */
export default function PropertyNotFound() {
  return (
    <main className="container mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-5xl" aria-hidden="true">
        🏚️
      </p>
      <h1 className="mt-4 text-2xl font-bold sm:text-3xl">
        We couldn&apos;t find this home
      </h1>
      <p className="mt-3 text-slate-600">
        It may have been removed by the advertiser, or the link may be wrong.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/buy"
          className="rounded-full bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
        >
          Homes for sale
        </Link>
        <Link
          href="/rent"
          className="rounded-full border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
        >
          Homes for rent
        </Link>
      </div>
    </main>
  );
}
