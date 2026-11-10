import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { updateProfileSchema } from "~/lib/validators/user";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Profile fields the user can see about themselves. Internal fields (`passwordHash`, `blockedAt`,
 * `role`) are never selected, so they can't leak even if the response is logged or cached.
 */
const profileSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  phone: true,
  image: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const userRouter = createTRPCRouter({
  /**
   * The signed-in user's own profile (US-04). The id comes from the session, never from the
   * input, so nobody can read another user's profile.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: profileSelect,
    });

    // The account was deleted after the session was checked: treat it as signed out.
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return user;
  }),

  /**
   * Edits the signed-in user's own name and phone (US-05) and returns the updated profile, with
   * the same fields as `me`. Invalid input is rejected by zod before any query, so nothing is
   * saved unless every field is valid.
   */
  updateMe: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.user.update({
          where: { id: ctx.session.user.id },
          // Listed one by one so a field added to the schema is never written by accident.
          data: { name: input.name, phone: input.phone },
          select: profileSelect,
        });
      } catch (error) {
        // P2025: no row to update. Same case as in `me`: the account was deleted mid-session.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        throw error;
      }
    }),
});
