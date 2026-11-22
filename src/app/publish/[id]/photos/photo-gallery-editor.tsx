"use client";

import { useState } from "react";

import { movedOrder, photoErrorMessage } from "~/app/_lib/photo-upload";
import { api, type RouterOutputs } from "~/trpc/react";

export type GalleryPhoto = RouterOutputs["property"]["byId"]["images"][number];

const smallButton =
  "rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The listing's photos while publishing (US-18.F2): the cover first-class, buttons to make a
 * photo the cover, move it earlier or later, and delete it (asks once before deleting). Each
 * change is saved at once and the server answers with the whole gallery, which replaces ours.
 * Buttons instead of drag and drop: they work with the keyboard, a screen reader and on phones.
 */
export function PhotoGalleryEditor({
  propertyId,
  photos,
  onPhotosChange,
  locked,
  onBusyChange,
}: {
  propertyId: string;
  photos: GalleryPhoto[];
  onPhotosChange: (photos: GalleryPhoto[]) => void;
  /** True while uploads are running: changes wait until they finish. */
  locked: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const update = api.property.photos.update.useMutation();
  const remove = api.property.photos.delete.useMutation();
  const saving = update.isPending || remove.isPending;
  const disabled = locked || saving;

  async function save(change: () => Promise<GalleryPhoto[]>, done: string) {
    setError(null);
    setStatus("");
    onBusyChange(true);
    try {
      onPhotosChange(await change());
      setStatus(done);
    } catch (e) {
      setError(photoErrorMessage(e));
    } finally {
      onBusyChange(false);
    }
  }

  if (photos.length === 0) return null;

  const ids = photos.map((photo) => photo.id);
  const count = photos.length;

  return (
    <section aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="text-xl font-semibold">
        Your gallery
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        This is the order buyers will see.
        {locked && " You can rearrange it when the uploads finish."}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => {
          const n = index + 1;
          const label = `Photo ${n}`;
          const earlier = movedOrder(ids, index, -1);
          const later = movedOrder(ids, index, 1);

          return (
            <li
              key={photo.id}
              className={`min-w-0 overflow-hidden rounded-lg border bg-white ${photo.isCover ? "border-emerald-700 ring-1 ring-emerald-700" : "border-slate-200"}`}
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnailUrl ?? photo.url}
                  alt={photo.alt?.trim() ? photo.alt : `${label} of ${count}`}
                  className="h-full w-full object-cover"
                />
                {photo.isCover && (
                  <span className="absolute top-2 left-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-medium text-white">
                    Cover
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 p-2">
                {!photo.isCover && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      void save(
                        () =>
                          update.mutateAsync({
                            propertyId,
                            coverImageId: photo.id,
                          }),
                        `${label} is now the cover.`,
                      )
                    }
                    aria-label={`Make photo ${n} the cover`}
                    className={smallButton}
                  >
                    Make cover
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled || !earlier}
                  onClick={() =>
                    earlier &&
                    void save(
                      () => update.mutateAsync({ propertyId, order: earlier }),
                      `${label} moved to position ${n - 1}.`,
                    )
                  }
                  aria-label={`Move photo ${n} earlier`}
                  className={smallButton}
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={disabled || !later}
                  onClick={() =>
                    later &&
                    void save(
                      () => update.mutateAsync({ propertyId, order: later }),
                      `${label} moved to position ${n + 1}.`,
                    )
                  }
                  aria-label={`Move photo ${n} later`}
                  className={smallButton}
                >
                  →
                </button>

                {confirmingDelete === photo.id ? (
                  <span className="flex w-full flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-700">Delete?</span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setConfirmingDelete(null);
                        void save(
                          () => remove.mutateAsync({ imageId: photo.id }),
                          `${label} deleted.`,
                        );
                      }}
                      className="rounded-full bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(null)}
                      className={smallButton}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setConfirmingDelete(photo.id)}
                    aria-label={`Delete photo ${n}`}
                    className={`${smallButton} text-red-700`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
