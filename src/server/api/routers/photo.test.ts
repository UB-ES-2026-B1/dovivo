import { Prisma, type PrismaClient } from "@prisma/client";
import { type Session } from "next-auth";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PHOTO_BYTES } from "~/lib/validators/photo";
import { createCaller } from "~/server/api/root";
import { type PhotoStorage } from "~/server/services/photo-storage";

/**
 * Unit tests for `property.photos.*` (US-18). Prisma and the storage are fakes; image processing
 * is the real one (sharp) on small generated images.
 */

const storage = {
  createUploadUrl: vi.fn<PhotoStorage["createUploadUrl"]>(),
  sizeOf: vi.fn<PhotoStorage["sizeOf"]>(),
  download: vi.fn<PhotoStorage["download"]>(),
  upload: vi.fn<PhotoStorage["upload"]>(),
  remove: vi.fn<PhotoStorage["remove"]>(),
};
let storageConfigured = true;

vi.mock("~/server/services/photo-storage", () => ({
  getPhotoStorage: () => (storageConfigured ? storage : null),
}));

const fakeDb = {
  property: { findUnique: vi.fn() },
  propertyImage: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
};

const session = (id: string): Session => ({
  user: { id, role: "USER" },
  expires: new Date(Date.now() + 60_000).toISOString(),
});

const makeCaller = (s: Session | null = session("owner_1")) =>
  createCaller({
    db: fakeDb as unknown as PrismaClient,
    session: s,
    clientIp: null,
    headers: new Headers(),
  }).property.photos;

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const KEY = `properties/prop_1/${UUID}.jpg`;
const THUMB = `properties/prop_1/${UUID}-thumb.webp`;

const ownListing = { ownerId: "owner_1", deletedAt: null };

const jpg = () =>
  sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#3a7" },
  })
    .jpeg()
    .toBuffer();

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6",
  });

beforeEach(() => {
  vi.resetAllMocks();
  storageConfigured = true;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fakeDb.$transaction.mockImplementation(
    (run: (tx: typeof fakeDb) => unknown) => run(fakeDb),
  );
  fakeDb.property.findUnique.mockResolvedValue(ownListing);
  fakeDb.propertyImage.findMany.mockResolvedValue([]);
});

describe("ownership (every procedure)", () => {
  const calls = {
    createUpload: (c: ReturnType<typeof makeCaller>) =>
      c.createUpload({
        propertyId: "prop_1",
        mimeType: "image/jpeg",
        sizeBytes: 1000,
      }),
    confirm: (c: ReturnType<typeof makeCaller>) =>
      c.confirm({ propertyId: "prop_1", key: KEY }),
    update: (c: ReturnType<typeof makeCaller>) =>
      c.update({ propertyId: "prop_1", coverImageId: "img_1" }),
  };

  it.each(Object.entries(calls))(
    "%s: UNAUTHORIZED without a session",
    async (_name, call) => {
      await expect(call(makeCaller(null))).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    },
  );

  it.each(Object.entries(calls))(
    "%s: FORBIDDEN on someone else's listing",
    async (_name, call) => {
      await expect(call(makeCaller(session("user_2")))).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(storage.createUploadUrl).not.toHaveBeenCalled();
      expect(storage.download).not.toHaveBeenCalled();
      expect(fakeDb.propertyImage.update).not.toHaveBeenCalled();
    },
  );

  it.each(Object.entries(calls))(
    "%s: NOT_FOUND for a missing or deleted listing",
    async (_name, call) => {
      fakeDb.property.findUnique.mockResolvedValueOnce(null);
      await expect(call(makeCaller())).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      fakeDb.property.findUnique.mockResolvedValueOnce({
        ...ownListing,
        deletedAt: new Date(),
      });
      await expect(call(makeCaller())).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    },
  );
});

describe("property.photos.createUpload", () => {
  const input = {
    propertyId: "prop_1",
    mimeType: "image/png",
    sizeBytes: 123_456,
  } as const;

  it("returns a signed URL for a new key of the listing", async () => {
    fakeDb.propertyImage.count.mockResolvedValue(3);
    const expiresAt = new Date();
    storage.createUploadUrl.mockResolvedValue({
      url: "https://storage.test/signed",
      expiresAt,
    });

    const result = await makeCaller().createUpload(input);

    expect(result.key).toMatch(/^properties\/prop_1\/[0-9a-f-]{36}\.png$/);
    expect(result).toMatchObject({
      uploadUrl: "https://storage.test/signed",
      headers: { "Content-Type": "image/png" },
      expiresAt,
    });
    expect(storage.createUploadUrl).toHaveBeenCalledWith({
      key: result.key,
      contentType: "image/png",
      contentLength: 123_456,
    });
  });

  it.each([
    ["a GIF", { mimeType: "image/gif" }],
    ["a file over 5 MB", { sizeBytes: MAX_PHOTO_BYTES + 1 }],
    ["an empty file", { sizeBytes: 0 }],
  ])("refuses %s before touching the database", async (_case, override) => {
    await expect(
      makeCaller().createUpload({ ...input, ...override } as typeof input),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fakeDb.property.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a 16th photo", async () => {
    fakeDb.propertyImage.count.mockResolvedValue(15);

    await expect(makeCaller().createUpload(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "A listing can have at most 15 photos.",
    });
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it("answers an error when the storage isn't configured", async () => {
    storageConfigured = false;

    await expect(makeCaller().createUpload(input)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Photo storage is not configured.",
    });
  });
});

describe("property.photos.confirm", () => {
  const created = {
    id: "img_1",
    url: KEY,
    thumbnailUrl: THUMB,
    alt: null,
    position: 0,
    isCover: true,
    width: 1200,
    height: 800,
  };

  async function uploaded(sizeBytes = 50_000) {
    storage.sizeOf.mockResolvedValue(sizeBytes);
    storage.download.mockResolvedValue(await jpg());
  }

  it("creates the first photo as cover at position 0, with its thumbnail", async () => {
    await uploaded();
    fakeDb.propertyImage.count.mockResolvedValue(0);
    fakeDb.propertyImage.create.mockResolvedValue(created);

    const photo = await makeCaller().confirm({
      propertyId: "prop_1",
      key: KEY,
      alt: "  Sala d'estar  ",
    });

    expect(photo).toEqual(created);
    expect(storage.upload).toHaveBeenCalledWith(
      KEY,
      expect.any(Buffer),
      "image/jpeg",
    );
    expect(storage.upload).toHaveBeenCalledWith(
      THUMB,
      expect.any(Buffer),
      "image/webp",
    );
    expect(fakeDb.propertyImage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          propertyId: "prop_1",
          url: KEY,
          thumbnailUrl: THUMB,
          alt: "Sala d'estar",
          mimeType: "image/jpeg",
          sizeBytes: 50_000,
          width: 1200,
          height: 800,
          position: 0,
          isCover: true,
        },
      }),
    );
  });

  it("adds later photos at the end, without changing the cover", async () => {
    await uploaded();
    fakeDb.propertyImage.count
      .mockResolvedValueOnce(4) // photos of the listing
      .mockResolvedValueOnce(1); // covers
    fakeDb.propertyImage.create.mockResolvedValue({
      ...created,
      position: 4,
      isCover: false,
    });

    await makeCaller().confirm({ propertyId: "prop_1", key: KEY });

    const [args] = fakeDb.propertyImage.create.mock.calls[0] as [
      { data: { position: number; isCover: boolean } },
    ];
    expect(args.data).toMatchObject({ position: 4, isCover: false });
  });

  it.each([
    ["another listing's key", `properties/prop_2/${UUID}.jpg`],
    ["an arbitrary object", "secrets/backup.sql"],
  ])("refuses %s without reading the storage", async (_case, key) => {
    await expect(
      makeCaller().confirm({ propertyId: "prop_1", key }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.sizeOf).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("returns the photo again if the key was already confirmed", async () => {
    fakeDb.propertyImage.findFirst.mockResolvedValue(created);

    await expect(
      makeCaller().confirm({ propertyId: "prop_1", key: KEY }),
    ).resolves.toEqual(created);
    expect(storage.download).not.toHaveBeenCalled();
    expect(fakeDb.propertyImage.create).not.toHaveBeenCalled();
  });

  it("refuses a key whose file was never uploaded", async () => {
    storage.sizeOf.mockResolvedValue(null);

    await expect(
      makeCaller().confirm({ propertyId: "prop_1", key: KEY }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The photo hasn't been uploaded yet.",
    });
  });

  it("refuses and deletes a file over 5 MB", async () => {
    storage.sizeOf.mockResolvedValue(MAX_PHOTO_BYTES + 1);

    await expect(
      makeCaller().confirm({ propertyId: "prop_1", key: KEY }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Each photo can be at most 5 MB.",
    });
    expect(storage.download).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledWith([KEY, THUMB]);
  });

  it("refuses and deletes a file that isn't really a JPG or PNG", async () => {
    storage.sizeOf.mockResolvedValue(20);
    storage.download.mockResolvedValue(Buffer.from("<html>not a photo</html>"));

    await expect(
      makeCaller().confirm({ propertyId: "prop_1", key: KEY }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only JPG or PNG photos are allowed",
    });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledWith([KEY, THUMB]);
  });

  it("refuses the 16th photo even if another tab got the URL first", async () => {
    await uploaded();
    fakeDb.propertyImage.count.mockResolvedValue(15);

    await expect(
      makeCaller().confirm({ propertyId: "prop_1", key: KEY }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fakeDb.propertyImage.create).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledWith([KEY, THUMB]);
  });

  it("answers CONFLICT and cleans up when another photo took the same position", async () => {
    await uploaded();
    fakeDb.propertyImage.count.mockResolvedValue(2);
    fakeDb.propertyImage.create.mockRejectedValue(uniqueViolation());

    await expect(
      makeCaller().confirm({ propertyId: "prop_1", key: KEY }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(storage.remove).toHaveBeenCalledWith([KEY, THUMB]);
  });

  it("keeps the files when the same key was confirmed twice at once", async () => {
    await uploaded();
    fakeDb.propertyImage.count.mockResolvedValue(2);
    fakeDb.propertyImage.create.mockRejectedValue(uniqueViolation());
    fakeDb.propertyImage.findFirst
      .mockResolvedValueOnce(null) // before processing
      .mockResolvedValueOnce(created); // registered by the other call

    await expect(
      makeCaller().confirm({ propertyId: "prop_1", key: KEY }),
    ).resolves.toEqual(created);
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe("property.photos.update", () => {
  const images = [{ id: "a" }, { id: "b" }, { id: "c" }];

  beforeEach(() => {
    fakeDb.propertyImage.findMany
      .mockResolvedValueOnce(images) // ids of the listing
      .mockResolvedValueOnce([]); // gallery returned
  });

  it("moves every photo out of the way, then writes the new order", async () => {
    await makeCaller().update({ propertyId: "prop_1", order: ["c", "a", "b"] });

    expect(fakeDb.propertyImage.updateMany).toHaveBeenCalledWith({
      where: { propertyId: "prop_1" },
      data: { position: { decrement: 1015 } },
    });
    expect(
      fakeDb.propertyImage.update.mock.calls.map(([args]) => args as unknown),
    ).toEqual([
      { where: { id: "c" }, data: { position: 0 } },
      { where: { id: "a" }, data: { position: 1 } },
      { where: { id: "b" }, data: { position: 2 } },
    ]);
    // Moving out of the way happens before any final position is written.
    expect(
      fakeDb.propertyImage.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(fakeDb.propertyImage.update.mock.invocationCallOrder[0]!);
  });

  it.each([
    ["misses a photo", ["a", "b"]],
    ["has a photo of another listing", ["a", "b", "x"]],
  ])("refuses an order that %s", async (_case, order) => {
    await expect(
      makeCaller().update({ propertyId: "prop_1", order }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fakeDb.propertyImage.update).not.toHaveBeenCalled();
  });

  it("refuses an order with the same photo twice before touching the database", async () => {
    fakeDb.propertyImage.findMany.mockReset();

    await expect(
      makeCaller().update({ propertyId: "prop_1", order: ["a", "a", "b"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fakeDb.property.findUnique).not.toHaveBeenCalled();
  });

  it("unmarks the old cover before marking the new one", async () => {
    await makeCaller().update({ propertyId: "prop_1", coverImageId: "b" });

    expect(fakeDb.propertyImage.updateMany).toHaveBeenCalledWith({
      where: { propertyId: "prop_1", isCover: true },
      data: { isCover: false },
    });
    expect(fakeDb.propertyImage.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { isCover: true },
    });
    expect(
      fakeDb.propertyImage.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(fakeDb.propertyImage.update.mock.invocationCallOrder[0]!);
  });

  it("answers NOT_FOUND for a cover that isn't a photo of the listing", async () => {
    await expect(
      makeCaller().update({ propertyId: "prop_1", coverImageId: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fakeDb.propertyImage.updateMany).not.toHaveBeenCalled();
  });

  it("needs the order, the cover or both", async () => {
    await expect(
      makeCaller().update({ propertyId: "prop_1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("property.photos.delete", () => {
  const image = {
    id: "b",
    url: KEY,
    thumbnailUrl: THUMB,
    isCover: true,
    propertyId: "prop_1",
  };

  it("deletes the photo, closes the gap, moves the cover and then deletes the files", async () => {
    fakeDb.propertyImage.findUnique.mockResolvedValue(image);
    fakeDb.propertyImage.findMany
      .mockResolvedValueOnce([
        { id: "a", position: 0 },
        { id: "c", position: 2 },
      ])
      .mockResolvedValueOnce([]);

    await makeCaller().delete({ imageId: "b" });

    expect(fakeDb.propertyImage.delete).toHaveBeenCalledWith({
      where: { id: "b" },
    });
    expect(
      fakeDb.propertyImage.update.mock.calls.map(([args]) => args as unknown),
    ).toEqual([
      { where: { id: "a" }, data: { position: 0 } },
      { where: { id: "c" }, data: { position: 1 } },
      { where: { id: "a" }, data: { isCover: true } },
    ]);
    expect(storage.remove).toHaveBeenCalledWith([KEY, THUMB]);
    expect(storage.remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      fakeDb.propertyImage.delete.mock.invocationCallOrder[0]!,
    );
  });

  it("leaves positions alone when the last photo is deleted", async () => {
    fakeDb.propertyImage.findUnique.mockResolvedValue({
      ...image,
      isCover: false,
    });
    fakeDb.propertyImage.findMany
      .mockResolvedValueOnce([
        { id: "a", position: 0 },
        { id: "c", position: 1 },
      ])
      .mockResolvedValueOnce([]);

    await makeCaller().delete({ imageId: "b" });

    expect(fakeDb.propertyImage.updateMany).not.toHaveBeenCalled();
    expect(fakeDb.propertyImage.update).not.toHaveBeenCalled();
  });

  it("doesn't try to delete seed photos, which are external URLs", async () => {
    fakeDb.propertyImage.findUnique.mockResolvedValue({
      ...image,
      url: "https://picsum.photos/seed/x/1200/800",
      thumbnailUrl: "https://picsum.photos/seed/x/480/320",
    });

    await makeCaller().delete({ imageId: "b" });

    expect(storage.remove).toHaveBeenCalledWith([]);
  });

  it("still answers when the files can't be deleted", async () => {
    fakeDb.propertyImage.findUnique.mockResolvedValue(image);
    storage.remove.mockRejectedValue(new Error("storage down"));

    await expect(makeCaller().delete({ imageId: "b" })).resolves.toEqual([]);
  });

  it("answers NOT_FOUND for a missing photo and FORBIDDEN for someone else's", async () => {
    fakeDb.propertyImage.findUnique.mockResolvedValueOnce(null);
    await expect(makeCaller().delete({ imageId: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    fakeDb.propertyImage.findUnique.mockResolvedValueOnce(image);
    await expect(
      makeCaller(session("user_2")).delete({ imageId: "b" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fakeDb.propertyImage.delete).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
