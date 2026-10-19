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

/** The cover photo first; falls back to the first gallery photo if none is marked as cover. */
const coverFirstOrderBy = [
  { isCover: "desc" },
  { position: "asc" },
] satisfies Prisma.PropertyImageOrderByWithRelationInput[];

export const propertyRouter = createTRPCRouter({
  /** Public search used by the /buy and /rent pages. Cursor-based pagination. */
  list: publicProcedure
    .input(propertyFiltersSchema)
    .query(async ({ ctx, input }) => {
      const { limit, cursor, minPriceCents, maxPriceCents, ...filters } = input;

      const items = await ctx.db.property.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          listingType: filters.listingType,
          propertyType: filters.propertyType,
          // `city` is citext, so a plain equals is case-insensitive and uses the index.
          city: filters.city,
          bedrooms: filters.minBedrooms
            ? { gte: filters.minBedrooms }
            : undefined,
          priceCents: { gte: minPriceCents, lte: maxPriceCents },
        },
        include: {
          // Only the cover is needed for the listing card.
          images: {
            select: publicImageSelect,
            orderBy: coverFirstOrderBy,
            take: 1,
          },
        },
        // `id` tie-breaker keeps cursor pagination stable when publishedAt is equal.
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      const nextCursor = items.length > limit ? items.pop()?.id : undefined;
      return { items, nextCursor };
    }),

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
