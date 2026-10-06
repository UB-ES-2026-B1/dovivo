import Link from "next/link";

const SECTIONS = [
  {
    href: "/buy",
    title: "Buy",
    text: "Browse homes for sale and find your next place.",
  },
  {
    href: "/rent",
    title: "Rent",
    text: "Flats, houses and rooms available to rent.",
  },
  {
    href: "/publish",
    title: "Publish",
    text: "List your property for sale or rent in minutes.",
  },
];

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-16">
      <section className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">
          Find where you <span className="text-emerald-700">live</span>.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Buy, rent or publish homes with dovivo.
        </p>
      </section>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-2xl font-bold">{section.title} →</h2>
            <p className="mt-2 text-slate-600">{section.text}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
