"use client";

import { useEffect } from "react";

import { hasLostSession } from "~/app/_lib/session-lost";

/**
 * Reloads a page rendered for a signed-in user once its session is gone, so private content does
 * not stay on screen after signing out (US-03). It checks when:
 * - Back/Forward restores the page from the browser's back/forward cache without asking the server;
 * - the tab becomes visible again, e.g. after signing out in another tab.
 * The reload asks the server again: private pages redirect to /login and the header shows a
 * visitor. Pages whose session is still valid are left alone, so a half-filled form is kept.
 */
export function SessionGuard({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (!signedIn) return;

    async function reloadIfSignedOut() {
      if (await hasLostSession()) window.location.reload();
    }
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) void reloadIfSignedOut();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void reloadIfSignedOut();
    }

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [signedIn]);

  return null;
}
