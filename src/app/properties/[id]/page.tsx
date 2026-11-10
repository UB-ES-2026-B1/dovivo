import { TRPCError } from "@trpc/server";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  cardLocation,
  detailAmenities,
  detailFacts,
  detailLocation,
  listingStatusNotice,
  listingTypeLabel,
  propertyTypeLabel,
} from "~/app/_lib/listing-text";
import { AdvertiserCard } from "~/app/properties/[id]/advertiser-card";
import { PhotoGallery } from "~/app/properties/[id]/photo-gallery";
import { formatPrice } from "~/lib/format";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

type Props = { params: Promise<{ id: string }> };

/**
 * Loads the listing once per request (used by the page and its metadata). A missing, deleted or
 * someone else's draft listing answers NOT_FOUND, and a malformed id BAD_REQUEST: both show the
 * friendly 404 (`not-found.tsx`).
 */
const getProperty = cache(async (id: string) => {
  try {
    return await api.property.byId({ id });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")
    ) {
      notFound();
    }
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const property = await getProperty(id);
  const cover =
    property.images.find((image) => image.isCover) ?? property.images[0];

  return {
    title: property.title,
    description: property.description.slice(0, 160),
    // So a shared link shows the title and the cover photo (US-12: each listing has its own URL).
    openGraph: {
      title: property.title,
      description: property.description.slice(0, 160),
      images: cover ? [cover.url] : undefined,
    },
  };
}

/** Public listing detail (US-12.F1 / F2): anyone can open it, also without a session. */
export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  const [property, session] = await Promise.all([getProperty(id), auth()]);

  const facts = detailFacts(property);
  const amenities = detailAmenities(property);
  const notice = listingStatusNotice(property.status, property.listingType);
  const price = formatPrice(property.priceCents, {
    currency: property.currency,
    listingType: property.listingType,
  });

  return (
    <main className="container mx-auto px-4 py-8">
      {notice && (
        <p
          role="status"
          className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {notice}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <PhotoGallery images={property.images} title={property.title} />

          <div className="mt-6">
            <p className="text-sm font-medium text-emerald-700">
              {listingTypeLabel(property.listingType)} ·{" "}
              {propertyTypeLabel(property.propertyType)}
            </p>
            <h1 className="mt-1 text-2xl font-bold break-words sm:text-3xl">
              {property.title}
            </h1>
            {/* Short location here; the full address is in the Location section below. */}
            <p className="mt-2 text-slate-600">{cardLocation(property)}</p>
            {/*
              On one column the aside (price card) ends up below the whole description, so the
              price is repeated here for phones and tablets. Only one of the two is ever displayed.
            */}
            <p className="mt-3 text-2xl font-bold text-slate-900 lg:hidden">
              {price}
            </p>
          </div>

          {facts.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
              {facts.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="text-lg font-semibold text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <section aria-labelledby="description-heading" className="mt-8">
            <h2 id="description-heading" className="text-xl font-semibold">
              Description
            </h2>
            <p className="mt-3 break-words whitespace-pre-line text-slate-700">
              {property.description}
            </p>
          </section>

          {amenities.length > 0 && (
            <section aria-labelledby="amenities-heading" className="mt-8">
              <h2 id="amenities-heading" className="text-xl font-semibold">
                Features
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {amenities.map((amenity) => (
                  <li
                    key={amenity}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                  >
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="location-heading" className="mt-8">
            <h2 id="location-heading" className="text-xl font-semibold">
              Location
            </h2>
            <p className="mt-3 text-slate-700">{detailLocation(property)}</p>
            {/* TODO(US-13): map with the listing's coordinates. */}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="hidden rounded-xl border border-slate-200 bg-white p-5 lg:block">
            <p className="text-sm text-slate-500">Price</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{price}</p>
          </div>
          <AdvertiserCard
            owner={property.owner}
            propertyId={property.id}
            viewerId={session?.user.id}
          />
        </aside>
      </div>
    </main>
  );
}
