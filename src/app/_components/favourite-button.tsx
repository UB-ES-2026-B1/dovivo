"use client";

import { TRPCClientError } from "@trpc/client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  favouriteButtonLabel,
  loginToFavouriteHref,
  toggleFavouriteIds,
} from "~/app/_lib/favourite-text";
import { toggleFavouriteAction } from "~/app/favourites/actions";
import { type AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";

type Variant = "overlay" | "inline";

const variantClass: Record<Variant, string> = {
  // Round white button on top of the card's photo.
  overlay:
    "flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white",
  // Pill with text, next to the title of the detail page.
  inline:
    "flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-rose-600 hover:text-rose-700",
};

const focusClass =
  "focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-5 w-5 ${filled ? "fill-rose-600 stroke-rose-600" : "fill-none stroke-slate-700"}`}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.9 4.5 6.8 4.5c2.1 0 3.6 1.1 4.4 2.5h1.6c.8-1.4 2.3-2.5 4.4-2.5 3.9 0 5.9 4.1 4.4 7.4C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function isTrpcCode(error: unknown, code: string): boolean {
  return (
    error instanceof TRPCClientError &&
    (error as TRPCClientError<AppRouter>).data?.code === code
  );
}

/**
 * Heart that saves or removes a listing from the favourites (US-14.F1), on the cards and on the
 * detail page.
 * - Visitor: a link to the login that comes back to this page ("és convidat a iniciar sessió").
 * - Signed in: a form. With JavaScript it calls `favourite.add` / `favourite.remove` and paints
 *   the heart at once (optimistic, undone if the call fails). Without JavaScript the form posts
 *   to `toggleFavouriteAction`, which saves it and reloads the page.
 * Whether it is saved comes from `favourite.ids`, prefetched on the server for signed-in users,
 * so the hearts are right in the first HTML too.
 */
export function FavouriteButton({
  propertyId,
  title,
  signedIn,
  variant = "overlay",
}: {
  propertyId: string;
  title: string;
  signedIn: boolean;
  variant?: Variant;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The page with its search (US-10 filters), so the login or the no-JS reload comes back to the
  // same results.
  const query = searchParams.toString();
  const here = query ? `${pathname}?${query}` : pathname;
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);

  const { data: isFavourite = false } = api.favourite.ids.useQuery(undefined, {
    enabled: signedIn,
    select: (ids) => ids.includes(propertyId),
  });

  const callbacks = (save: boolean) => ({
    onMutate: async () => {
      setError(null);
      // So an older `ids` response can't overwrite the optimistic heart.
      await utils.favourite.ids.cancel();
      const previous = utils.favourite.ids.getData();
      utils.favourite.ids.setData(undefined, (ids) =>
        toggleFavouriteIds(ids ?? [], propertyId, save),
      );
      return { previous };
    },
    onError: (
      mutationError: unknown,
      _input: unknown,
      context: { previous: string[] | undefined } | undefined,
    ) => {
      utils.favourite.ids.setData(undefined, context?.previous);
      if (isTrpcCode(mutationError, "UNAUTHORIZED")) {
        // The session expired: sign in again and come back here.
        window.location.assign(loginToFavouriteHref(here));
        return;
      }
      setError(
        isTrpcCode(mutationError, "NOT_FOUND")
          ? "This listing is no longer available."
          : "Couldn't update your favourites. Please try again.",
      );
    },
    onSettled: () =>
      Promise.all([
        utils.favourite.ids.invalidate(),
        utils.favourite.list.invalidate(),
      ]),
  });

  const add = api.favourite.add.useMutation(callbacks(true));
  const remove = api.favourite.remove.useMutation(callbacks(false));
  const pending = add.isPending || remove.isPending;

  const label = favouriteButtonLabel(isFavourite, title);
  const text = isFavourite ? "Saved" : "Save";

  if (!signedIn) {
    return (
      <Link
        href={loginToFavouriteHref(here)}
        aria-label={`Sign in to save "${title}" to favourites`}
        className={`${variantClass[variant]} ${focusClass}`}
      >
        <HeartIcon filled={false} />
        {variant === "inline" && <span aria-hidden="true">Save</span>}
      </Link>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // With JavaScript: skip the page reload and call the API from here.
    event.preventDefault();
    // A second click while the first is on its way would race it; ignore it.
    if (pending) return;
    if (isFavourite) {
      remove.mutate({ propertyId });
    } else {
      add.mutate({ propertyId });
    }
  }

  return (
    <form
      action={toggleFavouriteAction}
      onSubmit={handleSubmit}
      className="relative"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input
        type="hidden"
        name="intent"
        value={isFavourite ? "remove" : "save"}
      />
      <input type="hidden" name="returnTo" value={here} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        aria-busy={pending}
        className={`${variantClass[variant]} ${focusClass}`}
      >
        <HeartIcon filled={isFavourite} />
        {variant === "inline" && <span aria-hidden="true">{text}</span>}
      </button>
      {error && (
        <p
          role="alert"
          className={`absolute top-full right-0 z-10 mt-2 w-56 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow`}
        >
          {error}
        </p>
      )}
    </form>
  );
}
