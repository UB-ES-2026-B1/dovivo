"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import {
  canRetryPhoto,
  checkPhotoFiles,
  createTurnQueue,
  photoErrorMessage,
  photoSlotsLeft,
  uploadPhoto,
} from "~/app/_lib/photo-upload";
import { publishDraft } from "~/app/publish/[id]/photos/actions";
import { initialPublishDraftState } from "~/app/publish/[id]/photos/form-state";
import {
  PhotoGalleryEditor,
  type GalleryPhoto,
} from "~/app/publish/[id]/photos/photo-gallery-editor";
import {
  MAX_PHOTOS_PER_PROPERTY,
  type PhotoMimeType,
} from "~/lib/validators/photo";
import { api } from "~/trpc/react";

/** A file being uploaded, or one that failed, shown with its local preview. */
type PendingUpload = {
  id: string;
  file: File;
  mimeType: PhotoMimeType;
  /** `URL.createObjectURL(file)`, revoked when the item goes away. */
  previewUrl: string;
  status: "uploading" | "failed";
  /** The browser couldn't show the file (e.g. it isn't really an image). */
  previewBroken?: boolean;
  error?: string;
  canRetry?: boolean;
};

/** Gallery order is `position`; uploads confirmed in parallel can answer in any order. */
function byPosition(a: GalleryPhoto, b: GalleryPhoto) {
  return a.position - b.position;
}

/**
 * Publish flow, step 2 (US-18.F1 / F2). Choose photos (JPG/PNG, 5 MB, 15 at most, checked before
 * uploading), see them while they upload, see the server's error next to each one that fails,
 * then arrange the gallery and publish. Uploads go straight to the storage (docs/api.md).
 *
 * Without JavaScript the photos can't be uploaded (the signed upload needs `fetch`), but the
 * publish button still works: it is a plain form posting to a server action.
 */
export function PhotosStep({
  propertyId,
  initialPhotos,
}: {
  propertyId: string;
  initialPhotos: GalleryPhoto[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [pickErrors, setPickErrors] = useState<string[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [publishState, publishAction, isPublishing] = useActionState(
    publishDraft,
    initialPublishDraftState,
  );
  const inputId = useId();
  // The picker needs JavaScript (the upload is a `fetch`), so it only appears once it runs.
  const [hasJs, setHasJs] = useState(false);
  useEffect(() => setHasJs(true), []);
  const nextUploadId = useRef(0);
  const takeTurn = useRef(createTurnQueue());

  const createUpload = api.property.photos.createUpload.useMutation();
  const confirm = api.property.photos.confirm.useMutation();

  // Free the previews still on screen when leaving the page.
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const uploading = uploads.filter((u) => u.status === "uploading").length;
  // Failed uploads keep their place until retried or removed, so a retry never exceeds 15.
  const slotsLeft = photoSlotsLeft(photos.length, uploads.length);
  const busy = uploading > 0 || galleryBusy;

  function removeUpload(id: string) {
    setUploads((current) => {
      const upload = current.find((u) => u.id === id);
      if (upload) {
        URL.revokeObjectURL(upload.previewUrl);
        previewUrls.current.delete(upload.previewUrl);
      }
      return current.filter((u) => u.id !== id);
    });
  }

  function markPreviewBroken(id: string) {
    setUploads((current) =>
      current.map((u) => (u.id === id ? { ...u, previewBroken: true } : u)),
    );
  }

  async function start(upload: PendingUpload) {
    const turn = takeTurn.current();
    try {
      const photo = await uploadPhoto(propertyId, upload, {
        createUpload: (input) => createUpload.mutateAsync(input),
        confirm: async (input) => {
          await turn.wait;
          return confirm.mutateAsync(input);
        },
      });
      setPhotos((current) =>
        // `confirm` is idempotent: a retried photo may already be in the gallery.
        [...current.filter((p) => p.id !== photo.id), photo].sort(byPosition),
      );
      removeUpload(upload.id);
    } catch (error) {
      setUploads((current) =>
        current.map((u) =>
          u.id === upload.id
            ? {
                ...u,
                status: "failed",
                error: photoErrorMessage(error),
                canRetry: canRetryPhoto(error),
              }
            : u,
        ),
      );
    } finally {
      turn.done();
    }
  }

  function onFilesChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Empty the input so choosing the same file again (e.g. after removing it) fires `change`.
    event.target.value = "";
    if (files.length === 0) return;

    const { accepted, errors } = checkPhotoFiles(files, slotsLeft);
    setPickErrors(errors);

    const added = accepted.map(({ file, mimeType }): PendingUpload => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      nextUploadId.current += 1;
      return {
        id: `upload-${nextUploadId.current}`,
        file,
        mimeType,
        previewUrl,
        status: "uploading",
      };
    });
    setUploads((current) => [...current, ...added]);
    // Uploaded in parallel, confirmed in the order chosen (see `createTurnQueue`).
    added.forEach((upload) => void start(upload));
  }

  function retry(upload: PendingUpload) {
    const again = {
      ...upload,
      status: "uploading" as const,
      error: undefined,
      canRetry: undefined,
    };
    setUploads((current) =>
      current.map((u) => (u.id === upload.id ? again : u)),
    );
    void start(again);
  }

  return (
    <div className="mt-8 space-y-8">
      <section aria-labelledby="add-photos-heading">
        <h2 id="add-photos-heading" className="text-xl font-semibold">
          Photos{" "}
          <span className="text-base font-normal text-slate-500">
            ({photos.length} of {MAX_PHOTOS_PER_PROPERTY})
          </span>
        </h2>
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-slate-600">
          JPG or PNG, up to 5 MB each and {MAX_PHOTOS_PER_PROPERTY} photos per
          listing. The first photo you add becomes the cover; you can change it
          below.
        </p>

        <noscript>
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Uploading photos needs JavaScript. Turn it on to add photos, or
            publish your listing without them.
          </p>
        </noscript>

        {/*
          The real input is visually hidden but focusable; the label is the button people see, so
          it opens the file picker with a click, a tap or Enter/Space via the input's focus.
        */}
        {hasJs && (
          <div className="mt-4">
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              multiple
              disabled={slotsLeft === 0}
              onChange={onFilesChosen}
              aria-describedby={`${inputId}-hint`}
              className="peer sr-only"
            />
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center justify-center rounded-full border border-emerald-700 px-5 py-2 font-medium text-emerald-800 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-700 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:border-slate-300 peer-disabled:text-slate-400 hover:bg-emerald-50"
            >
              {slotsLeft === 0
                ? `Maximum of ${MAX_PHOTOS_PER_PROPERTY} photos reached`
                : "Choose photos"}
            </label>
          </div>
        )}

        {pickErrors.length > 0 && (
          <ul
            role="alert"
            className="mt-4 space-y-1 rounded-lg bg-red-50 px-4 py-3 text-sm break-words text-red-700"
          >
            {pickErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {uploads.length > 0 && (
          <ul
            aria-label="Uploads"
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {uploads.map((upload) => (
              <li
                key={upload.id}
                className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  {!upload.previewBroken && (
                    // Local preview (blob: URL), so next/image doesn't apply.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={upload.previewUrl}
                      alt=""
                      // A file that isn't really an image has no preview: keep the grey box
                      // instead of the browser's broken-image icon.
                      onError={() => markPreviewBroken(upload.id)}
                      className={`h-full w-full object-cover ${upload.status === "uploading" ? "opacity-60" : ""}`}
                    />
                  )}
                  {upload.status === "uploading" && (
                    <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-center text-xs text-white">
                      Uploading…
                    </span>
                  )}
                </div>
                <div className="p-2 text-sm">
                  <p
                    className="truncate text-slate-700"
                    title={upload.file.name}
                  >
                    {upload.file.name}
                  </p>
                  {upload.status === "failed" && (
                    <>
                      <p role="alert" className="mt-1 break-words text-red-600">
                        {upload.error}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {upload.canRetry && (
                          <button
                            type="button"
                            onClick={() => retry(upload)}
                            className="rounded-full bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800"
                          >
                            Try again
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeUpload(upload.id)}
                          aria-label={`Remove ${upload.file.name}`}
                          className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* Announces progress to screen readers without reading every thumbnail. */}
        <p aria-live="polite" className="sr-only">
          {uploading > 0
            ? `Uploading ${uploading} ${uploading === 1 ? "photo" : "photos"}…`
            : ""}
        </p>
      </section>

      <PhotoGalleryEditor
        propertyId={propertyId}
        photos={photos}
        onPhotosChange={setPhotos}
        // Rearranging while uploads finish could answer with a gallery that misses them.
        locked={uploading > 0}
        onBusyChange={setGalleryBusy}
      />

      <form action={publishAction} className="border-t border-slate-200 pt-6">
        <input type="hidden" name="propertyId" value={propertyId} />
        {publishState.error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {publishState.error}
          </p>
        )}
        {photos.length === 0 && uploading === 0 && (
          <p className="mb-4 text-sm text-slate-600">
            Photos are optional, but listings with photos get more visits.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || isPublishing}
          className="w-full rounded-full bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto"
        >
          {isPublishing
            ? "Publishing…"
            : uploading > 0
              ? "Wait for the uploads to finish"
              : "Publish listing"}
        </button>
      </form>
    </div>
  );
}
