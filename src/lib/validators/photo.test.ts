import { describe, expect, it } from "vitest";

import {
  confirmPhotoSchema,
  createPhotoUploadSchema,
  MAX_PHOTO_BYTES,
  updatePhotosSchema,
} from "./photo";

describe("createPhotoUploadSchema", () => {
  const valid = { propertyId: "prop_1", mimeType: "image/jpeg", sizeBytes: 1 };

  it("accepts a JPG or PNG of up to 5 MB", () => {
    expect(createPhotoUploadSchema.safeParse(valid).success).toBe(true);
    expect(
      createPhotoUploadSchema.safeParse({
        ...valid,
        mimeType: "image/png",
        sizeBytes: MAX_PHOTO_BYTES,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["mimeType", "image/webp", "Only JPG or PNG photos are allowed"],
    ["mimeType", "image/gif", "Only JPG or PNG photos are allowed"],
    ["sizeBytes", MAX_PHOTO_BYTES + 1, "Each photo can be at most 5 MB"],
  ])("refuses %s = %j with a clear message", (field, value, message) => {
    const result = createPhotoUploadSchema.safeParse({
      ...valid,
      [field]: value,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toEqual({ [field]: [message] });
  });

  it.each([0, -1, 1.5])("refuses a size of %j", (sizeBytes) => {
    expect(
      createPhotoUploadSchema.safeParse({ ...valid, sizeBytes }).success,
    ).toBe(false);
  });
});

describe("confirmPhotoSchema", () => {
  it("stores an empty alt text as null", () => {
    expect(
      confirmPhotoSchema.parse({ propertyId: "p", key: "k", alt: "  " }).alt,
    ).toBeNull();
  });
});

describe("updatePhotosSchema", () => {
  it("accepts the order, the cover or both", () => {
    for (const input of [
      { order: ["a", "b"] },
      { coverImageId: "a" },
      { order: ["a"], coverImageId: "a" },
    ]) {
      expect(
        updatePhotosSchema.safeParse({ propertyId: "p", ...input }).success,
      ).toBe(true);
    }
  });

  it("refuses an empty update, a repeated photo and more than 15 photos", () => {
    for (const input of [
      {},
      { order: ["a", "a"] },
      { order: Array.from({ length: 16 }, (_, i) => `img_${i}`) },
    ]) {
      expect(
        updatePhotosSchema.safeParse({ propertyId: "p", ...input }).success,
      ).toBe(false);
    }
  });
});
