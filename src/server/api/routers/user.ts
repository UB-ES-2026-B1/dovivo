import { type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

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
});
