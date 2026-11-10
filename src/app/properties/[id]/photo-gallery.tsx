"use client";

import { useState } from "react";

import { type RouterOutputs } from "~/trpc/react";

type GalleryImage = RouterOutputs["property"]["byId"]["images"][number];

/**
 * Photo gallery of the detail page (US-12.F1): the selected photo large, previous/next buttons,
 * the left and right arrow keys, and a row of thumbnails. Photos arrive ordered by `position`.
 */
export function PhotoGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [selectedIndex, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/2] items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        No photos yet
      </div>
    );
  }

  const count = images.length;
  // Out of range only if the list shrinks: fall back to the first photo, and use the same index
  // for the photo, the counter and the selected thumbnail so they always agree.
  const index = selectedIndex < count ? selectedIndex : 0;
  const current = images[index]!;
  const show = (next: number) => setIndex((next + count) % count);
  const altFor = (image: GalleryImage, n: number) =>
    image.alt?.trim() ? image.alt : `${title}, photo ${n} of ${count}`;

  return (
    <section
      aria-label="Photos"
      aria-roledescription="carousel"
      // Focusable when there is more than one photo, so the arrow keys work after tabbing to the
      // gallery itself, not only from its buttons.
      tabIndex={count > 1 ? 0 : undefined}
      className="rounded-xl focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:outline-none"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") show(index - 1);
        if (event.key === "ArrowRight") show(index + 1);
      }}
    >
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-slate-100">
        {/* TODO(frontend): switch to next/image once an image host is configured */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={current.url}
          alt={altFor(current, index + 1)}
          width={current.width ?? undefined}
          height={current.height ?? undefined}
          className="h-full w-full object-cover"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => show(index - 1)}
              aria-label="Previous photo"
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1 text-xl text-slate-800 shadow hover:bg-white focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => show(index + 1)}
              aria-label="Next photo"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1 text-xl text-slate-800 shadow hover:bg-white focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none"
            >
              ›
            </button>
            <p
              aria-live="polite"
              className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
            >
              {index + 1} / {count}
            </p>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, n) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(n)}
                aria-label={`Show photo ${n + 1} of ${count}`}
                aria-current={n === index}
                className="block h-16 w-24 overflow-hidden rounded-lg border-2 border-transparent opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none aria-[current=true]:border-emerald-700 aria-[current=true]:opacity-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.thumbnailUrl ?? image.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
