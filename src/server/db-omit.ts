import { type Prisma, type PrismaClient } from "@prisma/client";

/**
 * Fields Prisma leaves out of every query result unless a query explicitly selects them
 * (`select: { passwordHash: true }`). Applied to the app client in `src/server/db.ts`, so password
 * hashes can't leak through an `include` or a bare `findMany`.
 *
 * Lives in its own file (no `~/env` import) so pure services and tests can share the client type.
 */
export const prismaGlobalOmit = {
  user: { passwordHash: true },
} as const satisfies Prisma.GlobalOmitConfig;

/** Type of the app's Prisma client, as configured in `src/server/db.ts`. */
export type AppPrismaClient = PrismaClient<{ omit: typeof prismaGlobalOmit }>;
