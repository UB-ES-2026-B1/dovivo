import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  DISPLAY_MAX_PX,
  InvalidPhotoError,
  processPhoto,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
} from "./photo-processing";

/** A plain image made on the fly, so the tests need no fixture files. */
function image(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: "#3a7" },
  });
}

describe("processPhoto", () => {
  it("keeps a JPG as JPG and makes a WebP thumbnail inside 640×480", async () => {
    const result = await processPhoto(await image(1200, 800).jpeg().toBuffer());

    expect(result.mimeType).toBe("image/jpeg");
    expect(result).toMatchObject({ width: 1200, height: 800 });
    expect((await sharp(result.display).metadata()).format).toBe("jpeg");

    const thumb = await sharp(result.thumbnail).metadata();
    expect(thumb.format).toBe("webp");
    expect(thumb.width).toBeLessThanOrEqual(THUMBNAIL_WIDTH);
    expect(thumb.height).toBeLessThanOrEqual(THUMBNAIL_HEIGHT);
    expect([thumb.width, thumb.height]).toEqual([640, 427]);
  });

  it("keeps a PNG as PNG", async () => {
    const result = await processPhoto(await image(300, 200).png().toBuffer());

    expect(result.mimeType).toBe("image/png");
    expect((await sharp(result.display).metadata()).format).toBe("png");
  });

  it("shrinks big photos to 1920 px on the long side and never enlarges small ones", async () => {
    const big = await processPhoto(await image(4000, 3000).jpeg().toBuffer());
    expect([big.width, big.height]).toEqual([DISPLAY_MAX_PX, 1440]);

    const small = await processPhoto(await image(320, 240).jpeg().toBuffer());
    expect([small.width, small.height]).toEqual([320, 240]);
    const thumb = await sharp(small.thumbnail).metadata();
    expect([thumb.width, thumb.height]).toEqual([320, 240]);
  });

  it("turns the photo upright and drops the EXIF metadata", async () => {
    // A landscape buffer that the EXIF orientation 6 says to show rotated 90°.
    const withExif = await image(400, 300)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const result = await processPhoto(withExif);

    expect([result.width, result.height]).toEqual([300, 400]);
    const out = await sharp(result.display).metadata();
    expect(out.exif).toBeUndefined();
    expect(out.orientation).toBeUndefined();
  });

  it.each([
    ["a WebP", () => image(50, 50).webp().toBuffer()],
    ["a GIF", () => image(50, 50).gif().toBuffer()],
    ["a text file", () => Promise.resolve(Buffer.from("not an image"))],
    ["an empty file", () => Promise.resolve(Buffer.alloc(0))],
  ])("refuses %s", async (_case, make) => {
    await expect(processPhoto(await make())).rejects.toThrow(
      new InvalidPhotoError("Only JPG or PNG photos are allowed"),
    );
  });

  it("refuses a file that says JPG but is cut off", async () => {
    const jpg = await image(800, 600).jpeg().toBuffer();

    await expect(
      processPhoto(jpg.subarray(0, Math.floor(jpg.length / 2))),
    ).rejects.toBeInstanceOf(InvalidPhotoError);
  });

  it("refuses an image with more pixels than allowed before decoding it", async () => {
    const png = await image(100, 100).png().toBuffer();

    await expect(processPhoto(png, { maxInputPixels: 9_999 })).rejects.toThrow(
      /too large/,
    );
  });
});
