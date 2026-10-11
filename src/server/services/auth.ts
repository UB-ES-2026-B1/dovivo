import { Prisma, type UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { compare, hash } from "bcryptjs";

import { type SignInInput, type SignUpInput } from "~/lib/validators/auth";
import { type AppPrismaClient } from "~/server/db-omit";

/**
 * Email + password business logic. Pure functions: the database is passed in, and nothing here
 * imports `~/env` or `~/server/db`, so they can be unit-tested with a small fake.
 */

/** bcrypt work factor (2^12 rounds, roughly 200-300 ms per hash on a modern CPU). */
export const BCRYPT_COST = 12;

/**
 * Hash of a random secret nobody knows, with the same cost as real hashes. `authorizeCredentials`
 * compares against it when the user does not exist, so the response takes as long as for a real
 * account and timing does not reveal which emails are registered. A test checks that its cost
 * matches `BCRYPT_COST`, so update both together.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$rLawcRapb/tDqwf76yEec.jgfNdovtW29eQFpFTVffOrqNZL1ybt.";

export const hashPassword = (password: string, cost: number = BCRYPT_COST) =>
  hash(password, cost);

export const verifyPassword = (password: string, passwordHash: string) =>
  compare(password, passwordHash);

/** The slice of Prisma these functions use; tests pass a fake implementing only this. */
export type UserDb = {
  user: Pick<AppPrismaClient["user"], "findUnique" | "create">;
};

export type PublicSignUpUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export type AuthorizedUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
};

const emailAlreadyRegistered = () =>
  new TRPCError({ code: "CONFLICT", message: "Email already registered" });

/**
 * Creates an email + password account with the default role. Throws `CONFLICT` if the email is
 * taken (including when two sign-ups race and the unique index rejects the second one).
 */
export async function registerUser(
  db: UserDb,
  input: SignUpInput,
): Promise<PublicSignUpUser> {
  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw emailAlreadyRegistered();

  const passwordHash = await hashPassword(input.password);

  try {
    return await db.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw emailAlreadyRegistered();
    }
    throw error;
  }
}

/**
 * Checks email + password for the Credentials provider. Returns the session user on success and
 * `null` otherwise, without saying why (unknown email, OAuth-only account, wrong password and
 * blocked account all look the same to the caller).
 */
export async function authorizeCredentials(
  db: UserDb,
  input: SignInInput,
): Promise<AuthorizedUser | null> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      passwordHash: true,
      blockedAt: true,
    },
  });

  if (!user?.passwordHash) {
    // Burn the same CPU time as a real check so timing doesn't reveal whether the email exists.
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const passwordMatches = await verifyPassword(
    input.password,
    user.passwordHash,
  );
  if (!passwordMatches) return null;

  // Checked after the password so a blocked account answers just as slowly as any other.
  if (user.blockedAt) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
  };
}
