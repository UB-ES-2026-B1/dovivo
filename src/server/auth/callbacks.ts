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
  refundSignInAttempt,
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
 * the user lookup, so a `rate_limited` answer doesn't reveal whether the account exists, and a
 * successful sign-in doesn't count towards it.
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

    const attempt = {
      ip: getClientIp(request.headers, trustedProxyCount),
      email: parsed.data.email,
    };
    if (!checkSignInRateLimit(limiters, attempt)) {
      throw new RateLimitedSignin();
    }

    const user = await authorizeCredentials(db, parsed.data);
    // Only failed attempts count towards the limits. The attempt is counted up front (so parallel
    // guesses can't all slip through during the slow bcrypt check) and handed back on success.
    if (user) refundSignInAttempt(limiters, attempt);
    return user;
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

export type JwtCallbackDeps = {
  db: { user: Pick<UserDb["user"], "findUnique"> };
};

/**
 * Builds the `jwt` callback, which runs whenever the JWT is created or read (every `auth()` call).
 *
 * At sign-in `user` is present, either the object returned by `authorize` (Credentials) or the DB
 * user from the Prisma adapter (OAuth); both carry `id` and `role`, which we copy into the token.
 * Our `User` type isn't augmented with `role` (two @auth/core versions are installed), so `role`
 * is checked at runtime instead of cast.
 *
 * On every later read the account is re-checked in the DB, because JWTs can't be revoked: a
 * deleted or blocked user gets `null`, which makes Auth.js drop the session and clear the cookie,
 * so blocking takes effect on the next request everywhere (tRPC, server components, `/api/auth`).
 * The role is refreshed from the DB at the same time.
 */
export function createJwtCallback({ db }: JwtCallbackDeps) {
  return async ({
    token,
    user,
  }: {
    token: JWT;
    user?: User;
  }): Promise<JWT | null> => {
    if (user) {
      const role = "role" in user ? user.role : undefined;
      if (!user.id || !isUserRole(role)) {
        // Fail closed: never issue a session without a known id and role.
        throw new Error("Signed-in user is missing its id or role");
      }
      return { ...token, id: user.id, role };
    }

    // Tokens issued before `id` was added can't be checked, so they are dropped too.
    if (typeof token.id !== "string") return null;

    const current = await db.user.findUnique({
      where: { id: token.id },
      select: { blockedAt: true, role: true },
    });
    if (!current || current.blockedAt) return null;

    return current.role === token.role
      ? token
      : { ...token, role: current.role };
  };
}

/**
 * Exposes `id` and `role` from the token on `session.user`. The `jwt` callback runs first and
 * refreshes the role from the DB, so it is current on every request.
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
