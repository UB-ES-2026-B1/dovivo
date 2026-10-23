"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

/** "Sign out" button in the site header (US-03). Only rendered while signed in. */
export function SignOutButton() {
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);

  // The Back button can restore a page from the browser's back/forward cache without asking the
  // server, so a private page could show up again after signing out. When a page is restored that
  // way, reload it: the server no longer sees a session and private pages redirect to /login.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  async function handleSignOut() {
    setHasError(false);
    setIsPending(true);
    try {
      // Auth.js clears the session cookie, then the browser does a full page load of "/", so the
      // header and every page render again as a visitor (nothing of the session stays in memory).
      await signOut({ redirectTo: "/" });
    } catch {
      // Network error or Auth.js unreachable: the session is still there, let the user retry.
      setHasError(true);
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {hasError && (
        <span role="alert" className="text-xs text-red-600">
          Could not sign out, try again
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        className="rounded-full bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
