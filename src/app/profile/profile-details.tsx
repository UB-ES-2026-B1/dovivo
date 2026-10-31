"use client";

import { api } from "~/trpc/react";

/** Shown for optional fields the user hasn't filled in. */
export const NOT_PROVIDED = "Not provided";

/** Name, email and phone of the signed-in user, read from the `user.me` cache. */
export function ProfileDetails() {
  const { data: user, isPending, isError } = api.user.me.useQuery();

  if (isPending) {
    return <p className="mt-6 text-slate-600">Loading your profile…</p>;
  }
  if (isError) {
    return (
      <p role="alert" className="mt-6 text-red-700">
        We couldn&apos;t load your profile. Please try again.
      </p>
    );
  }

  const rows = [
    { label: "Name", value: user.name },
    { label: "Email", value: user.email },
    { label: "Phone", value: user.phone },
  ];

  return (
    <dl className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {rows.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-3 gap-4 px-4 py-3">
          <dt className="text-sm font-medium text-slate-600">{label}</dt>
          <dd
            className={`col-span-2 text-sm ${value ? "text-slate-900" : "text-slate-400 italic"}`}
          >
            {value ?? NOT_PROVIDED}
          </dd>
        </div>
      ))}
    </dl>
  );
}
