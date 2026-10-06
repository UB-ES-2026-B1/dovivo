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

export const propertyRouter = createTRPCRouter({
  /** Public search used by the /buy and /rent pages. Cursor-based pagination. */
  list: publicProcedure
    .input(propertyFiltersSchema)
    .query(async ({ ctx, input }) => {
      const { limit, cursor, minPriceCents, maxPriceCents, ...filters } = input;

      const items = await ctx.db.property.findMany({
        where: {
          status: "PUBLISHED",
          listingType: filters.listingType,
          propertyType: filters.propertyType,
          city: filters.city
            ? { equals: filters.city, mode: "insensitive" }
            : undefined,
          bedrooms: filters.minBedrooms
            ? { gte: filters.minBedrooms }
            : undefined,
          priceCents: { gte: minPriceCents, lte: maxPriceCents },
        },
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
        orderBy: { publishedAt: "desc" },
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
          images: { orderBy: { position: "asc" } },
          owner: { select: { id: true, name: true, image: true } },
        },
      });

      const isOwner = property?.ownerId === ctx.session?.user.id;
      if (!property || (property.status === "DRAFT" && !isOwner)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return property;
    }),

  /** Listings owned by the logged-in user (dashboard). */
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.property.findMany({
      where: { ownerId: ctx.session.user.id },
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
      const property = await ctx.db.property.findUnique({
        where: { id: input.id },
        select: { ownerId: true },
      });
      if (!property) throw new TRPCError({ code: "NOT_FOUND" });
      if (property.ownerId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.property.update({
        where: { id: input.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
    }),
});
