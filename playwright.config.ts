import { defineConfig, devices } from "@playwright/test";
// Specs de historias aún sin implementar. Quita cada uno al cerrar su sprint.

// E2E_ALL=1 los ejecuta todos.
const PENDING = ["search", "publish", "contact", "favourites", "my-listings"];
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: process.env.E2E_ALL
    ? undefined
    : PENDING.map((n) => `**/${n}.spec.ts`),
  globalTimeout: CI ? 20 * 60_000 : undefined,
  maxFailures: CI ? 15 : undefined,
  // `next dev` compila cada página la primera vez que se visita, y eso puede tardar varios segundos.
  timeout: CI ? 30_000 : 60_000,
  expect: { timeout: CI ? 10_000 : 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: CI ? 1 : 0,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    // Genera docs/qa/TEST_RESULTS_AUTO.md con el estado de cada caso TC-xxx
    ["./e2e/md-reporter.ts", { outputFile: "docs/qa/TEST_RESULTS_AUTO.md" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Para TC-084 (compatibilidad), descomentar tras: pnpm exec playwright install firefox webkit
    // { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  // Si E2E_BASE_URL está definida (p. ej. staging) no se arranca el servidor local.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // En CI se sirve la build de producción (`pnpm build` ya hecho); en local, el modo desarrollo.
        command: process.env.CI ? "pnpm start" : "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
