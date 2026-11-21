import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PROPERTY,
  type PhotoMimeType,
} from "~/lib/validators/photo";

/**
 * Photo upload logic of the publish flow (US-18.F1 / F2), kept out of the React component so it
 * can be tested on its own. The limits come from `~/lib/validators/photo`, the same ones the API
 * uses, so a file the browser accepts is never refused for its type or size by the server.
 */

/** What the checks need from a `File` (a plain object in the tests). */
export type PickedFile = { name: string; type: string; size: number };

export type CheckedFiles<F extends PickedFile> = {
  /** Valid files that fit in the gallery, with the type to send to `createUpload`. */
  accepted: { file: F; mimeType: PhotoMimeType }[];
  /** One message per problem, ready to show. */
  errors: string[];
};

const MB = 1024 * 1024;

/** "4.2 MB" (or "820 KB" for small files), for the error messages. */
export function formatFileSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/**
 * The type to upload the file with, or `null` if it isn't a JPG or PNG. Some browsers leave
 * `type` empty (e.g. files from some Android apps), so then the extension decides; the server
 * checks the real content anyway.
 */
export function photoMimeTypeOf(file: PickedFile): PhotoMimeType | null {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "image/jpeg";
  if (type === "image/png") return "image/png";
  if (type !== "") return null;

  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  return null;
}

/**
 * Checks the chosen files before uploading anything: JPG/PNG, not empty, at most 5 MB, and no
 * more than the photos still allowed (`slotsLeft` = 15 minus the gallery and the uploads in
 * progress). Valid files are accepted in the order they were chosen until the gallery is full.
 */
export function checkPhotoFiles<F extends PickedFile>(
  files: readonly F[],
  slotsLeft: number,
): CheckedFiles<F> {
  const accepted: CheckedFiles<F>["accepted"] = [];
  const errors: string[] = [];
  const leftOut: string[] = [];

  for (const file of files) {
    const mimeType = photoMimeTypeOf(file);
    if (!mimeType) {
      errors.push(`"${file.name}" isn't a JPG or PNG photo.`);
    } else if (file.size === 0) {
      errors.push(`"${file.name}" is empty.`);
    } else if (file.size > MAX_PHOTO_BYTES) {
      errors.push(
        `"${file.name}" is ${formatFileSize(file.size)}. Each photo can be at most 5 MB.`,
      );
    } else if (accepted.length >= slotsLeft) {
      leftOut.push(`"${file.name}"`);
    } else {
      accepted.push({ file, mimeType });
    }
  }

  if (leftOut.length > 0) {
    const room =
      slotsLeft <= 0
        ? "The listing already has the maximum of"
        : `Only ${slotsLeft} more could be added, up to the maximum of`;
    errors.push(
      `${room} ${MAX_PHOTOS_PER_PROPERTY} photos. Not added: ${leftOut.join(", ")}.`,
    );
  }

  return { accepted, errors };
}

/** Photos that can still be added, counting the uploads that haven't finished. */
export function photoSlotsLeft(galleryCount: number, uploadingCount: number) {
  return Math.max(0, MAX_PHOTOS_PER_PROPERTY - galleryCount - uploadingCount);
}

/** The `PUT` to the storage failed (network, expired URL...). Retrying with a new URL may work. */
export class StorageUploadError extends Error {
  constructor(status?: number) {
    super(status ? `Storage answered ${status}` : "Storage upload failed");
    this.name = "StorageUploadError";
  }
}

type ErrorData = {
  code?: string;
  zodError?: { fieldErrors?: Record<string, string[] | undefined> } | null;
};

/** The `data` of a tRPC client error, read by shape so the tests don't need a real one. */
function trpcErrorData(error: unknown): ErrorData | null {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return null;
  }
  const { data } = error;
  return typeof data === "object" && data !== null ? data : null;
}

export const UPLOAD_FAILED_MESSAGE =
  "The photo couldn't be uploaded. Check your connection and try again.";
export const GENERIC_PHOTO_ERROR = "Something went wrong. Please try again.";

/** Server messages come with and without a final period; show them all the same way. */
function asSentence(message: string) {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

/** Server answers for one photo, as a message to show next to it. */
export function photoErrorMessage(error: unknown): string {
  if (error instanceof StorageUploadError) return UPLOAD_FAILED_MESSAGE;

  const data = trpcErrorData(error);
  if (!data) return UPLOAD_FAILED_MESSAGE; // fetch threw: offline or similar.

  switch (data.code) {
    case "BAD_REQUEST": {
      // Field errors from zod (type or size), else the server's own message (16th photo, file
      // that isn't really an image, damaged file...).
      const fieldErrors = data.zodError?.fieldErrors ?? {};
      const first = Object.values(fieldErrors).find((list) => list?.length);
      const message = first?.[0] ?? (error as { message?: unknown }).message;
      return typeof message === "string" && message !== ""
        ? asSentence(message)
        : GENERIC_PHOTO_ERROR;
    }
    case "UNAUTHORIZED":
      return "Your session has expired. Sign in again to add photos.";
    case "NOT_FOUND":
    case "FORBIDDEN":
      return "This listing doesn't exist any more or isn't yours.";
    case "CONFLICT":
      return "The photo couldn't be saved. Try again.";
    default:
      return GENERIC_PHOTO_ERROR;
  }
}

/**
 * Whether trying the same file again can work. A file the server refused (wrong content, 16th
 * photo) or a listing that isn't yours will fail again; a lost connection or a server hiccup may
 * not.
 */
export function canRetryPhoto(error: unknown): boolean {
  if (error instanceof StorageUploadError) return true;
  const data = trpcErrorData(error);
  if (!data) return true;
  return (
    data.code === "CONFLICT" ||
    data.code === "INTERNAL_SERVER_ERROR" ||
    data.code === "TIMEOUT"
  );
}

export type UploadSteps<Photo> = {
  createUpload(input: {
    propertyId: string;
    mimeType: PhotoMimeType;
    sizeBytes: number;
  }): Promise<{
    key: string;
    uploadUrl: string;
    headers: Record<string, string>;
  }>;
  confirm(input: { propertyId: string; key: string }): Promise<Photo>;
  /** Defaults to `fetch`; injected in the tests. */
  put?: typeof fetch;
};

/**
 * Uploads one photo as the API asks (docs/api.md, "Listing photos"): ask for a signed URL, `PUT`
 * the file straight to the storage, then `confirm` it. Returns the saved photo, or throws (use
 * `photoErrorMessage` to show why). Every try starts from a new URL, so retrying after an
 * expired or failed upload works.
 */
export async function uploadPhoto<Photo>(
  propertyId: string,
  picked: { file: Blob; mimeType: PhotoMimeType },
  steps: UploadSteps<Photo>,
): Promise<Photo> {
  const { key, uploadUrl, headers } = await steps.createUpload({
    propertyId,
    mimeType: picked.mimeType,
    sizeBytes: picked.file.size,
  });

  // The storage, not our API: the one `fetch` AGENTS rule 2 allows (docs/api.md).
  const put = steps.put ?? fetch;
  let response: Response;
  try {
    response = await put(uploadUrl, {
      method: "PUT",
      headers,
      body: picked.file,
    });
  } catch {
    throw new StorageUploadError();
  }
  if (!response.ok) throw new StorageUploadError(response.status);

  return steps.confirm({ propertyId, key });
}

/**
 * Keeps the gallery in the order the files were chosen. Files upload in parallel and finish in
 * any order, but the server gives each photo the next position when it is confirmed (and makes
 * the first one the cover). So each upload takes a turn when it starts and confirms only after
 * the previous turns are done (confirmed or failed). Call `done` on every path, or later uploads
 * wait forever.
 */
export function createTurnQueue() {
  let last: Promise<void> = Promise.resolve();
  return function takeTurn() {
    const previous = last;
    let done!: () => void;
    last = new Promise<void>((resolve) => (done = resolve));
    return { wait: previous, done };
  };
}

/**
 * The gallery order after moving the photo at `index` one place (`-1` = earlier, `1` = later),
 * or `null` if it is already at that end. This is the `order` that `photos.update` expects.
 */
export function movedOrder(
  ids: readonly string[],
  index: number,
  direction: -1 | 1,
): string[] | null {
  const target = index + direction;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) {
    return null;
  }
  const order = [...ids];
  [order[index], order[target]] = [order[target]!, order[index]!];
  return order;
}
