import { startConversationSchema } from "~/lib/validators/conversation";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { startConversation } from "~/server/services/conversations";
import { getAppUrl, getEmailSender } from "~/server/services/email";
import { messageRateLimiter } from "~/server/services/rate-limit";

/**
 * Chat between an interested user and a listing's advertiser (contract §7, ADR 0003). US-21:
 * `start`. US-22 will add `list`, `messages`, `reply` and `markRead`.
 */
export const conversationRouter = createTRPCRouter({
  /**
   * Sends a message to the listing's advertiser and emails them. Creates the conversation if it
   * doesn't exist. `NOT_FOUND` if the user can't open the listing, `FORBIDDEN` for their own.
   */
  start: protectedProcedure
    .input(startConversationSchema)
    .mutation(({ ctx, input }) =>
      startConversation(
        ctx.db,
        { id: ctx.session.user.id, name: ctx.session.user.name ?? null },
        input,
        {
          email: getEmailSender(),
          appUrl: getAppUrl(),
          rateLimiter: messageRateLimiter,
        },
      ),
    ),
});
