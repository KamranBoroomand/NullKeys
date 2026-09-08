import { expect, test } from "@playwright/test";

for (const route of ["/", "/typing-test", "/settings"] as const) {
  test(`${route} renders in supported browser engines`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}
