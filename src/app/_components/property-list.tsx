import { PropertyCard } from "~/app/_components/property-card";
import { type PropertyFilters } from "~/lib/validators/property";
import { api } from "~/trpc/server";

export async function PropertyList({
  filters,
}: {
  filters: Partial<PropertyFilters>;
}) {
  const { items } = await api.property.list(filters);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
        No properties found yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
