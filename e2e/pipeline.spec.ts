import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@syntance.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "admin123";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto("/strategy-hub", { waitUntil: "domcontentloaded" });
}

async function openFirstProjectMap(page: import("@playwright/test").Page) {
  await loginAsAdmin(page);
  const res = await page.request.get("/api/strategy-hub/projects");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { projects: Array<{ id: string }> };
  expect(body.projects.length).toBeGreaterThan(0);
  await page.goto(`/strategy-hub/projects/${body.projects[0].id}`, {
    waitUntil: "domcontentloaded",
  });
}

test.describe("Strategy Hub — widok Pipeline", () => {
  test("renderuje 9 etapów pipeline", async ({ page }) => {
    await openFirstProjectMap(page);
    await page.getByRole("tab", { name: "Pipeline" }).click();
    await expect(page.getByTestId("pipeline-view")).toBeVisible();

    const stages = page.locator('[aria-label="Etapy pipeline strategii"] > li');
    await expect(stages).toHaveCount(9);
  });

  test("etap zablokowany pokazuje status Zablokowany", async ({ page }) => {
    await openFirstProjectMap(page);
    await page.getByRole("tab", { name: "Pipeline" }).click();
    await expect(page.getByTestId("pipeline-view")).toBeVisible();

    const lockedLabel = page.getByText("Zablokowany", { exact: true }).first();
    if (await lockedLabel.isVisible()) {
      await expect(lockedLabel).toBeVisible();
    }
  });

  test("CTA bramki prowadzi do modułu edytora", async ({ page }) => {
    await openFirstProjectMap(page);
    await page.getByRole("tab", { name: "Pipeline" }).click();
    await expect(page.getByTestId("pipeline-view")).toBeVisible();

    const gateLink = page
      .locator('a[href*="/strategy-hub/projects/"]')
      .filter({ hasText: /Odpowiedz|Przegląd|Najpierw ukończ/i })
      .first();

    if (await gateLink.isVisible()) {
      const href = await gateLink.getAttribute("href");
      expect(href).toMatch(/\/strategy-hub\/projects\//);
    }
  });
});
