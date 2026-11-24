import { type PrismaClient } from "@prisma/client";
import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaller } from "~/server/api/root";
import { type EmailSender } from "~/server/services/email";
import { messageRateLimiter } from "~/server/services/rate-limit";

/**
 * Router tests for `conversation.start` (US-21): access, input and wiring. The logic itself is
 * tested in `src/server/services/conversations.test.ts`.
 */

const email = { send: vi.fn<EmailSender["send"]>() };

vi.mock("~/server/services/email", () => ({
  getEmailSender: () => email,
  getAppUrl: () => "https://dovivo.test",
}));

const tx = {
  conversation: { upsert: vi.fn() },
  message: { create: vi.fn() },
};
const fakeDb = {
  property: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

const session = (id: string, name?: string): Session => ({
  user: { id, role: "USER", name },
  expires: new Date(Date.now() + 60_000).toISOString(),
});

const makeCaller = (s: Session | null = session("user_1", "Joan")) =>
  createCaller({
    db: fakeDb as unknown as PrismaClient,
    session: s,
    clientIp: null,
    headers: new Headers(),
  }).conversation;

const input = { propertyId: "prop_1", body: "Is it still available?" };

beforeEach(() => {
  vi.resetAllMocks();
  messageRateLimiter.reset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  fakeDb.property.findUnique.mockResolvedValue({
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
  });
  fakeDb.$transaction.mockImplementation((run: (t: typeof tx) => unknown) =>
    run(tx),
  );
  tx.conversation.upsert.mockResolvedValue({ id: "conv_1" });
  tx.message.create.mockResolvedValue({
    id: "msg_1",
    body: input.body,
    createdAt: new Date(),
  });
  email.send.mockResolvedValue(undefined);
});

describe("conversation.start access", () => {
  it("UNAUTHORIZED without a session, without touching the database (US-21)", async () => {
    await expect(makeCaller(null).start(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fakeDb.property.findUnique).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it("sends as the session's user, whatever else the input says", async () => {
    await makeCaller(session("user_7", "Joan")).start({
      ...input,
      senderId: "user_2",
      interestedUserId: "user_2",
    } as typeof input);

    expect(tx.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          interestedUserId: "user_7",
        }) as unknown,
      }),
    );
    expect(tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ senderId: "user_7" }) as unknown,
      }),
    );
  });

  it("FORBIDDEN on the user's own listing", async () => {
    await expect(
      makeCaller(session("owner_1")).start(input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("emails the advertiser with the sender's name and the app's link", async () => {
    await makeCaller().start(input);

    const [sent] = email.send.mock.calls[0]!;
    expect(sent.to).toBe("marta@example.com");
    expect(sent.text).toContain("Joan sent you a message");
    expect(sent.text).toContain("https://dovivo.test/properties/prop_1");
  });
});

describe("conversation.start input", () => {
  it.each([
    ["an empty message", { ...input, body: "" }],
    ["a blank message", { ...input, body: "   " }],
    ["a too long message", { ...input, body: "a".repeat(2001) }],
    ["an empty listing id", { ...input, propertyId: "" }],
  ])(
    "refuses %s with BAD_REQUEST, without touching the database",
    async (_case, bad) => {
      await expect(makeCaller().start(bad)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(fakeDb.property.findUnique).not.toHaveBeenCalled();
    },
  );
});
