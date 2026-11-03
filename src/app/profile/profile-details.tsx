"use client";

import { useState } from "react";

import { ProfileEditForm } from "~/app/profile/profile-edit-form";
import { api } from "~/trpc/react";

/** Shown for optional fields the user hasn't filled in. */
export const NOT_PROVIDED = "Not provided";

/**
 * Name, email and phone of the signed-in user, read from the `user.me` cache, with an edit mode
 * (US-05). After saving, the cache already holds the new profile, so this view shows it at once
 * together with a confirmation.
 */
export function ProfileDetails() {
  const { data: user, isPending, isError } = api.user.me.useQuery();
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);

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

  if (isEditing) {
    return (
      <ProfileEditForm
        user={user}
        onCancel={() => setIsEditing(false)}
        onSaved={() => {
          setIsEditing(false);
          setSaved(true);
        }}
      />
    );
  }

  const rows = [
    { label: "Name", value: user.name },
    { label: "Email", value: user.email },
    { label: "Phone", value: user.phone },
  ];

  return (
    <>
      {saved && (
        <p
          role="status"
          className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Changes saved.
        </p>
      )}
      <dl className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4"
          >
            <dt className="text-sm font-medium text-slate-600">{label}</dt>
            {/* min-w-0 lets the grid cell shrink, so a long email wraps instead of overflowing. */}
            <dd
              className={`min-w-0 text-sm break-words sm:col-span-2 ${value ? "text-slate-900" : "text-slate-400 italic"}`}
            >
              {value ?? NOT_PROVIDED}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => {
          setSaved(false);
          setIsEditing(true);
        }}
        className="mt-6 rounded-full border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
      >
        Edit profile
      </button>
    </>
  );
}
