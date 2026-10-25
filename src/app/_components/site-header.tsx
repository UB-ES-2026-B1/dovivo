import Link from "next/link";

import { primaryButtonClass } from "~/app/_components/button-styles";
import { SignOutSubmit } from "~/app/_components/sign-out-submit";
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
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-2xl font-extrabold text-emerald-700">
          dovivo
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-slate-700 hover:text-emerald-700"
            >
              {item.label}
            </Link>
          ))}
          {session ? (
            <form action={signOutAction}>
              <SignOutSubmit />
            </form>
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
        </nav>
      </div>
    </header>
  );
}
