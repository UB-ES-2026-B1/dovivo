import {
  favouriteListSchema,
  favouritePropertySchema,
} from "~/lib/validators/favourite";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  addFavourite,
  listFavouriteIds,
  listFavourites,
  removeFavourite,
} from "~/server/services/favourites";

/**
 * Favourites (US-14), contract §7: `favourite.add`, `favourite.remove` and `favourite.list`, plus
 * `favourite.ids` for the hearts. Signed-in users only, and always the session's user: no input
 * names whose favourites they are, so nobody can read or change someone else's.
 */
export const favouriteRouter = createTRPCRouter({
  /** Saves a listing (idempotent). `NOT_FOUND` if the user couldn't open it. */
  add: protectedProcedure
    .input(favouritePropertySchema)
    .mutation(({ ctx, input }) =>
      addFavourite(ctx.db, ctx.session.user.id, input.propertyId),
    ),

  /** Removes a listing from the favourites (idempotent, whatever the listing's state). */
  remove: protectedProcedure
    .input(favouritePropertySchema)
    .mutation(({ ctx, input }) =>
      removeFavourite(ctx.db, ctx.session.user.id, input.propertyId),
    ),

  /** The favourites page: cards with `availability`, newest saved first, cursor pagination. */
  list: protectedProcedure
    .input(favouriteListSchema)
    .query(({ ctx, input }) =>
      listFavourites(ctx.db, ctx.session.user.id, input),
    ),

  /** Ids of every saved listing, to fill the hearts. */
  ids: protectedProcedure.query(({ ctx }) =>
    listFavouriteIds(ctx.db, ctx.session.user.id),
  ),
});
