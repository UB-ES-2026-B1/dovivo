import Link from "next/link";

import { loginToContactHref } from "~/app/_lib/listing-text";
import { ContactForm } from "~/app/properties/[id]/contact-form";
import { type RouterOutputs } from "~/trpc/react";

type Owner = RouterOutputs["property"]["byId"]["owner"];

/**
 * Who publishes the listing and how to contact them (US-12.F2, US-21.F1). Only the name and
 * avatar are public; the contact details stay private. A signed-in visitor gets the message form;
 * without a session, Contact goes to the login and back here. The owner sees no form, as the API
 * refuses messages about your own listing.
 */
export function AdvertiserCard({
  owner,
  propertyId,
  viewerId,
}: {
  owner: Owner;
  propertyId: string;
  viewerId: string | undefined;
}) {
  const name = owner.name?.trim() ?? "";
  const displayName = name || "Private advertiser";
  const isOwner = viewerId === owner.id;

  return (
    <section
      aria-labelledby="advertiser-heading"
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2
        id="advertiser-heading"
        className="text-sm font-medium text-slate-500"
      >
        Advertiser
      </h2>
      <div className="mt-3 flex items-center gap-3">
        {owner.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={owner.image}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-800"
          >
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <p className="min-w-0 font-medium break-words text-slate-900">
          {displayName}
        </p>
      </div>

      <div className="mt-4">
        {isOwner ? (
          <p className="text-sm text-slate-600">This is your listing.</p>
        ) : viewerId ? (
          <ContactForm propertyId={propertyId} advertiserName={displayName} />
        ) : (
          <Link
            href={loginToContactHref(propertyId)}
            className="block w-full rounded-full bg-emerald-700 px-4 py-2 text-center font-medium text-white hover:bg-emerald-800"
          >
            Contact advertiser
          </Link>
        )}
      </div>
    </section>
  );
}
