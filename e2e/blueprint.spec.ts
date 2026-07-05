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

test.describe("Blueprint segmentu", () => {
  test("renderuje nagłówki etapów i luki", async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.get("/api/strategy-hub/projects");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { projects: Array<{ id: string }> };
    expect(body.projects.length).toBeGreaterThan(0);
    const projectId = body.projects[0].id;

    await page.goto(
      `/strategy-hub/projects/${projectId}/blueprint`,
      { waitUntil: "domcontentloaded" }
    );

    await expect(page.getByText("PRZEKRÓJ SEGMENTU")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("portal klienta — brak edycji", async ({ page }) => {
    const slug = await loginAsClient(page);
    if (!slug) return;
    await page.goto(`/projects/${slug}/strategy/blueprint`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Blueprint segmentu")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Decyzje/i })).toHaveCount(0);
  });
});
