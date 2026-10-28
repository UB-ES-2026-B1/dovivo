import { authRouter } from "~/server/api/routers/auth";
import { propertyRouter } from "~/server/api/routers/property";
import { userRouter } from "~/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  property: propertyRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.property.list({});
 *       ^? { items: Property[], nextCursor?: string }
 */
export const createCaller = createCallerFactory(appRouter);
