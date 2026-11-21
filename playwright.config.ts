import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // `next dev` compila cada página la primera vez que se visita, y eso puede tardar varios segundos.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
