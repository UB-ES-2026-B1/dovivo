import { type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createPropertySchema,
  propertyFiltersSchema,
} from "~/lib/validators/property";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { listPropertyCards } from "~/server/services/property-list";

/**
 * Public image fields. Upload metadata (`mimeType`, `sizeBytes`) is internal and never sent to
 * clients.
 */
const publicImageSelect = {
  id: true,
  url: true,
  thumbnailUrl: true,
  alt: true,
  position: true,
  isCover: true,
  width: true,
  height: true,
} satisfies Prisma.PropertyImageSelect;

/** Gallery order. `position` is unique per listing, so the order is deterministic. */
const galleryOrderBy = {
  position: "asc",
} satisfies Prisma.PropertyImageOrderByWithRelationInput;

export const propertyRouter = createTRPCRouter({
  /**
   * Public search used by the /buy and /rent pages (US-09): published listings as cards (see
   * `propertyCardSelect`), newest first, cursor-based pagination.
   */
  list: publicProcedure
    .input(propertyFiltersSchema)
    .query(({ ctx, input }) => listPropertyCards(ctx.db, input)),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.property.findUnique({
        where: { id: input.id },
        include: {
          images: { select: publicImageSelect, orderBy: galleryOrderBy },
          owner: { select: { id: true, name: true, image: true } },
        },
      });

      // Soft-deleted listings are hidden from everyone, including the owner.
      if (!property || property.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const isOwner = property.ownerId === ctx.session?.user.id;
      if (property.status === "DRAFT" && !isOwner) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return property;
    }),

  /** Listings owned by the logged-in user (dashboard). */
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.property.findMany({
      where: { ownerId: ctx.session.user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    }),
  ),

  /** Publish flow: creates a DRAFT owned by the current user. */
  create: protectedProcedure
    .input(createPropertySchema)
    .mutation(({ ctx, input }) =>
      ctx.db.property.create({
        data: { ...input, ownerId: ctx.session.user.id },
      }),
    ),

  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check and update in a single statement so two concurrent calls can't both publish, and a
      // RESERVED/CLOSED listing never goes back to PUBLISHED with a fresh publishedAt.
      const { count } = await ctx.db.property.updateMany({
        where: {
          id: input.id,
          ownerId: ctx.session.user.id,
          deletedAt: null,
          status: "DRAFT",
        },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });

      if (count === 0) {
        // Nothing was updated: work out why, only to return the right error.
        const property = await ctx.db.property.findUnique({
          where: { id: input.id },
          select: { ownerId: true, deletedAt: true },
        });
        if (!property || property.deletedAt) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        if (property.ownerId !== ctx.session.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only draft listings can be published.",
        });
      }

      return ctx.db.property.findUniqueOrThrow({ where: { id: input.id } });
    }),
});
