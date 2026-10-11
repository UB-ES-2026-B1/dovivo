import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Unit tests must not need a real `.env` (router tests use a fake db and session).
    env: { SKIP_ENV_VALIDATION: "1" },
    server: {
      deps: {
        // next-auth's ESM build imports `next/server` without an extension, which Node's resolver
        // rejects; letting Vite transform it resolves the import.
        inline: ["next-auth"],
      },
    },
  },
});
