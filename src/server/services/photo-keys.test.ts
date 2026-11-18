import { describe, expect, it } from "vitest";

import {
  isPhotoKeyOf,
  isStorageKey,
  newPhotoKey,
  photoUrl,
  thumbnailKeyFor,
} from "./photo-keys";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("newPhotoKey", () => {
  it("puts the photo under its listing with the format's extension", () => {
    expect(newPhotoKey("prop_1", "image/jpeg", UUID)).toBe(
      `properties/prop_1/${UUID}.jpg`,
    );
    expect(newPhotoKey("prop_1", "image/png", UUID)).toBe(
      `properties/prop_1/${UUID}.png`,
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
    ["another listing", `properties/prop_2/${UUID}.jpg`],
    ["a prefix of the id", `properties/prop_10/${UUID}.jpg`],
    ["a thumbnail", `properties/prop_1/${UUID}-thumb.webp`],
    ["another extension", `properties/prop_1/${UUID}.gif`],
    ["a nested path", `properties/prop_1/x/${UUID}.jpg`],
    ["a path traversal", `properties/prop_1/../prop_2/${UUID}.jpg`],
    ["any other object", "secrets/backup.sql"],
  ])("refuses %s", (_case, key) => {
    expect(isPhotoKeyOf("prop_1", key)).toBe(false);
  });
});

describe("thumbnailKeyFor", () => {
  it("adds -thumb and uses WebP", () => {
    expect(thumbnailKeyFor(`properties/prop_1/${UUID}.png`)).toBe(
      `properties/prop_1/${UUID}-thumb.webp`,
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
