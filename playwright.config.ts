import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke testy (Faza 17) — pokrywają krytyczne flow A/B z planu:
 *   A) logowanie admina → Strategy Hub
 *   B) logowanie klienta → portal klienta
 * Wymagają zasiedzonych kont z `pnpm db:seed` (admin@syntance.com/admin123,
 * klient@example.com/klient123) na bazie wskazanej przez .env.local.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev --port 3000",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
