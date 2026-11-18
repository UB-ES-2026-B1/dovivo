"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { propertyTypeLabel } from "~/app/_lib/listing-text";
import {
  parseSearchParams,
  searchQuery,
  type SearchFormValues,
} from "~/app/_lib/search-filters";
import { propertyTypeSchema } from "~/lib/validators/property";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none";
const labelClass = "block text-sm font-medium text-slate-700";

function NumberField({
  label,
  name,
  defaultValue,
  placeholder = "Any",
}: {
  label: string;
  name: keyof SearchFormValues;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`filter-${name}`}
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </div>
  );
}

/**
 * Search filters panel (US-10.F1). The filters live in the URL (US-10.F2): submitting the form
 * (the Search button or Enter in any field) writes them to the query string and the listing
 * below reloads without reloading the page. It is also a plain GET form, so it works without
 * JavaScript. The parent remounts it with `key` when the URL changes, so the fields always
 * show the search on screen (also after Back or a shared link).
 */
export function SearchFiltersForm({ values }: { values: SearchFormValues }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const hasFilters = searchQuery(values) !== "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // Same cleaning as the page: invalid values (e.g. a negative price) are left out of the URL.
    const { values: next } = parseSearchParams(
      Object.fromEntries(
        [...form.entries()].map(([key, value]) => [
          key,
          typeof value === "string" ? value : "",
        ]),
      ),
    );
    const query = searchQuery(next);
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <form
      role="search"
      aria-label="Search filters"
      method="get"
      onSubmit={handleSubmit}
      className="mb-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="filter-city" className={labelClass}>
            City
          </label>
          <input
            id="filter-city"
            name="city"
            type="search"
            maxLength={100}
            placeholder="e.g. Barcelona"
            defaultValue={values.city}
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="filter-neighborhood" className={labelClass}>
            Neighbourhood
          </label>
          <input
            id="filter-neighborhood"
            name="neighborhood"
            type="search"
            maxLength={100}
            placeholder="e.g. Gràcia"
            defaultValue={values.neighborhood}
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="filter-type" className={labelClass}>
            Property type
          </label>
          <select
            id="filter-type"
            name="type"
            defaultValue={values.type}
            className={inputClass}
          >
            <option value="">Any type</option>
            {propertyTypeSchema.options.map((type) => (
              <option key={type} value={type}>
                {propertyTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <label className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700">
            <input
              name="parking"
              type="checkbox"
              value="1"
              defaultChecked={values.parking}
              className="h-4 w-4 accent-emerald-700"
            />
            With parking
          </label>
        </div>

        <NumberField
          label="Min price (€)"
          name="minPrice"
          defaultValue={values.minPrice}
        />
        <NumberField
          label="Max price (€)"
          name="maxPrice"
          defaultValue={values.maxPrice}
        />
        <NumberField
          label="Bedrooms (min)"
          name="bedrooms"
          defaultValue={values.bedrooms}
        />
        <NumberField
          label="Bathrooms (min)"
          name="bathrooms"
          defaultValue={values.bathrooms}
        />
        <NumberField
          label="Min area (m²)"
          name="minArea"
          defaultValue={values.minArea}
        />
        <NumberField
          label="Max area (m²)"
          name="maxArea"
          defaultValue={values.maxArea}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-emerald-700 px-5 py-2 font-medium text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? "Searching…" : "Search"}
        </button>
        {hasFilters && (
          <Link
            href={pathname}
            scroll={false}
            className="text-sm font-medium text-slate-600 hover:text-emerald-700"
          >
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}
