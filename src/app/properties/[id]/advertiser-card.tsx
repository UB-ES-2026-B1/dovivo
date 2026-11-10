import Link from "next/link";

import { loginToContactHref } from "~/app/_lib/listing-text";
import { type RouterOutputs } from "~/trpc/react";

type Owner = RouterOutputs["property"]["byId"]["owner"];

/**
 * Who publishes the listing and the Contact button (US-12.F2). Only the name and avatar are
 * public; the contact details stay private. Without a session, Contact goes to the login and
 * back here. The message form itself is US-21.
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
          <>
            {/* TODO(US-21): open the message form instead of a disabled button. */}
            <button
              type="button"
              disabled
              aria-describedby="contact-soon"
              className="w-full rounded-full bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              Contact advertiser
            </button>
            <p id="contact-soon" className="mt-2 text-xs text-slate-500">
              Messaging is coming soon.
            </p>
          </>
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
