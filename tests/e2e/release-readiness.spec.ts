import { expect, test } from "@playwright/test";

const publishRoutes = [
  { path: "/", title: /Practice/i, canonical: "https://nullkeys.kamranboroomand.ir" },
  { path: "/practice", title: /Practice/i, canonical: "https://nullkeys.kamranboroomand.ir" },
  { path: "/typing-test", title: /Typing Test/i, canonical: "https://nullkeys.kamranboroomand.ir/typing-test" },
  { path: "/benchmark", title: /Typing Test/i, canonical: "https://nullkeys.kamranboroomand.ir/typing-test" },
  { path: "/profile", title: /Profile/i, canonical: "https://nullkeys.kamranboroomand.ir/profile" },
  { path: "/progress", title: /Profile/i, canonical: "https://nullkeys.kamranboroomand.ir/profile" },
  { path: "/layouts", title: /Layouts/i, canonical: "https://nullkeys.kamranboroomand.ir/layouts" },
  { path: "/help", title: /Help/i, canonical: "https://nullkeys.kamranboroomand.ir/help" },
  { path: "/guide", title: /Help/i, canonical: "https://nullkeys.kamranboroomand.ir/help" },
  { path: "/high-scores", title: /High Scores/i, canonical: "https://nullkeys.kamranboroomand.ir/high-scores" },
  { path: "/settings", title: /Settings/i, canonical: "https://nullkeys.kamranboroomand.ir/settings" },
  { path: "/privacy", title: /Privacy/i, canonical: "https://nullkeys.kamranboroomand.ir/privacy" },
  { path: "/methodology", title: /Methodology/i, canonical: "https://nullkeys.kamranboroomand.ir/methodology" },
  { path: "/onboarding", title: /Onboarding/i, canonical: "https://nullkeys.kamranboroomand.ir/onboarding" },
] as const;

test("publish-facing routes expose stable metadata and avoid placeholder copy", async ({ page }) => {
  for (const route of publishRoutes) {
    const response = await page.goto(route.path);

    expect(response, `${route.path} should return an HTTP response`).not.toBeNull();
    expect(response?.status(), `${route.path} should load successfully`).toBe(200);

    await expect(page).toHaveTitle(route.title);

    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description?.trim().length ?? 0, `${route.path} should expose a non-empty description`).toBeGreaterThan(20);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", route.canonical);

    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /This page could not be found|coming soon|not implemented|TODO\b|placeholder route/i,
    );
  }
});
