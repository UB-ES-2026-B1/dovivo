import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authorizeCredentials,
  BCRYPT_COST,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  registerUser,
  type UserDb,
  verifyPassword,
} from "./auth";

// Keep the real bcrypt, but wrap `compare` in a spy so tests can see which hash was checked.
vi.mock("bcryptjs", async (importOriginal) => {
  const actual = await importOriginal<typeof bcrypt>();
  return { ...actual, compare: vi.fn(actual.compare) };
});

/**
 * Unit tests for the email + password service. Prisma is replaced by a small fake; bcrypt is real.
 * Fixture hashes use a low cost (4) so the suite stays fast; `registerUser` uses the real cost.
 */

const fakeDb = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};
// The fake only implements the two methods the service uses. Cast through `unknown` because
// Prisma's delegate methods are heavily generic.
const db = fakeDb as unknown as UserDb;

const TEST_COST = 4;
const PASSWORD = "correct horse battery";
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD, TEST_COST);
});

beforeEach(() => {
  vi.resetAllMocks();
});

const signUpInput = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: PASSWORD,
};

describe("hashPassword / verifyPassword", () => {
  it("produces a bcrypt hash that verifies only the original password", async () => {
    expect(passwordHash).toMatch(/^\$2[aby]\$04\$/);
    expect(await verifyPassword(PASSWORD, passwordHash)).toBe(true);
    expect(await verifyPassword("wrong password", passwordHash)).toBe(false);
  });
});

describe("DUMMY_PASSWORD_HASH", () => {
  it("uses the same cost as real hashes, so unknown emails take as long", () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(BCRYPT_COST);
  });
});

describe("registerUser", () => {
  it("creates the user with a bcrypt hash and returns no hash", async () => {
    fakeDb.user.findUnique.mockResolvedValue(null);
    fakeDb.user.create.mockResolvedValue({
      id: "user_1",
      name: signUpInput.name,
      email: signUpInput.email,
    });

    const result = await registerUser(db, signUpInput);

    expect(result).toEqual({
      id: "user_1",
      name: signUpInput.name,
      email: signUpInput.email,
    });
    expect(result).not.toHaveProperty("passwordHash");

    expect(fakeDb.user.create).toHaveBeenCalledTimes(1);
    const [args] = fakeDb.user.create.mock.calls[0] as [
      {
        data: { name: string; email: string; passwordHash: string };
        select: Record<string, boolean>;
      },
    ];
    expect(args.data.name).toBe(signUpInput.name);
    expect(args.data.email).toBe(signUpInput.email);
    expect(args.data).not.toHaveProperty("role"); // DB default (USER)
    expect(args.data.passwordHash).not.toBe(PASSWORD);
    expect(args.data.passwordHash).toMatch(
      new RegExp(`^\\$2[aby]\\$${BCRYPT_COST}\\$`),
    );
    expect(await verifyPassword(PASSWORD, args.data.passwordHash)).toBe(true);
    expect(args.select).toEqual({ id: true, name: true, email: true });
  });

  it("throws CONFLICT when the email is already registered", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "user_existing" });

    await expect(registerUser(db, signUpInput)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(fakeDb.user.create).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race (P2002) to CONFLICT", async () => {
    fakeDb.user.findUnique.mockResolvedValue(null);
    fakeDb.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    await expect(registerUser(db, signUpInput)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rethrows other database errors", async () => {
    const failure = new Error("connection lost");
    fakeDb.user.findUnique.mockResolvedValue(null);
    fakeDb.user.create.mockRejectedValue(failure);

    await expect(registerUser(db, signUpInput)).rejects.toBe(failure);
  });
});

describe("authorizeCredentials", () => {
  const dbUser = () => ({
    id: "user_1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    image: null,
    role: "USER" as const,
    passwordHash,
    blockedAt: null as Date | null,
  });
  const signIn = (password: string) => ({ email: "ada@example.com", password });

  it("returns the user without the hash for the correct password", async () => {
    fakeDb.user.findUnique.mockResolvedValue(dbUser());

    const result = await authorizeCredentials(db, signIn(PASSWORD));

    expect(result).toEqual({
      id: "user_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      image: null,
      role: "USER",
    });
    // The global Prisma `omit` hides `passwordHash`, so the query must select it explicitly.
    expect(fakeDb.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      select: expect.objectContaining({
        passwordHash: true,
        blockedAt: true,
      }) as unknown,
    });
  });

  it("returns null for a wrong password", async () => {
    fakeDb.user.findUnique.mockResolvedValue(dbUser());

    expect(await authorizeCredentials(db, signIn("wrong password"))).toBeNull();
  });

  it("returns null for an unknown email, after a dummy compare", async () => {
    fakeDb.user.findUnique.mockResolvedValue(null);

    expect(await authorizeCredentials(db, signIn(PASSWORD))).toBeNull();
    // The timing-equalising compare against the dummy hash really ran.
    expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledWith(
      PASSWORD,
      DUMMY_PASSWORD_HASH,
    );
  });

  it("returns null for an account without a password (OAuth only)", async () => {
    fakeDb.user.findUnique.mockResolvedValue({
      ...dbUser(),
      passwordHash: null,
    });

    expect(await authorizeCredentials(db, signIn(PASSWORD))).toBeNull();
    expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledWith(
      PASSWORD,
      DUMMY_PASSWORD_HASH,
    );
  });

  it("returns null for a blocked user even with the correct password", async () => {
    fakeDb.user.findUnique.mockResolvedValue({
      ...dbUser(),
      blockedAt: new Date(),
    });

    expect(await authorizeCredentials(db, signIn(PASSWORD))).toBeNull();
  });
});
