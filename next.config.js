/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Standalone output is only enabled inside Docker (see Dockerfile). Enabling it for local builds
  // breaks on Windows + pnpm because it needs symlink privileges.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

export default config;
