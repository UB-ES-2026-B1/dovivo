import { describe, expect, it } from "vitest";

import {
  displayKeyFor,
  isPhotoKeyOf,
  isStorageKey,
  newPhotoKey,
  PENDING_UPLOAD_PREFIX,
  photoUrl,
  thumbnailKeyFor,
} from "./photo-keys";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const UPLOAD = `uploads/prop_1/${UUID}.jpg`;

describe("newPhotoKey", () => {
  it("puts the upload under the pending prefix and its listing, with the format's extension", () => {
    expect(newPhotoKey("prop_1", "image/jpeg", UUID)).toBe(UPLOAD);
    expect(newPhotoKey("prop_1", "image/png", UUID)).toBe(
      `uploads/prop_1/${UUID}.png`,
    );
    expect(newPhotoKey("prop_1", "image/png")).toMatch(
      new RegExp(`^${PENDING_UPLOAD_PREFIX}`),
    );
  });

  it("makes a different key every time", () => {
    expect(newPhotoKey("prop_1", "image/jpeg")).not.toBe(
      newPhotoKey("prop_1", "image/jpeg"),
    );
  });
});

describe("isPhotoKeyOf", () => {
  it("accepts the keys made for the listing", () => {
    expect(isPhotoKeyOf("prop_1", newPhotoKey("prop_1", "image/png"))).toBe(
      true,
    );
  });

  it.each([
    ["another listing", `uploads/prop_2/${UUID}.jpg`],
    ["a prefix of the id", `uploads/prop_10/${UUID}.jpg`],
    ["a published photo", `properties/prop_1/${UUID}-display.jpg`],
    ["an upload key of the old format", `properties/prop_1/${UUID}.jpg`],
    ["a thumbnail", `properties/prop_1/${UUID}-thumb.webp`],
    ["another extension", `uploads/prop_1/${UUID}.gif`],
    ["a nested path", `uploads/prop_1/x/${UUID}.jpg`],
    ["a path traversal", `uploads/prop_1/../prop_2/${UUID}.jpg`],
    ["any other object", "secrets/backup.sql"],
  ])("refuses %s", (_case, key) => {
    expect(isPhotoKeyOf("prop_1", key)).toBe(false);
  });
});

describe("displayKeyFor", () => {
  it("publishes under properties/ with -display and the same format", () => {
    expect(displayKeyFor(UPLOAD)).toBe(`properties/prop_1/${UUID}-display.jpg`);
    expect(displayKeyFor(`uploads/prop_1/${UUID}.png`)).toBe(
      `properties/prop_1/${UUID}-display.png`,
    );
  });

  it("is outside the pending prefix (never expires) and never an upload key", () => {
    expect(displayKeyFor(UPLOAD).startsWith(PENDING_UPLOAD_PREFIX)).toBe(false);
    expect(isPhotoKeyOf("prop_1", displayKeyFor(UPLOAD))).toBe(false);
  });

  it("refuses a key that isn't an upload", () => {
    expect(() => displayKeyFor(`properties/prop_1/${UUID}.jpg`)).toThrow();
  });
});

describe("thumbnailKeyFor", () => {
  it("publishes under properties/ with -thumb and uses WebP", () => {
    expect(thumbnailKeyFor(`uploads/prop_1/${UUID}.png`)).toBe(
      `properties/prop_1/${UUID}-thumb.webp`,
    );
    expect(thumbnailKeyFor(UPLOAD).startsWith(PENDING_UPLOAD_PREFIX)).toBe(
      false,
    );
  });
});

describe("photoUrl", () => {
  const base = "http://localhost:9000/dovivo-photos";

  it("joins the public base URL and the key", () => {
    expect(photoUrl("properties/p/a.jpg", base)).toBe(
      "http://localhost:9000/dovivo-photos/properties/p/a.jpg",
    );
    expect(photoUrl("properties/p/a.jpg", `${base}/`)).toBe(
      "http://localhost:9000/dovivo-photos/properties/p/a.jpg",
    );
  });

  it("leaves full URLs (seed photos) as they are", () => {
    const seed = "https://picsum.photos/seed/x/1200/800";
    expect(isStorageKey(seed)).toBe(false);
    expect(photoUrl(seed, base)).toBe(seed);
  });

  it("returns the key when the storage isn't configured", () => {
    expect(photoUrl("properties/p/a.jpg", undefined)).toBe(
      "properties/p/a.jpg",
    );
  });
});
