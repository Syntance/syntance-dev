import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@syntance.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "admin123";
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL || "klient@example.com";
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD || "klient123";

test.describe("Logowanie", () => {
  test("strona logowania renderuje formularz", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Hasło")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
  });

  test("nieprawidłowe dane logowania pokazują błąd", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("nieistnieje@example.com");
    await page.getByPlaceholder("Hasło").fill("blednehaslo123");
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(
      page.getByText(/nieprawidłow|błąd|error|nie znaleziono/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("admin loguje się i trafia do Strategy Hub (flow A)", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Hasło").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await page.waitForURL(/\/strategy-hub/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/strategy-hub/);
  });

  test("klient loguje się i trafia do portalu (flow B)", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(CLIENT_EMAIL);
    await page.getByPlaceholder("Hasło").fill(CLIENT_PASSWORD);
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await page.waitForURL(/\/projects/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/projects/);
  });
});
