import { UserRole } from "@prisma/client";
import { CredentialsSignin, type Session, type User } from "next-auth";
import { type JWT } from "next-auth/jwt";

import { signInSchema } from "~/lib/validators/auth";
import {
  type AuthorizedUser,
  authorizeCredentials,
  type UserDb,
} from "~/server/services/auth";
import {
  checkSignInRateLimit,
  getClientIp,
  type SignInLimiters,
} from "~/server/services/rate-limit";

/**
 * Auth.js pieces wired up in `config.ts`. Kept here, with their dependencies passed in (no `~/env`
 * or `~/server/db` import), so they can be unit-tested without a database or a running server.
 */

/**
 * Thrown by `authorize` when the sign-in attempt is rate limited. Auth.js adds `code` to the error
 * redirect (`?error=CredentialsSignin&code=rate_limited`), and `signIn("credentials", { redirect:
 * false })` from `next-auth/react` returns it as `res.code`, so the UI can say "too many attempts"
 * (our TOO_MANY_REQUESTS contract). Every other failure keeps the generic `code: "credentials"`.
 */
export class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export type AuthorizeDeps = {
  db: UserDb;
  limiters: SignInLimiters;
  /** Value of `TRUSTED_PROXY_COUNT`, see `getClientIp`. */
  trustedProxyCount: number;
};

/**
 * Builds the Credentials provider's `authorize`. Returns `null` (generic error) for invalid input,
 * unknown email, wrong password, OAuth-only or blocked account. The rate limit is checked before
 * the user lookup, so a `rate_limited` answer doesn't reveal whether the account exists.
 */
export function createAuthorize({
  db,
  limiters,
  trustedProxyCount,
}: AuthorizeDeps) {
  return async (
    raw: unknown,
    request: Request,
  ): Promise<AuthorizedUser | null> => {
    const parsed = signInSchema.safeParse(raw);
    if (!parsed.success) return null;

    const ip = getClientIp(request.headers, trustedProxyCount);
    if (!checkSignInRateLimit(limiters, { ip, email: parsed.data.email })) {
      throw new RateLimitedSignin();
    }

    return authorizeCredentials(db, parsed.data);
  };
}

const USER_ROLES: readonly string[] = Object.values(UserRole);
const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && USER_ROLES.includes(value);

/**
 * Rejects blocked accounts. Mainly for OAuth: there `user` is the DB user from the adapter when
 * the account is already linked (so it has `blockedAt`), or the provider profile on first sign-up
 * (no `blockedAt`, allowed). Credentials users never reach this when blocked, `authorize` already
 * returned `null`.
 */
export function signInCallback({ user }: { user: User }): boolean {
  return !("blockedAt" in user && user.blockedAt);
}

/**
 * Runs whenever the JWT is created or read. `user` is only present at sign-in, either the object
 * returned by `authorize` (Credentials) or the DB user from the Prisma adapter (OAuth); both carry
 * `id` and `role`, which we copy into the token. Our `User` type isn't augmented with `role`
 * (two @auth/core versions are installed), so `role` is checked at runtime instead of cast.
 */
export function jwtCallback({ token, user }: { token: JWT; user?: User }): JWT {
  if (!user) return token;

  const role = "role" in user ? user.role : undefined;
  if (!user.id || !isUserRole(role)) {
    // Fail closed: never issue a session without a known id and role.
    throw new Error("Signed-in user is missing its id or role");
  }
  return { ...token, id: user.id, role };
}

/**
 * Exposes `id` and `role` from the token on `session.user`. The role may be stale until the next
 * sign-in; `protectedProcedure` reads the current role from the DB for anything that matters.
 */
export function sessionCallback({
  session,
  token,
}: {
  session: Session;
  token: JWT;
}): Session {
  return {
    ...session,
    user: { ...session.user, id: token.id, role: token.role },
  };
}
