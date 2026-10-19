import { TRPCError } from "@trpc/server";
import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { createCaller } from "~/server/api/root";
import { type AppPrismaClient } from "~/server/db-omit";
import {
  SIGN_UP_PER_IP_LIMIT,
  signUpRateLimiter,
} from "~/server/services/rate-limit";

/**
 * Unit tests for the auth router. Prisma is replaced by a small fake so no database is needed.
 */

const fakeDb = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

const makeCaller = (
  clientIp: string | null = "203.0.113.1",
  session: Session | null = null,
) =>
  createCaller({
    // Cast through `unknown` because the fake does not implement the whole PrismaClient surface.
    db: fakeDb as unknown as AppPrismaClient,
    session,
    clientIp,
    headers: new Headers(),
  });

const input = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "password123",
};

beforeEach(() => {
  vi.resetAllMocks();
  // The limiter is module-level state; start every test from a clean slate.
  signUpRateLimiter.reset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("auth.signUp", () => {
  it("creates the account and returns only id, name and email", async () => {
    fakeDb.user.findUnique.mockResolvedValue(null);
    fakeDb.user.create.mockResolvedValue({
      id: "user_1",
      name: input.name,
      email: input.email,
    });

    const result = await makeCaller().auth.signUp({
      ...input,
      email: "  ADA@example.com ",
    });

    expect(result).toEqual({
      id: "user_1",
      name: input.name,
      email: input.email,
    });
    // The validator normalises the email before it reaches the database.
    expect(fakeDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "ada@example.com" } }),
    );
  });

  it("returns BAD_REQUEST with per-field zod errors for invalid input", async () => {
    const error: unknown = await makeCaller()
      .auth.signUp({ name: "", email: "not-an-email", password: "short" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    // The tRPC error formatter exposes `cause.flatten()` to clients as `data.zodError`.
    const cause = (error as TRPCError).cause;
    expect(cause).toBeInstanceOf(ZodError);
    expect(Object.keys((cause as ZodError).flatten().fieldErrors)).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns CONFLICT when the email is already registered", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "user_existing" });

    await expect(makeCaller().auth.signUp(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(fakeDb.user.create).not.toHaveBeenCalled();
  });

  it("returns TOO_MANY_REQUESTS after too many sign-ups from the same IP", async () => {
    // Use the duplicate-email path so no password is hashed: each call still counts.
    fakeDb.user.findUnique.mockResolvedValue({ id: "user_existing" });
    const sameIp = () => makeCaller("198.51.100.9");

    for (let i = 0; i < SIGN_UP_PER_IP_LIMIT; i++) {
      await expect(sameIp().auth.signUp(input)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    }

    await expect(sameIp().auth.signUp(input)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(fakeDb.user.findUnique).toHaveBeenCalledTimes(SIGN_UP_PER_IP_LIMIT);

    // A different client is unaffected.
    await expect(
      makeCaller("192.0.2.50").auth.signUp(input),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("skips the IP limit when the client IP is unknown (no shared bucket)", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "user_existing" });

    for (let i = 0; i < SIGN_UP_PER_IP_LIMIT + 2; i++) {
      await expect(makeCaller(null).auth.signUp(input)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    }
  });
});
