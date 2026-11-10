/** Placeholder while the listing loads, with the same layout as the page. */
export default function PropertyLoading() {
  return (
    <main
      className="container mx-auto px-4 py-8"
      aria-busy="true"
      aria-label="Loading listing"
    >
      <div className="grid animate-pulse gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="aspect-[3/2] rounded-xl bg-slate-200" />
          <div className="mt-6 h-8 w-2/3 rounded bg-slate-200" />
          <div className="mt-3 h-4 w-1/2 rounded bg-slate-200" />
        </div>
        <div className="space-y-4">
          <div className="h-24 rounded-xl bg-slate-200" />
          <div className="h-40 rounded-xl bg-slate-200" />
        </div>
      </div>
    </main>
  );
}
