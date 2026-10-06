import Link from "next/link";

import { auth } from "~/server/auth";

const NAV = [
  { href: "/buy", label: "Buy" },
  { href: "/rent", label: "Rent" },
  { href: "/publish", label: "Publish" },
];

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
          <Link
            href={session ? "/api/auth/signout" : "/api/auth/signin"}
            className="rounded-full bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800"
          >
            {session ? "Sign out" : "Sign in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
