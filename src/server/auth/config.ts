import { PrismaAdapter } from "@auth/prisma-adapter";
import { type UserRole } from "@prisma/client";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import DiscordProvider from "next-auth/providers/discord";

import { env } from "~/env";
import { db } from "~/server/db";

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

// The Prisma adapter returns the full DB user (including `role`). We don't augment `User`
// directly because next-auth and @auth/prisma-adapter ship different @auth/core versions.
type DbUser = { id: string; role: UserRole };

/**
 * Providers are only enabled when their credentials are present in `.env`, so a fresh clone can
 * run without any OAuth app configured. Add Google, GitHub, Credentials... here.
 */
const providers: Provider[] = [];
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
  adapter: PrismaAdapter(db),
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        role: (user as unknown as DbUser).role,
      },
    }),
  },
} satisfies NextAuthConfig;
