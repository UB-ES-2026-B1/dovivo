import { TRPCError } from "@trpc/server";

import { signUpSchema } from "~/lib/validators/auth";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { registerUser } from "~/server/services/auth";
import { signUpRateLimiter } from "~/server/services/rate-limit";

/**
 * Email + password accounts. Signing in is not here: the frontend calls Auth.js
 * `signIn("credentials", ...)`, which runs `authorize` in `src/server/auth/config.ts`.
 */
export const authRouter = createTRPCRouter({
  /** Creates the account; the client then calls `signIn("credentials")` to start the session. */
  signUp: publicProcedure
    .input(signUpSchema)
    .mutation(async ({ ctx, input }) => {
      // Unknown IPs skip this limit instead of sharing one bucket (which anyone could exhaust).
      if (
        ctx.clientIp !== null &&
        !signUpRateLimiter.check(ctx.clientIp).allowed
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many sign-up attempts. Please try again later.",
        });
      }

      return registerUser(ctx.db, input);
    }),
});
