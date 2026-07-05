import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@syntance.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "admin123";
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL || "klient@example.com";
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD || "klient123";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto("/strategy-hub", { waitUntil: "domcontentloaded" });
}

async function loginAsClient(page: import("@playwright/test").Page): Promise<string> {
  const res = await page.request.post("/api/auth/login", {
    data: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const data = (await res.json()) as { slug?: string | null };
  const slug = data.slug ?? page.url().match(/\/projects\/([^/?#]+)/)?.[1] ?? "";
  if (slug) {
    await page.goto(`/projects/${slug}`, { waitUntil: "domcontentloaded" });
    return slug;
  }
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  return page.url().match(/\/projects\/([^/?#]+)/)?.[1] ?? "";
}

async function openFirstProjectConstellation(page: import("@playwright/test").Page) {
  const res = await page.request.get("/api/strategy-hub/projects");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { projects: Array<{ id: string }> };
  expect(body.projects.length).toBeGreaterThan(0);
  await page.goto(
    `/strategy-hub/projects/${body.projects[0].id}/constellation`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.getByRole("img", { name: "Widok konstelacji strategii" })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Konstelacja Strategy Hub", () => {
  test("renderuje rdzeń i 7 obszarów", async ({ page }) => {
    await loginAsAdmin(page);
    await openFirstProjectConstellation(page);

    const svg = page.getByRole("img", { name: "Widok konstelacji strategii" });
    const circles = await svg.locator("circle").count();
    expect(circles).toBeGreaterThanOrEqual(8);
  });

  test("klawiatura przesuwa fokus (aria-live)", async ({ page }) => {
    await loginAsAdmin(page);
    await openFirstProjectConstellation(page);

    const container = page.getByRole("img", { name: "Widok konstelacji strategii" });
    await container.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[aria-live="polite"]')).toContainText("Fokus:", {
      timeout: 5_000,
    });
  });

  test("reduced-motion — fokus bez opóźnienia animacji", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loginAsAdmin(page);
    await openFirstProjectConstellation(page);

    const container = page.getByRole("img", { name: "Widok konstelacji strategii" });
    await container.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[aria-live="polite"]')).toContainText("Fokus:", {
      timeout: 5_000,
    });
  });

  test("portal klienta — brak przycisków edycji", async ({ page }) => {
    const slug = await loginAsClient(page);
    test.skip(!slug, "Brak projektu klienta w seedzie");

    await page.goto(`/projects/${slug}/strategy/constellation`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("img", { name: "Widok konstelacji strategii" })).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByRole("button", { name: "Dodaj relację" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Otwórz w edytorze/ })).toHaveCount(0);
  });

  test("nitka — panel encji i widok NITKA", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loginAsAdmin(page);
    await openFirstProjectConstellation(page);

    await page.getByRole("button", { name: "Szczegóły" }).click({ timeout: 10_000 });
    await page.getByRole("button", { name: "Pokaż nitkę" }).click();
    await expect(page).toHaveURL(/thread=/, { timeout: 10_000 });
    await expect(page.getByText("NITKA")).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/thread=/, { timeout: 5_000 });
  });
});
