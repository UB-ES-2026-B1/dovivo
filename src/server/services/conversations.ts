import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { type StartConversationParams } from "~/lib/validators/conversation";
import { type AppPrismaClient } from "~/server/db-omit";
import { type EmailSender } from "~/server/services/email";
import {
  listingUrl,
  newMessageEmail,
} from "~/server/services/new-message-email";
import {
  canViewPropertyDetail,
  publicOwnerSelect,
} from "~/server/services/property-detail";
import { type RateLimiter } from "~/server/services/rate-limit";

/**
 * Messages to a listing's advertiser (US-21, ADR 0003). One `Conversation` per listing and
 * interested user (`@@unique([propertyId, interestedUserId])`): the first message creates it and
 * the next ones are added to it. Pure functions: the database and the email sender are passed in,
 * so the router and the unit tests (with fakes) run the same code.
 */

type TransactionDb = {
  conversation: Pick<AppPrismaClient["conversation"], "upsert">;
  message: Pick<AppPrismaClient["message"], "create">;
};

/** The slice of Prisma these functions use; tests pass a fake implementing only this. */
export type ConversationsDb = {
  property: Pick<AppPrismaClient["property"], "findUnique">;
  $transaction<T>(run: (tx: TransactionDb) => Promise<T>): Promise<T>;
};

export type StartConversationDeps = {
  /** `null` when SMTP isn't configured: the message is saved, the email only logged. */
  email: EmailSender | null;
  /** Public URL of the app, without a trailing slash, for the link in the email. */
  appUrl: string;
  rateLimiter: Pick<RateLimiter, "check" | "refund">;
};

export type StartConversationResult = {
  conversationId: string;
  message: { id: string; body: string; createdAt: Date };
};

/**
 * Sends a message to the advertiser of a listing (`conversation.start`):
 * 1. `NOT_FOUND` if the user couldn't open the listing (missing, deleted, someone else's draft),
 *    as `property.byId`; `FORBIDDEN` if it is their own listing (US-21).
 * 2. `TOO_MANY_REQUESTS` past the user's message limit (checked after 1, so refused requests
 *    don't use it up).
 * 3. In one transaction: creates the conversation if it doesn't exist, adds the message and
 *    updates `lastMessageAt`.
 * 4. Emails the advertiser. A failed email never undoes the message (ADR 0003): it is logged.
 */
export async function startConversation(
  db: ConversationsDb,
  sender: { id: string; name: string | null },
  { propertyId, body }: StartConversationParams,
  { email, appUrl, rateLimiter }: StartConversationDeps,
): Promise<StartConversationResult> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      title: true,
      status: true,
      deletedAt: true,
      owner: { select: { ...publicOwnerSelect, email: true } },
    },
  });
  if (!property || !canViewPropertyDetail(property, sender.id)) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  const advertiser = property.owner;
  if (advertiser.id === sender.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can't send a message about your own listing.",
    });
  }

  if (!rateLimiter.check(sender.id).allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many messages. Please try again later.",
    });
  }

  const sentAt = new Date();
  let result: StartConversationResult;
  try {
    result = await db.$transaction(async (tx) => {
      // Only the unique key, plain columns and a scalar select: Prisma runs it as a native
      // `INSERT ... ON CONFLICT`, so two first messages sent at once share one conversation.
      const conversation = await tx.conversation.upsert({
        where: {
          propertyId_interestedUserId: {
            propertyId,
            interestedUserId: sender.id,
          },
        },
        create: {
          propertyId,
          interestedUserId: sender.id,
          // Must be the listing's owner: the composite foreign key to Property(id, ownerId)
          // rejects anything else.
          advertiserId: advertiser.id,
          lastMessageAt: sentAt,
        },
        update: { lastMessageAt: sentAt },
        select: { id: true },
      });
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: sender.id,
          body,
          createdAt: sentAt,
        },
        select: { id: true, body: true, createdAt: true },
      });
      return { conversationId: conversation.id, message };
    });
  } catch (error) {
    // Nothing was sent: the attempt doesn't count towards the limit.
    rateLimiter.refund(sender.id);
    // The listing was hard-deleted, or changed owner, between the check and the insert.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    throw error;
  }

  await emailAdvertiser(email, {
    conversationId: result.conversationId,
    to: advertiser.email,
    content: {
      advertiserName: advertiser.name,
      senderName: sender.name,
      listingTitle: property.title,
      listingUrl: listingUrl(appUrl, property.id),
      body,
    },
  });
  return result;
}

/** Never throws: the message is already saved, and the advertiser can still see it in dovivo. */
async function emailAdvertiser(
  email: EmailSender | null,
  {
    conversationId,
    to,
    content,
  }: {
    conversationId: string;
    to: string | null;
    content: Parameters<typeof newMessageEmail>[1];
  },
) {
  // Logs name the conversation, never the email address.
  if (!email) {
    console.warn(
      `[conversation.start] SMTP not configured: no email for conversation ${conversationId}`,
    );
    return;
  }
  if (!to) {
    console.warn(
      `[conversation.start] the advertiser has no email: no email for conversation ${conversationId}`,
    );
    return;
  }
  try {
    await email.send(newMessageEmail(to, content));
  } catch (error) {
    console.error(
      `[conversation.start] could not email the advertiser of conversation ${conversationId}`,
      error,
    );
  }
}
