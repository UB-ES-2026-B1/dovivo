import { CredentialsSignin, type Session } from "next-auth";
import { type JWT } from "next-auth/jwt";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword, type UserDb } from "~/server/services/auth";
import {
  createRateLimiter,
  type SignInLimiters,
} from "~/server/services/rate-limit";

import {
  createAuthorize,
  createJwtCallback,
  RateLimitedSignin,
  sessionCallback,
  signInCallback,
} from "./callbacks";

/**
 * Unit tests for the Auth.js callbacks and the Credentials `authorize` wrapper. Prisma is a small
 * fake and the limiters are fresh per test, so no database or server is needed.
 */

const fakeDb = { user: { findUnique: vi.fn(), create: vi.fn() } };
// Cast through `unknown`: the fake only implements what the service uses.
const db = fakeDb as unknown as UserDb;

const PASSWORD = "correct horse battery";
let passwordHash: string;
beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD, 4);
});

let limiters: SignInLimiters;
beforeEach(() => {
  vi.resetAllMocks();
  limiters = {
    perIp: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    perEmail: createRateLimiter({ limit: 100, windowMs: 60_000 }),
  };
});

const request = (headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers,
  });

describe("createAuthorize", () => {
  const authorize = (trustedProxyCount = 0) =>
    createAuthorize({ db, limiters, trustedProxyCount });

  it("returns null for invalid input without touching the DB", async () => {
    expect(
      await authorize()({ email: "not-an-email", password: "" }, request()),
    ).toBeNull();
    expect(await authorize()({}, request())).toBeNull();
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("passes the normalised input on and returns the user on success", async () => {
    fakeDb.user.findUnique.mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "USER",
      passwordHash,
      blockedAt: null,
    });

    const user = await authorize()(
      { email: "  ADA@Example.com ", password: PASSWORD },
      request({ "x-forwarded-for": "203.0.113.7" }),
    );

    expect(user).toEqual({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "USER",
    });
    expect(fakeDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "ada@example.com" } }),
    );
  });

  it("throws RateLimitedSignin before looking the user up when limited", async () => {
    limiters.perEmail = createRateLimiter({ limit: 0, windowMs: 60_000 });

    const error: unknown = await authorize()(
      { email: "ada@example.com", password: PASSWORD },
      request(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitedSignin);
    expect(error).toBeInstanceOf(CredentialsSignin);
    expect(error).toMatchObject({ code: "rate_limited" });
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("only counts failed attempts towards the limits", async () => {
    limiters.perEmail = createRateLimiter({ limit: 1, windowMs: 60_000 });
    fakeDb.user.findUnique.mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "USER",
      passwordHash,
      blockedAt: null,
    });
    const signIn = (password: string) =>
      authorize()({ email: "ada@example.com", password }, request());

    // Signing in correctly again and again never uses up the single allowed attempt...
    await expect(signIn(PASSWORD)).resolves.toMatchObject({ id: "user_1" });
    await expect(signIn(PASSWORD)).resolves.toMatchObject({ id: "user_1" });
    // ...but a wrong password does.
    await expect(signIn("wrong password")).resolves.toBeNull();
    await expect(signIn(PASSWORD)).rejects.toBeInstanceOf(RateLimitedSignin);
  });

  it("rate-limits by the client IP resolved with TRUSTED_PROXY_COUNT", async () => {
    limiters.perIp = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiters.perIp.check("203.0.113.7"); // the real client already used its only attempt

    // The client forged "1.1.1.1"; with one trusted proxy the real address is the rightmost.
    await expect(
      authorize(1)(
        { email: "ada@example.com", password: PASSWORD },
        request({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }),
      ),
    ).rejects.toBeInstanceOf(RateLimitedSignin);
  });
});

describe("createJwtCallback", () => {
  const jwtCallback = createJwtCallback({ db });
  // At sign-in the token doesn't have `id` / `role` yet; the callback adds them.
  const freshToken = { sub: "user_1", email: "ada@example.com" } as JWT;
  const signedInToken = { ...freshToken, id: "user_1", role: "USER" } as JWT;

  it("copies id and role from a Credentials user (returned by authorize)", async () => {
    const user = {
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "USER",
    };
    expect(await jwtCallback({ token: freshToken, user })).toEqual({
      ...freshToken,
      id: "user_1",
      role: "USER",
    });
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("copies id and role from an OAuth user (DB row from the adapter)", async () => {
    const user = {
      id: "user_2",
      name: "Grace",
      email: "grace@example.com",
      emailVerified: null,
      image: "https://example.com/a.png",
      role: "AGENT",
      phone: null,
      blockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(await jwtCallback({ token: freshToken, user })).toMatchObject({
      id: "user_2",
      role: "AGENT",
    });
  });

  it("refuses a user without a valid role", async () => {
    const user = { id: "user_1", role: "SUPERUSER" };
    await expect(jwtCallback({ token: freshToken, user })).rejects.toThrow();
  });

  it("keeps the token on later requests while the account is fine", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ blockedAt: null, role: "USER" });

    expect(await jwtCallback({ token: signedInToken })).toBe(signedInToken);
    expect(fakeDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { blockedAt: true, role: true },
    });
  });

  it("refreshes the role from the DB", async () => {
    // The token still says USER, but the user was promoted since signing in.
    fakeDb.user.findUnique.mockResolvedValue({
      blockedAt: null,
      role: "ADMIN",
    });

    expect(await jwtCallback({ token: signedInToken })).toEqual({
      ...signedInToken,
      role: "ADMIN",
    });
  });

  it("ends the session of a user blocked after signing in", async () => {
    fakeDb.user.findUnique.mockResolvedValue({
      blockedAt: new Date(),
      role: "USER",
    });
    expect(await jwtCallback({ token: signedInToken })).toBeNull();
  });

  it("ends the session of a deleted user", async () => {
    fakeDb.user.findUnique.mockResolvedValue(null);
    expect(await jwtCallback({ token: signedInToken })).toBeNull();
  });

  it("ends a session whose token has no id", async () => {
    expect(await jwtCallback({ token: freshToken })).toBeNull();
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("sessionCallback", () => {
  it("exposes id and role from the token on session.user", () => {
    const session = {
      user: { name: "Ada", email: "ada@example.com", image: null },
      expires: "2030-01-01T00:00:00.000Z",
    } as Session;
    const token = { sub: "user_1", id: "user_1", role: "AGENT" } as JWT;

    expect(sessionCallback({ session, token })).toEqual({
      user: {
        name: "Ada",
        email: "ada@example.com",
        image: null,
        id: "user_1",
        role: "AGENT",
      },
      expires: "2030-01-01T00:00:00.000Z",
    });
  });
});

describe("signInCallback", () => {
  it("rejects a blocked user (OAuth account already linked)", () => {
    const user = { id: "user_1", blockedAt: new Date() };
    expect(signInCallback({ user })).toBe(false);
  });

  it("allows a user that is not blocked", () => {
    const user = { id: "user_1", role: "USER", blockedAt: null };
    expect(signInCallback({ user })).toBe(true);
  });

  it("allows a first-time OAuth user (provider profile, not in the DB yet)", () => {
    expect(
      signInCallback({ user: { name: "New", email: "new@example.com" } }),
    ).toBe(true);
  });

  it("allows a Credentials user (authorize already rejected blocked ones)", () => {
    const user = { id: "user_1", email: "ada@example.com", role: "USER" };
    expect(signInCallback({ user })).toBe(true);
  });
});
