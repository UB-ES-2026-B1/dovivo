import { TRPCError } from "@trpc/server";

import {
  createPropertySchema,
  propertyFiltersSchema,
  propertyIdSchema,
} from "~/lib/validators/property";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  canViewPropertyDetail,
  propertyDetailSelect,
  toPropertyDetail,
} from "~/server/services/property-detail";
import { listPropertyCards } from "~/server/services/property-list";

export const propertyRouter = createTRPCRouter({
  /**
   * Public search used by the /buy and /rent pages (US-09): published listings as cards (see
   * `propertyCardSelect`), newest first, cursor-based pagination.
   */
  list: publicProcedure
    .input(propertyFiltersSchema)
    .query(({ ctx, input }) => listPropertyCards(ctx.db, input)),

  /**
   * Public listing detail (US-12): every public field, the gallery ordered by `position` and the
   * advertiser's name and avatar (never their contact data). `NOT_FOUND` when the listing is
   * missing, soft-deleted (also for its owner) or someone else's draft.
   */
  byId: publicProcedure
    .input(propertyIdSchema)
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.property.findUnique({
        where: { id: input.id },
        select: propertyDetailSelect,
      });

      if (!property || !canViewPropertyDetail(property, ctx.session?.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return toPropertyDetail(property);
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
    .input(propertyIdSchema)
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
