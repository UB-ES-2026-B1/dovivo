import sharp, { type Metadata } from "sharp";

import { type PhotoMimeType } from "~/lib/validators/photo";

/**
 * Image processing for listing photos (US-18.B2), run by `property.photos.confirm` on the
 * uploaded file:
 * - checks the real content is a JPG or PNG (the browser's `Content-Type` can't be trusted);
 * - re-encodes the original: turned upright from the EXIF orientation, at most 1920 px on the
 *   long side and without metadata (EXIF can carry GPS and camera data), so the detail page
 *   shows a lighter photo;
 * - makes a WebP thumbnail for the cards.
 */

/** Long side of the photo shown on the detail page. */
export const DISPLAY_MAX_PX = 1920;
/** Box the card thumbnail fits in (cards are 3:2). */
export const THUMBNAIL_WIDTH = 640;
export const THUMBNAIL_HEIGHT = 480;

/**
 * Larger images are refused before decoding: 40 MP is more than any phone photo and keeps a
 * small file that expands to a huge bitmap ("decompression bomb") from using all the memory.
 */
export const MAX_INPUT_PIXELS = 40_000_000;

export class InvalidPhotoError extends Error {
  constructor(message = "Only JPG or PNG photos are allowed") {
    super(message);
    this.name = "InvalidPhotoError";
  }
}

export type ProcessedPhoto = {
  mimeType: PhotoMimeType;
  /** Re-encoded original, same format as uploaded. */
  display: Buffer;
  width: number;
  height: number;
  thumbnail: Buffer;
};

const FORMATS: Partial<Record<string, PhotoMimeType>> = {
  jpeg: "image/jpeg",
  png: "image/png",
};

/** `maxInputPixels` is a parameter only so tests don't need a 40 MP image. */
export async function processPhoto(
  input: Buffer,
  { maxInputPixels = MAX_INPUT_PIXELS }: { maxInputPixels?: number } = {},
): Promise<ProcessedPhoto> {
  const options = {
    limitInputPixels: maxInputPixels,
    failOn: "error",
  } as const;

  let metadata: Metadata;
  try {
    // Reads only the header: nothing is decoded yet. No pixel limit here (sharp would throw
    // a generic error); the size is checked just below with a clearer message.
    metadata = await sharp(input).metadata();
  } catch {
    throw new InvalidPhotoError();
  }
  const mimeType = metadata.format ? FORMATS[metadata.format] : undefined;
  if (!mimeType) throw new InvalidPhotoError();
  if ((metadata.width ?? 0) * (metadata.height ?? 0) > maxInputPixels) {
    throw new InvalidPhotoError(
      "The photo is too large (at most 40 megapixels)",
    );
  }

  try {
    // `rotate()` without arguments applies the EXIF orientation. Metadata is dropped by default.
    const upright = sharp(input, options).rotate();

    const resized = upright.clone().resize({
      width: DISPLAY_MAX_PX,
      height: DISPLAY_MAX_PX,
      fit: "inside",
      withoutEnlargement: true,
    });
    const { data: display, info } = await (
      mimeType === "image/jpeg"
        ? resized.jpeg({ quality: 82, mozjpeg: true })
        : resized.png({ compressionLevel: 9 })
    ).toBuffer({ resolveWithObject: true });

    const thumbnail = await upright
      .clone()
      .resize({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();

    return {
      mimeType,
      display,
      width: info.width,
      height: info.height,
      thumbnail,
    };
  } catch {
    // The header looked fine but the image data is broken.
    throw new InvalidPhotoError("The photo is damaged and can't be read");
  }
}
