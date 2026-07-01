import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@syntance.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "admin123";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Hasło").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await page.waitForURL(/\/strategy-hub/, { timeout: 15_000 });
}

test.describe("Strategy Hub (panel agencji)", () => {
  test("dashboard ładuje się po zalogowaniu", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/strategy-hub/);
  });

  test("strona ustawień zespołu (Faza 17, Role SaaS) działa", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/strategy-hub/settings/team");
    await expect(page.getByRole("heading", { name: "Zespół" })).toBeVisible();
  });

  test("strona brandingu (white-label) działa", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/strategy-hub/settings/branding");
    await expect(
      page.getByRole("heading", { name: "Branding portalu klienta" })
    ).toBeVisible();
  });
});
