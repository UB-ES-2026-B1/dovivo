"use server";

import { TRPCError } from "@trpc/server";
import { redirect } from "next/navigation";

import {
  favouriteFormReturnTo,
  loginToFavouriteHref,
  parseFavouriteForm,
} from "~/app/_lib/favourite-text";
import { api } from "~/trpc/server";

/**
 * The heart's form action (US-14.F1) when JavaScript is off or hasn't loaded yet: saves or
 * removes the listing and reloads the page the user was on, so the heart shows the new state.
 * With JavaScript the button calls `favourite.add` / `favourite.remove` directly instead.
 */
export async function toggleFavouriteAction(form: FormData): Promise<void> {
  const input = parseFavouriteForm(form);
  // A broken form (no id, unknown intent): change nothing and go back.
  if (!input) redirect(favouriteFormReturnTo(form));

  const { propertyId, save, returnTo } = input;
  try {
    if (save) {
      await api.favourite.add({ propertyId });
    } else {
      await api.favourite.remove({ propertyId });
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      // No session (a visitor, or it expired): sign in and come back here.
      if (error.code === "UNAUTHORIZED")
        redirect(loginToFavouriteHref(returnTo));
      // The listing was deleted in the meantime (or a forged id): nothing to save. The reloaded
      // page no longer shows it, or shows its heart empty.
      if (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST") {
        redirect(returnTo);
      }
    }
    throw error;
  }

  // Outside the try/catch: `redirect` works by throwing.
  redirect(returnTo);
}
