import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";

import { formatPrice } from "~/lib/format";
import { api } from "~/trpc/server";

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const property = await api.property.byId({ id }).catch((err: unknown) => {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  });

  // TODO(frontend): image gallery, map, contact owner form, favourite button.
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold">{property.title}</h1>
      <p className="mt-2 text-2xl font-semibold text-emerald-700">
        {formatPrice(property.priceCents, {
          currency: property.currency,
          listingType: property.listingType,
        })}
      </p>
      <p className="mt-1 text-slate-500">
        {property.address}, {property.city}
      </p>
      <p className="mt-6 whitespace-pre-line text-slate-700">
        {property.description}
      </p>
    </main>
  );
}
