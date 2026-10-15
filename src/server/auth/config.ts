import { PrismaAdapter } from "@auth/prisma-adapter";
import { type PrismaClient, type UserRole } from "@prisma/client";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
// Type-only import so the `next-auth/jwt` augmentation below can resolve the module.
import type {} from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";

import { env } from "~/env";
import {
  createAuthorize,
  createJwtCallback,
  sessionCallback,
  signInCallback,
} from "~/server/auth/callbacks";
import { db } from "~/server/db";
import { signInLimiters } from "~/server/services/rate-limit";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}

/**
 * Email + password sign-in. Unknown email, wrong password and blocked account all give the same
 * generic `CredentialsSignin` error; only rate limiting has its own code (`rate_limited`). See
 * `createAuthorize` in `./callbacks.ts`.
 */
const credentialsProvider = CredentialsProvider({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: createAuthorize({
    db,
    limiters: signInLimiters,
    trustedProxyCount: env.TRUSTED_PROXY_COUNT,
  }),
});

/**
 * Credentials is always on. OAuth providers are only enabled when their credentials are present
 * in `.env`, so a fresh clone can run without any OAuth app configured.
 */
const providers: Provider[] = [credentialsProvider];
if (env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET) {
  providers.push(DiscordProvider);
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers,
  trustHost: true, // required when running behind Docker / a reverse proxy
  // The adapter stores OAuth users/accounts; sessions are JWTs because the Credentials provider
  // only supports the JWT strategy. The cast is type-only: the adapter is typed for a client with
  // default options, ours adds a global `omit` (it never needs `passwordHash`).
  adapter: PrismaAdapter(db as unknown as PrismaClient),
  session: { strategy: "jwt" },
  callbacks: {
    signIn: signInCallback,
    jwt: createJwtCallback({ db }),
    session: sessionCallback,
  },
} satisfies NextAuthConfig;
