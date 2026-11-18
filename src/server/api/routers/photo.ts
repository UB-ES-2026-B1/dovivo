import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import {
  confirmPhotoSchema,
  createPhotoUploadSchema,
  deletePhotoSchema,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PROPERTY,
  updatePhotosSchema,
} from "~/lib/validators/photo";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { type AppPrismaClient } from "~/server/db-omit";
import {
  displayKeyFor,
  isPhotoKeyOf,
  isStorageKey,
  newPhotoKey,
  thumbnailKeyFor,
} from "~/server/services/photo-keys";
import {
  InvalidPhotoError,
  processPhoto,
} from "~/server/services/photo-processing";
import {
  getPhotoStorage,
  type PhotoStorage,
} from "~/server/services/photo-storage";
import { withPhotoUrls } from "~/server/services/property-card";
import {
  galleryOrderBy,
  publicImageSelect,
} from "~/server/services/property-detail";

/**
 * Listing photos (US-18): `property.photos.*`. Upload is two calls, as in contract §7:
 * 1. `createUpload` checks the owner, the type, the size and the 15-photo limit and returns a
 *    signed URL; the browser `PUT`s the file straight to the storage.
 * 2. `confirm` checks the uploaded file, saves a re-encoded copy and a thumbnail under their own
 *    keys, creates the `PropertyImage` and deletes the upload.
 * `update` reorders the gallery or changes the cover, and `delete` removes a photo and its files.
 * Only the owner of a listing that isn't deleted can do any of this.
 *
 * Invariants kept here (contract §3): positions are 0..n-1 without gaps, and a listing with photos
 * has exactly one cover (the partial unique index only guarantees "at most one"). The transactions
 * that read and write positions or the cover lock the listing's row first (`lockProperty`), so
 * changes to the photos of one listing run one after another and never collide.
 */

// Narrow views of the client, so the helpers accept both `ctx.db` and a transaction.
type ImageDelegate = AppPrismaClient["propertyImage"];
type OwnerDb = { property: Pick<AppPrismaClient["property"], "findUnique"> };
type GalleryDb = { propertyImage: Pick<ImageDelegate, "findMany"> };
type PositionsDb = {
  propertyImage: Pick<ImageDelegate, "updateMany" | "update">;
};
type LockDb = Pick<Prisma.TransactionClient, "$queryRaw">;

function requireStorage(): PhotoStorage {
  const storage = getPhotoStorage();
  if (!storage) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Photo storage is not configured.",
    });
  }
  return storage;
}

/** NOT_FOUND if the listing is missing or deleted, FORBIDDEN if it belongs to someone else. */
async function assertOwnsProperty(
  db: OwnerDb,
  propertyId: string,
  userId: string,
) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { ownerId: true, deletedAt: true },
  });
  if (!property || property.deletedAt) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (property.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

/**
 * Locks the listing's row until the transaction ends. Two uploads confirmed at once (e.g. several
 * files chosen together) would otherwise read the same count and both take the same position, or
 * both become the cover; two deletes would each renumber a photo the other just removed.
 */
async function lockProperty(tx: LockDb, propertyId: string) {
  await tx.$queryRaw`SELECT 1 FROM "Property" WHERE "id" = ${propertyId} FOR UPDATE`;
}

function tooManyPhotos() {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: `A listing can have at most ${MAX_PHOTOS_PER_PROPERTY} photos.`,
  });
}

/** The gallery as `property.byId` returns it, with public URLs. */
async function gallery(db: GalleryDb, propertyId: string) {
  const images = await db.propertyImage.findMany({
    where: { propertyId },
    select: publicImageSelect,
    orderBy: galleryOrderBy,
  });
  return images.map((image) => withPhotoUrls(image));
}

/**
 * Writes positions 0..n-1 in the given order. `(propertyId, position)` is unique and not
 * deferrable, so swapping two positions directly would fail: first every photo of the listing is
 * moved out of the way to negative positions in one statement, then each gets its final one.
 */
async function writePositions(
  db: PositionsDb,
  propertyId: string,
  orderedIds: string[],
) {
  await db.propertyImage.updateMany({
    where: { propertyId },
    data: { position: { decrement: MAX_PHOTOS_PER_PROPERTY + 1000 } },
  });
  for (const [position, id] of orderedIds.entries()) {
    await db.propertyImage.update({ where: { id }, data: { position } });
  }
}

/** Deletes files without failing the request: an orphan file is better than a lost answer. */
async function removeFiles(storage: PhotoStorage, keys: (string | null)[]) {
  const storageKeys = keys.filter(
    (key): key is string => key !== null && isStorageKey(key),
  );
  try {
    await storage.remove(storageKeys);
  } catch (error) {
    console.error("[photos] could not delete files", storageKeys, error);
  }
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export const photoRouter = createTRPCRouter({
  /** Step 1: signed URL to upload one JPG/PNG of at most 5 MB. */
  createUpload: protectedProcedure
    .input(createPhotoUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const storage = requireStorage();
      await assertOwnsProperty(ctx.db, input.propertyId, ctx.session.user.id);

      // Checked again on confirm (another tab may upload meanwhile), but failing here saves the
      // user an upload that would be refused.
      const count = await ctx.db.propertyImage.count({
        where: { propertyId: input.propertyId },
      });
      if (count >= MAX_PHOTOS_PER_PROPERTY) throw tooManyPhotos();

      const key = newPhotoKey(input.propertyId, input.mimeType);
      const { url, expiresAt } = await storage.createUploadUrl({
        key,
        contentType: input.mimeType,
        contentLength: input.sizeBytes,
      });
      return {
        key,
        uploadUrl: url,
        /** Send these headers with the `PUT`: they are part of the signature. */
        headers: { "Content-Type": input.mimeType },
        expiresAt,
      };
    }),

  /**
   * Step 2: registers the uploaded file. Uploads can be confirmed in parallel (they are serialised
   * per listing), and calling it twice with the same key returns the same photo.
   */
  confirm: protectedProcedure
    .input(confirmPhotoSchema)
    .mutation(async ({ ctx, input }) => {
      const storage = requireStorage();
      const { propertyId, key } = input;
      await assertOwnsProperty(ctx.db, propertyId, ctx.session.user.id);

      if (!isPhotoKeyOf(propertyId, key)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown upload. Ask for a new upload URL.",
        });
      }
      const displayKey = displayKeyFor(key);
      const thumbnailKey = thumbnailKeyFor(key);
      const findRegistered = () =>
        ctx.db.propertyImage.findFirst({
          where: { propertyId, url: displayKey },
          select: publicImageSelect,
        });

      // Already confirmed (e.g. the first answer was lost): return the photo again.
      const existing = await findRegistered();
      if (existing) return withPhotoUrls(existing);

      const sizeBytes = await storage.sizeOf(key);
      if (sizeBytes === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The photo hasn't been uploaded yet.",
        });
      }
      /** A file that can never be accepted: discard everything of this upload. */
      const refuse = async (error: TRPCError): Promise<never> => {
        await removeFiles(storage, [key, displayKey, thumbnailKey]);
        throw error;
      };
      if (sizeBytes > MAX_PHOTO_BYTES) {
        return refuse(
          new TRPCError({
            code: "BAD_REQUEST",
            message: "Each photo can be at most 5 MB.",
          }),
        );
      }

      let processed;
      try {
        processed = await processPhoto(await storage.download(key));
      } catch (error) {
        if (error instanceof InvalidPhotoError) {
          return refuse(
            new TRPCError({ code: "BAD_REQUEST", message: error.message }),
          );
        }
        throw error;
      }

      // Published under their own keys: the signed upload URL can only ever write `key`.
      await storage.upload(displayKey, processed.display, processed.mimeType);
      await storage.upload(thumbnailKey, processed.thumbnail, "image/webp");

      let image;
      try {
        image = await ctx.db.$transaction(async (tx) => {
          await lockProperty(tx, propertyId);

          // Inside the lock: confirmed by a parallel call with the same key while we processed.
          const registered = await tx.propertyImage.findFirst({
            where: { propertyId, url: displayKey },
            select: publicImageSelect,
          });
          if (registered) return registered;

          const count = await tx.propertyImage.count({ where: { propertyId } });
          if (count >= MAX_PHOTOS_PER_PROPERTY) throw tooManyPhotos();
          const hasCover =
            count > 0 &&
            (await tx.propertyImage.count({
              where: { propertyId, isCover: true },
            })) > 0;

          return tx.propertyImage.create({
            data: {
              propertyId,
              url: displayKey,
              thumbnailUrl: thumbnailKey,
              alt: input.alt ?? null,
              mimeType: processed.mimeType,
              sizeBytes,
              width: processed.width,
              height: processed.height,
              // Positions have no gaps and the listing is locked, so the next one is the count.
              position: count,
              // The first photo becomes the cover.
              isCover: !hasCover,
            },
            select: publicImageSelect,
          });
        });
      } catch (error) {
        if (error instanceof TRPCError) return refuse(error);

        // Not expected with the lock, but if it happens the upload is kept so `confirm` can be
        // called again; only the generated files go (they are made again on the next try).
        await removeFiles(storage, [displayKey, thumbnailKey]);
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "The photo couldn't be saved. Try again.",
          });
        }
        throw error;
      }

      // The browser's file isn't needed any more (and may still carry EXIF data).
      await removeFiles(storage, [key]);
      return withPhotoUrls(image);
    }),

  /** Reorders the gallery and/or changes the cover. Returns the whole gallery. */
  update: protectedProcedure
    .input(updatePhotosSchema)
    .mutation(async ({ ctx, input }) => {
      const { propertyId, order, coverImageId } = input;
      await assertOwnsProperty(ctx.db, propertyId, ctx.session.user.id);

      return ctx.db.$transaction(async (tx) => {
        await lockProperty(tx, propertyId);
        const images = await tx.propertyImage.findMany({
          where: { propertyId },
          select: { id: true },
        });
        const ids = new Set(images.map((image) => image.id));

        if (order) {
          if (order.length !== ids.size || !order.every((id) => ids.has(id))) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "The order must list every photo of the listing once.",
            });
          }
          await writePositions(tx, propertyId, order);
        }

        if (coverImageId) {
          if (!ids.has(coverImageId)) {
            throw new TRPCError({ code: "NOT_FOUND" });
          }
          // Unmark the old cover first: the partial unique index allows only one at a time.
          await tx.propertyImage.updateMany({
            where: { propertyId, isCover: true },
            data: { isCover: false },
          });
          await tx.propertyImage.update({
            where: { id: coverImageId },
            data: { isCover: true },
          });
        }

        return gallery(tx, propertyId);
      });
    }),

  /** Deletes a photo and its files. Returns the remaining gallery. */
  delete: protectedProcedure
    .input(deletePhotoSchema)
    .mutation(async ({ ctx, input }) => {
      const storage = requireStorage();
      const image = await ctx.db.propertyImage.findUnique({
        where: { id: input.imageId },
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          isCover: true,
          propertyId: true,
        },
      });
      if (!image) throw new TRPCError({ code: "NOT_FOUND" });
      await assertOwnsProperty(ctx.db, image.propertyId, ctx.session.user.id);

      const remaining = await ctx.db.$transaction(async (tx) => {
        await lockProperty(tx, image.propertyId);

        // Already deleted by a parallel call while we waited for the lock.
        const { count } = await tx.propertyImage.deleteMany({
          where: { id: image.id },
        });
        if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });

        const rest = await tx.propertyImage.findMany({
          where: { propertyId: image.propertyId },
          select: { id: true, position: true },
          orderBy: galleryOrderBy,
        });
        // Close the gap left by the deleted photo.
        if (rest.some((photo, index) => photo.position !== index)) {
          await writePositions(
            tx,
            image.propertyId,
            rest.map((photo) => photo.id),
          );
        }
        // A listing with photos always has a cover: the first one takes over.
        if (image.isCover && rest[0]) {
          await tx.propertyImage.update({
            where: { id: rest[0].id },
            data: { isCover: true },
          });
        }
        return gallery(tx, image.propertyId);
      });

      // After the commit: if the transaction failed, the files are still needed.
      await removeFiles(storage, [image.url, image.thumbnailUrl]);
      return remaining;
    }),
});
