import Link from "next/link";

import { type PropertyFeedFilters } from "~/app/_components/property-feed";

type ListingType = PropertyFeedFilters["listingType"];

const TABS: { href: string; label: string; listingType: ListingType }[] = [
  { href: "/", label: "All", listingType: undefined },
  { href: "/buy", label: "For sale", listingType: "SALE" },
  { href: "/rent", label: "For rent", listingType: "RENT" },
];

/**
 * Sale/rent selector (US-09). Plain links, so it works without JavaScript and every option has
 * its own shareable URL.
 */
export function ListingTypeTabs({ active }: { active: ListingType }) {
  return (
    <nav aria-label="Operation" className="mb-8">
      <ul className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm font-medium">
        {TABS.map((tab) => {
          const isActive = tab.listingType === active;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "block rounded-full bg-emerald-700 px-4 py-2 text-white"
                    : "block rounded-full px-4 py-2 text-slate-700 hover:text-emerald-700"
                }
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
