import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { type AppPrismaClient } from "~/server/db-omit";

/**
 * Tests for the `protectedProcedure` middleware itself, through a tiny router that echoes the
 * session user it receives in its context.
 */

const testRouter = createTRPCRouter({
  whoAmI: protectedProcedure.query(({ ctx }) => ctx.session.user),
});
const createTestCaller = createCallerFactory(testRouter);

const fakeDb = { user: { findUnique: vi.fn() } };

const session: Session = {
  user: { id: "user_1", role: "USER" },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const makeCaller = () =>
  createTestCaller({
    // Cast through `unknown` because the fake does not implement the whole PrismaClient surface.
    db: fakeDb as unknown as AppPrismaClient,
    session,
    clientIp: null,
    headers: new Headers(),
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("protectedProcedure", () => {
  it("passes the current role from the DB, not the one in the token", async () => {
    // The token still says USER, but the user was promoted since signing in.
    fakeDb.user.findUnique.mockResolvedValue({
      blockedAt: null,
      role: "ADMIN",
    });

    const user = await makeCaller().whoAmI();

    expect(user).toEqual({ id: "user_1", role: "ADMIN" });
    expect(fakeDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { blockedAt: true, role: true },
    });
  });

  it("returns UNAUTHORIZED for a blocked user", async () => {
    fakeDb.user.findUnique.mockResolvedValue({
      blockedAt: new Date(),
      role: "USER",
    });

    await expect(makeCaller().whoAmI()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
