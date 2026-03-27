import { expect, test } from "@playwright/test";

async function typeIntoActiveSurface(page: import("@playwright/test").Page, text: string) {
  const touchInput = page.getByLabel("Type here");

  if (await touchInput.isVisible().catch(() => false)) {
    await touchInput.pressSequentially(text, { delay: 2 });
    return touchInput;
  }

  const captureInput = page.getByTestId("typing-capture-input");
  await expect(captureInput).toBeAttached();
  await page.keyboard.type(text, { delay: 2 });
  return captureInput;
}

async function readRawPrompt(page: import("@playwright/test").Page) {
  await expect
    .poll(async () => {
      return (await page.getByTestId("prompt-board").getAttribute("data-prompt-text")) ?? "";
    })
    .not.toBe("");

  return (await page.getByTestId("prompt-board").getAttribute("data-prompt-text")) ?? "";
}

async function readPromptAttribute(page: import("@playwright/test").Page) {
  return (await page.getByTestId("prompt-board").getAttribute("data-prompt-text")) ?? "";
}

test("user can complete onboarding and open practice", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: /set up your language/i })).toBeVisible();
  await page.getByRole("button", { name: /save locally and continue/i }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByTestId("prompt-board")).toBeVisible();
});

test("landing page exposes the main product routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("prompt-board")).toBeVisible();
  await expect(page.getByRole("link", { name: /^settings\.\.\.$/i })).toBeVisible();
});

test("settings exposes product build info and wired browser identity", async ({ page }) => {
  await page.goto("/settings");

  await expect(page).toHaveTitle(/Settings · NullKeys/);
  await expect(page.getByTestId("settings-build-version")).toContainText(/^v/);

  const iconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
  const appleIconHref = await page
    .locator('link[rel="apple-touch-icon"]')
    .first()
    .getAttribute("href");

  expect(iconHref).toBeTruthy();
  expect(appleIconHref).toBeTruthy();
});

test("high scores uses a focused empty state before local history exists", async ({ page }) => {
  await page.goto("/high-scores");
  await expect(page.getByRole("heading", { name: /no local scores yet/i })).toBeVisible();
  await expect(page.getByText(/instead of showing misleading zero-value leaderboards/i)).toBeVisible();
  await expect(page.getByText(/best score/i)).toBeHidden();
});

test("onboarding choices persist into settings locally", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Practice language").selectOption("persian");
  await page.getByLabel("Keyboard family").selectOption("touch-android");
  await page.getByLabel("Layout variant").selectOption("touch-android-standard");
  await page.getByRole("button", { name: /save locally and continue/i }).click();

  await page.goto("/settings");
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("persian");
  await expect(page.getByLabel("Layout", { exact: true })).toHaveValue("touch-android-standard");
});

test("practice accepts hardware typing immediately without a click", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "This flow only applies to hardware keyboard capture.");

  await page.goto("/practice");
  const promptText = await readRawPrompt(page);
  const partialPrompt = promptText.slice(0, 24);

  const captureInput = page.getByTestId("typing-capture-input");
  await expect(captureInput).toBeAttached();
  await page.keyboard.type(partialPrompt, { delay: 2 });

  await expect(captureInput).toHaveValue(partialPrompt);
});

test("practice language switch updates the prompt and keyboard context immediately", async ({ page }) => {
  await page.goto("/practice");
  const initialPrompt = await readRawPrompt(page);

  await page.getByLabel("Practice language").selectOption("russian");
  await expect
    .poll(async () => await readPromptAttribute(page))
    .toMatch(/[\u0400-\u04ff]/u);
  await expect
    .poll(async () => await readPromptAttribute(page))
    .not.toBe(initialPrompt);
  await expect(page.getByTestId("practice-keyboard-shell").getByText("Й")).toBeVisible();

  await page.getByLabel("Practice language").selectOption("persian");
  await expect
    .poll(async () => await readPromptAttribute(page))
    .toMatch(/[\u0600-\u06ff]/u);
  await expect(page.getByTestId("practice-keyboard-shell").getByText("ض")).toBeVisible();
});

test("settings keeps language changes in draft until save and activates them after saving", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText(/settings stay draft-only until you save/i)).toBeVisible();

  await page.getByLabel("Language", { exact: true }).selectOption("russian");
  await expect(page.getByText(/active practice language is still english/i)).toBeVisible();

  await page.goto("/practice");
  await expect
    .poll(async () => await readPromptAttribute(page))
    .toMatch(/[a-z]/i);
  await expect
    .poll(async () => await readPromptAttribute(page))
    .not.toMatch(/[\u0400-\u04ff]/u);

  await page.goto("/settings");
  await page.getByLabel("Language", { exact: true }).selectOption("russian");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText(/updated settings are now active/i)).toBeVisible();

  await page.goto("/practice");
  await expect
    .poll(async () => await readPromptAttribute(page))
    .toMatch(/[\u0400-\u04ff]/u);
  await expect(page.getByTestId("practice-keyboard-shell").getByText("Й")).toBeVisible();
});

test("benchmark mode updates live metrics while typing", async ({ page }) => {
  await page.goto("/typing-test");
  const promptText = await readRawPrompt(page);
  const partialPrompt = promptText.slice(0, 32);

  const activeSurface = await typeIntoActiveSurface(page, partialPrompt);
  await expect(activeSurface).toHaveValue(partialPrompt);
  await expect(page.getByText(/test is active/i)).toBeVisible();
});

test("developer tools can seed local preview data", async ({ page }) => {
  await page.goto("/devtools");
  await expect(page.getByRole("heading", { name: /developer tools/i })).toBeVisible();
  await page.getByRole("button", { name: /seed demo progress/i }).click();
  await expect(page.getByText(/saved 8 demo sessions/i)).toBeVisible();
  await expect(page.getByText(/current adaptive stage is/i)).toBeVisible();
});
