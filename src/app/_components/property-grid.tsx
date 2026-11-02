import {
  PropertyCard,
  type PropertyCardData,
} from "~/app/_components/property-card";

const gridClass = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3";

/** Responsive grid of listing cards. Reusable by any list (home, search, favourites). */
export function PropertyGrid({
  properties,
}: {
  properties: PropertyCardData[];
}) {
  return (
    <ul className={gridClass}>
      {properties.map((property) => (
        <li key={property.id} className="min-w-0">
          <PropertyCard property={property} />
        </li>
      ))}
    </ul>
  );
}

/** Grey placeholder cards shown while the first page loads. */
export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading listings">
      <ul className={gridClass} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="aspect-[3/2] animate-pulse bg-slate-200" />
            <div className="space-y-2 p-4">
              <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
