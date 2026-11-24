import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type EmailSender } from "~/server/services/email";

import { type ConversationsDb, startConversation } from "./conversations";

/**
 * Unit tests for `conversation.start` (US-21). Prisma, the email sender and the rate limiter are
 * fakes: we assert on the queries the service builds, on the email and on the errors.
 */

const tx = {
  conversation: { upsert: vi.fn() },
  message: { create: vi.fn() },
};
const fakeDb = {
  property: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};
// Cast through `unknown` because Prisma's delegate methods are heavily generic.
const db = fakeDb as unknown as ConversationsDb;

const email = { send: vi.fn<EmailSender["send"]>() };
const rateLimiter = { check: vi.fn(), refund: vi.fn() };
const deps = () => ({ email, appUrl: "https://dovivo.test", rateLimiter });

const SENDER = { id: "user_1", name: "Joan" };
const input = { propertyId: "prop_1", body: "Is it still available?" };

const listing = (
  override: Partial<{
    status: string;
    deletedAt: Date | null;
    owner: {
      id: string;
      name: string | null;
      image: null;
      email: string | null;
    };
  }> = {},
) => ({
  id: "prop_1",
  title: "Pis a Gràcia",
  status: "PUBLISHED",
  deletedAt: null,
  owner: {
    id: "owner_1",
    name: "Marta",
    image: null,
    email: "marta@example.com",
  },
  ...override,
});

const start = () => startConversation(db, SENDER, input, deps());

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fakeDb.property.findUnique.mockResolvedValue(listing());
  fakeDb.$transaction.mockImplementation((run: (t: typeof tx) => unknown) =>
    run(tx),
  );
  tx.conversation.upsert.mockResolvedValue({ id: "conv_1" });
  tx.message.create.mockImplementation(
    ({ data }: { data: { body: string; createdAt: Date } }) =>
      Promise.resolve({
        id: "msg_1",
        body: data.body,
        createdAt: data.createdAt,
      }),
  );
  email.send.mockResolvedValue(undefined);
  rateLimiter.check.mockReturnValue({ allowed: true, retryAfterMs: 0 });
});

describe("startConversation: access", () => {
  it.each([
    ["missing", null],
    ["deleted", listing({ deletedAt: new Date() })],
    ["someone else's draft", listing({ status: "DRAFT" })],
  ])(
    "NOT_FOUND for a %s listing, without writing or emailing",
    async (_case, row) => {
      fakeDb.property.findUnique.mockResolvedValue(row);

      await expect(start()).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(fakeDb.$transaction).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
      expect(rateLimiter.check).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["published", listing({ owner: { ...listing().owner, id: SENDER.id } })],
    [
      "draft",
      listing({
        status: "DRAFT",
        owner: { ...listing().owner, id: SENDER.id },
      }),
    ],
  ])("FORBIDDEN for the user's own %s listing (US-21)", async (_case, row) => {
    fakeDb.property.findUnique.mockResolvedValue(row);

    await expect(start()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You can't send a message about your own listing.",
    });
    expect(fakeDb.$transaction).not.toHaveBeenCalled();
    expect(rateLimiter.check).not.toHaveBeenCalled();
  });

  it.each(["RESERVED", "CLOSED"])(
    "accepts a %s listing (its detail page still opens)",
    async (status) => {
      fakeDb.property.findUnique.mockResolvedValue(listing({ status }));

      await expect(start()).resolves.toMatchObject({
        conversationId: "conv_1",
      });
    },
  );
});

describe("startConversation: saving the message", () => {
  it("creates or reuses the user's conversation about the listing and adds the message", async () => {
    const result = await start();

    const [upsert] = tx.conversation.upsert.mock.calls[0] as [
      {
        where: unknown;
        create: { lastMessageAt: Date };
        update: { lastMessageAt: Date };
      },
    ];
    expect(upsert).toMatchObject({
      where: {
        propertyId_interestedUserId: {
          propertyId: "prop_1",
          interestedUserId: SENDER.id,
        },
      },
      create: {
        propertyId: "prop_1",
        interestedUserId: SENDER.id,
        advertiserId: "owner_1",
      },
      select: { id: true },
    });
    const sentAt = upsert.create.lastMessageAt;
    expect(sentAt).toBeInstanceOf(Date);
    expect(upsert.update).toEqual({ lastMessageAt: sentAt });

    expect(tx.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: "conv_1",
        senderId: SENDER.id,
        body: "Is it still available?",
        createdAt: sentAt,
      },
      select: { id: true, body: true, createdAt: true },
    });
    expect(result).toEqual({
      conversationId: "conv_1",
      message: {
        id: "msg_1",
        body: "Is it still available?",
        createdAt: sentAt,
      },
    });
  });

  it("writes the conversation and the message in one transaction", async () => {
    await start();

    expect(fakeDb.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.conversation.upsert).toHaveBeenCalledTimes(1);
    expect(tx.message.create).toHaveBeenCalledTimes(1);
  });

  it("NOT_FOUND if the listing is hard-deleted between the check and the insert", async () => {
    fakeDb.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint", {
        code: "P2003",
        clientVersion: "6",
      }),
    );

    await expect(start()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(email.send).not.toHaveBeenCalled();
  });

  it("lets other database errors through, without emailing", async () => {
    const error = new Error("connection lost");
    fakeDb.$transaction.mockRejectedValue(error);

    await expect(start()).rejects.toBe(error);
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe("startConversation: rate limit", () => {
  it("TOO_MANY_REQUESTS past the user's limit, without writing or emailing", async () => {
    rateLimiter.check.mockReturnValue({ allowed: false, retryAfterMs: 1000 });

    await expect(start()).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Too many messages. Please try again later.",
    });
    expect(rateLimiter.check).toHaveBeenCalledWith(SENDER.id);
    expect(fakeDb.$transaction).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it("counts a message that was saved", async () => {
    await start();

    expect(rateLimiter.check).toHaveBeenCalledTimes(1);
    expect(rateLimiter.refund).not.toHaveBeenCalled();
  });

  it("hands the attempt back if the message couldn't be saved", async () => {
    fakeDb.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(start()).rejects.toThrow();
    expect(rateLimiter.refund).toHaveBeenCalledWith(SENDER.id);
  });
});

describe("startConversation: email to the advertiser", () => {
  it("emails the advertiser the message and the link to the listing (US-21.B2)", async () => {
    await start();

    expect(email.send).toHaveBeenCalledTimes(1);
    const [sent] = email.send.mock.calls[0]!;
    expect(sent.to).toBe("marta@example.com");
    expect(sent.subject).toBe('New message about "Pis a Gràcia"');
    expect(sent.text).toContain("Is it still available?");
    expect(sent.text).toContain("Joan sent you a message");
    expect(sent.text).toContain("https://dovivo.test/properties/prop_1");
  });

  it("emails after the message is saved", async () => {
    await start();

    expect(tx.message.create.mock.invocationCallOrder[0]).toBeLessThan(
      email.send.mock.invocationCallOrder[0]!,
    );
  });

  it("keeps the message if the email fails (ADR 0003)", async () => {
    email.send.mockRejectedValue(new Error("SMTP down"));

    await expect(start()).resolves.toMatchObject({ conversationId: "conv_1" });
    expect(console.error).toHaveBeenCalled();
    expect(rateLimiter.refund).not.toHaveBeenCalled();
  });

  it("saves the message without emailing when SMTP isn't configured", async () => {
    await expect(
      startConversation(db, SENDER, input, { ...deps(), email: null }),
    ).resolves.toMatchObject({ conversationId: "conv_1" });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("SMTP not configured"),
    );
  });

  it("saves the message without emailing when the advertiser has no email", async () => {
    fakeDb.property.findUnique.mockResolvedValue(
      listing({ owner: { ...listing().owner, email: null } }),
    );

    await expect(start()).resolves.toMatchObject({ conversationId: "conv_1" });
    expect(email.send).not.toHaveBeenCalled();
  });

  it("never logs the advertiser's email address", async () => {
    email.send.mockRejectedValue(new Error("SMTP down"));
    await start();

    const logged = JSON.stringify(
      [
        ...vi.mocked(console.error).mock.calls,
        ...vi.mocked(console.warn).mock.calls,
      ].map((args) => args.filter((arg) => typeof arg === "string")),
    );
    expect(logged).not.toContain("marta@example.com");
  });
});
