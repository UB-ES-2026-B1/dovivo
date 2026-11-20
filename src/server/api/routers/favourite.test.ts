import { type PrismaClient } from "@prisma/client";
import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaller } from "~/server/api/root";

/**
 * Router tests for `favourite.*` (US-14): access and wiring. The logic itself is tested in
 * `src/server/services/favourites.test.ts`.
 */

const fakeDb = {
  property: { findUnique: vi.fn() },
  favourite: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
};

const session = (id: string): Session => ({
  user: { id, role: "USER" },
  expires: new Date(Date.now() + 60_000).toISOString(),
});

const makeCaller = (s: Session | null = session("user_1")) =>
  createCaller({
    db: fakeDb as unknown as PrismaClient,
    session: s,
    clientIp: null,
    headers: new Headers(),
  }).favourite;

type Caller = ReturnType<typeof makeCaller>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  fakeDb.property.findUnique.mockResolvedValue({
    status: "PUBLISHED",
    deletedAt: null,
    ownerId: "owner_1",
  });
  fakeDb.favourite.createMany.mockResolvedValue({ count: 1 });
  fakeDb.favourite.deleteMany.mockResolvedValue({ count: 1 });
  fakeDb.favourite.findMany.mockResolvedValue([]);
});

const calls = {
  add: (c: Caller) => c.add({ propertyId: "prop_1" }),
  remove: (c: Caller) => c.remove({ propertyId: "prop_1" }),
  list: (c: Caller) => c.list({}),
  ids: (c: Caller) => c.ids(),
};

describe("favourite.* access", () => {
  it.each(Object.entries(calls))(
    "%s: UNAUTHORIZED without a session, without touching the database",
    async (_name, call) => {
      await expect(call(makeCaller(null))).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(fakeDb.favourite.createMany).not.toHaveBeenCalled();
      expect(fakeDb.favourite.deleteMany).not.toHaveBeenCalled();
      expect(fakeDb.favourite.findMany).not.toHaveBeenCalled();
    },
  );

  it("add and remove act on the session's user, whatever else the input says", async () => {
    const caller = makeCaller(session("user_7"));
    const input = { propertyId: "prop_1", userId: "user_2" };

    await caller.add(input);
    await caller.remove(input);

    expect(fakeDb.favourite.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ userId: "user_7", propertyId: "prop_1" }],
      }),
    );
    expect(fakeDb.favourite.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_7", propertyId: "prop_1" },
    });
  });

  it("list and ids read only the session's user's favourites", async () => {
    const caller = makeCaller(session("user_7"));

    await caller.list({});
    await caller.ids();

    for (const [args] of fakeDb.favourite.findMany.mock.calls as [
      { where: unknown },
    ][]) {
      expect(args.where).toEqual({ userId: "user_7" });
    }
  });
});

describe("favourite.* input", () => {
  it.each([
    ["an empty id", { propertyId: "" }],
    ["a blank id", { propertyId: "   " }],
    ["a too long id", { propertyId: "x".repeat(51) }],
  ])("add refuses %s with BAD_REQUEST", async (_case, input) => {
    await expect(makeCaller().add(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(fakeDb.property.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["a limit of 0", { limit: 0 }],
    ["a limit over 50", { limit: 51 }],
    ["an empty cursor", { cursor: "" }],
  ])("list refuses %s with BAD_REQUEST", async (_case, input) => {
    await expect(makeCaller().list(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("list uses 20 items per page by default", async () => {
    await makeCaller().list({});

    expect(fakeDb.favourite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21 }),
    );
  });
});
