import { test, expect } from "@playwright/test";

const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL || "klient@example.com";
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD || "klient123";

async function loginAsClient(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(CLIENT_EMAIL);
  await page.getByPlaceholder("Hasło").fill(CLIENT_PASSWORD);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await page.waitForURL(/\/projects\/.+/, { timeout: 15_000 });
  const slug = page.url().match(/\/projects\/([^/?#]+)/)?.[1];
  expect(slug).toBeTruthy();
  return slug!;
}

test.describe("Portal klienta", () => {
  test("nawigacja zawiera nowe sekcje (Lejek, Kampanie, Raporty)", async ({ page }) => {
    await loginAsClient(page);

    await expect(page.getByRole("link", { name: /Lejek sprzedażowy/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Kampanie/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Raporty/ })).toBeVisible();
  });

  test("KPI renderuje bogaty dashboard (KpiClient mode=client)", async ({ page }) => {
    const slug = await loginAsClient(page);
    let projectId = "";

    page.on("request", (req) => {
      const match = req.url().match(
        /\/api\/strategy-hub\/projects\/([0-9a-f-]{36})\/kpis/
      );
      if (match) projectId = match[1];
    });

    await page.goto(`/projects/${slug}/strategy/kpi`);
    await expect(page.getByRole("heading", { name: "KPI", level: 1 })).toBeVisible();
    await expect(
      page.getByText(/Mierzalne cele projektu|Ładowanie KPI|KPI są jeszcze/)
    ).toBeVisible({ timeout: 10_000 });

    if (projectId) {
      const getRes = await page.request.get(
        `/api/strategy-hub/projects/${projectId}/kpis`
      );
      expect(getRes.ok()).toBeTruthy();

      const postRes = await page.request.post(
        `/api/strategy-hub/projects/${projectId}/kpis`,
        { data: { name: "E2E unauthorized" } }
      );
      expect(postRes.status()).toBeGreaterThanOrEqual(400);
      expect(postRes.status()).toBeLessThan(500);
    }
  });

  test("Lejek renderuje Funnel Board + heatmapę", async ({ page }) => {
    const slug = await loginAsClient(page);
    await page.goto(`/projects/${slug}/strategy/funnel`);
    await expect(
      page.getByRole("heading", { name: "Lejek sprzedażowy", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Funnel Flow Builder")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Channel Heatmap/)).toBeVisible();
  });

  test("Segmenty renderują SegmentsEditor (mode=client)", async ({ page }) => {
    const slug = await loginAsClient(page);
    await page.goto(`/projects/${slug}/strategy/segments`);
    await expect(page.getByRole("heading", { name: "Segmenty", level: 1 })).toBeVisible();
    await expect(
      page.getByText(/Grupy docelowe|Ładowanie|Brak segmentów/)
    ).toBeVisible({ timeout: 10_000 });
  });
});
