import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const accessibilityRoutes = ["/", "/typing-test", "/settings", "/profile"] as const;

test("primary product routes have no serious automated accessibility violations", async ({ page }) => {
  for (const route of accessibilityRoutes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const seriousViolations = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(seriousViolations, `${route} serious accessibility violations`).toEqual([]);
  }
});

test("keyboard users can skip navigation and operate the practice guide dialog", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Hardware-keyboard focus behavior is desktop-only; mobile routes retain axe coverage.");
  await page.goto("/practice");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  const mainContent = page.locator("main");
  const promptBoard = page.getByTestId("prompt-board");
  const captureInput = page.getByTestId("typing-capture-input");

  await expect(page).toHaveURL(/\/practice$/u);
  await expect(skipLink).toBeAttached();
  await expect(mainContent).toBeVisible();
  await expect(promptBoard).toBeVisible();
  await expect
    .poll(async () => (await promptBoard.getAttribute("data-prompt-text")) ?? "")
    .not.toBe("");
  await page.waitForLoadState("networkidle");
  await expect(captureInput).toBeFocused();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      }),
  );
  await expect(captureInput).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(mainContent).toBeFocused();

  const guideButton = page.getByRole("button", { name: "Show guided tour" });
  await guideButton.click();
  const dialog = page.getByRole("dialog", { name: /adaptive lessons stay targeted/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Back" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(guideButton).toBeFocused();
});
