import { type PrismaClient } from "@prisma/client";
import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaller } from "~/server/api/root";

/**
 * Unit tests for the user router. Prisma is replaced by a small fake so no database is needed;
 * we assert on the query arguments the router builds and on how it handles the rows returned.
 */

const fakeDb = {
  user: {
    findUnique: vi.fn(),
  },
};

const session: Session = {
  user: { id: "user_1", role: "USER" },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const makeCaller = (session: Session | null) =>
  createCaller({
    // The router only touches `db.user`, so a narrow fake is enough. Cast through `unknown`
    // because the fake does not implement the whole PrismaClient surface.
    db: fakeDb as unknown as PrismaClient,
    session,
    clientIp: null,
    headers: new Headers(),
  });

const profile = {
  id: "user_1",
  name: "Ana",
  email: "ana@example.com",
  emailVerified: null,
  phone: "+34600000000",
  image: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  // The timing middleware logs every call; keep the test output clean.
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("user.me", () => {
  it("returns UNAUTHORIZED without a session and never queries the database", async () => {
    await expect(makeCaller(null).user.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns the profile of the user in the session", async () => {
    fakeDb.user.findUnique.mockResolvedValue(profile);

    await expect(makeCaller(session).user.me()).resolves.toEqual(profile);
    expect(fakeDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_1" } }),
    );
  });

  // An exact match, so adding a field (e.g. passwordHash) to the select fails this test.
  it("selects only public profile fields", async () => {
    fakeDb.user.findUnique.mockResolvedValue(profile);

    await makeCaller(session).user.me();

    const [args] = fakeDb.user.findUnique.mock.calls[0] as [
      { select: Record<string, boolean> },
    ];
    expect(args.select).toEqual({
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      image: true,
      createdAt: true,
    });
  });

  it("returns UNAUTHORIZED when the account no longer exists", async () => {
    fakeDb.user.findUnique.mockResolvedValue(null);

    await expect(makeCaller(session).user.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
