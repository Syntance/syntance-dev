import { test, expect } from "@playwright/test";

const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL || "klient@example.com";
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD || "klient123";

test.describe("Portal klienta", () => {
  test("nawigacja zawiera nowe sekcje (Lejek, Kampanie, Raporty)", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(CLIENT_EMAIL);
    await page.getByPlaceholder("Hasło").fill(CLIENT_PASSWORD);
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 15_000 });

    await expect(page.getByRole("link", { name: /Lejek sprzedażowy/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Kampanie/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Raporty/ })).toBeVisible();
  });
});
