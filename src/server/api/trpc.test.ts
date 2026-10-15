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
 * session user it receives in its context. Blocked / deleted users are dropped earlier, by the
 * Auth.js `jwt` callback (see `src/server/auth/callbacks.test.ts`).
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

const makeCaller = (currentSession: Session | null) =>
  createTestCaller({
    // Cast through `unknown` because the fake does not implement the whole PrismaClient surface.
    db: fakeDb as unknown as AppPrismaClient,
    session: currentSession,
    clientIp: null,
    headers: new Headers(),
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("protectedProcedure", () => {
  it("passes the session user on, without another DB lookup", async () => {
    expect(await makeCaller(session).whoAmI()).toEqual({
      id: "user_1",
      role: "USER",
    });
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED without a session", async () => {
    await expect(makeCaller(null).whoAmI()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
