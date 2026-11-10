import Link from "next/link";

import { primaryButtonClass } from "~/app/_components/button-styles";
import { SignOutSubmit } from "~/app/_components/sign-out-submit";
import { accountLabel } from "~/app/_lib/account-label";
import { auth, signOut } from "~/server/auth";

const NAV = [
  { href: "/buy", label: "Buy" },
  { href: "/rent", label: "Rent" },
  { href: "/publish", label: "Publish" },
];

/**
 * Server action behind "Sign out" (US-03): Auth.js clears the session cookie and redirects home.
 * As a form action it works before hydration and without JavaScript, and Auth.js errors go through
 * Next's error handling instead of Auth.js's default error page.
 */
async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-slate-200 bg-white">
      {/*
        Phones: two rows, so nothing overflows at 320-375 px. The logo and the account actions go
        on the first row and the main links on the second (`order-last w-full`).
        From `sm` up: one row, as before (logo on the left, links and account on the right).
      */}
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0">
        <Link
          href="/"
          className="shrink-0 text-2xl font-extrabold text-emerald-700"
        >
          dovivo
        </Link>
        <nav
          aria-label="Main"
          className="order-last flex w-full items-center gap-6 text-sm font-medium sm:order-none sm:ml-auto sm:w-auto"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-slate-700 hover:text-emerald-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-sm font-medium whitespace-nowrap sm:gap-6">
          {session ? (
            <>
              {/*
                The user's name (US-05.F2): `session.user.name` is refreshed from the DB on every
                request, and the profile form calls `router.refresh()` after saving, so a new name
                shows up here at once. Long names are cut so the row never overflows on phones.
              */}
              <Link
                href="/profile"
                title={accountLabel(session.user.name)}
                className="max-w-40 truncate text-slate-700 hover:text-emerald-700"
              >
                <span className="sr-only">My profile: </span>
                {accountLabel(session.user.name)}
              </Link>
              <form action={signOutAction}>
                <SignOutSubmit />
              </form>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="text-slate-700 hover:text-emerald-700"
              >
                Create account
              </Link>
              <Link href="/login" className={primaryButtonClass}>
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
