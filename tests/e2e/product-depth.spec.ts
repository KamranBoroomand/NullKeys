import { expect, test, type Page } from "@playwright/test";

const bundledThemeIds = [
  "nullkeys-classic",
  "legacy-dark",
  "light-paper",
  "dracula",
  "nord",
  "solarized-dark",
  "solarized-light",
  "gruvbox-dark",
  "gruvbox-light",
  "catppuccin-mocha",
  "catppuccin-latte",
  "catppuccin-frappe",
  "catppuccin-macchiato",
] as const;

async function dismissPracticeGuide(page: Page) {
  const guideDialog = page.getByTestId("practice-guide-dialog");

  await guideDialog.waitFor({ state: "visible", timeout: 1_500 }).catch(() => null);

  if (await guideDialog.isVisible()) {
    const skipTourButton = page.getByRole("button", { name: /skip tour/i });
    await skipTourButton.scrollIntoViewIfNeeded();
    await skipTourButton.click({ force: true });

    const doneButton = page.getByRole("button", { name: /^done$/i });
    await doneButton.scrollIntoViewIfNeeded();
    await doneButton.click({ force: true });
    await expect(guideDialog).toBeHidden();
  }
}

async function seedDemoProgress(page: Page) {
  await page.goto("/devtools");
  await page.getByRole("button", { name: /seed demo progress/i }).click();
  await expect(page.getByText(/saved 8 demo sessions/i)).toBeVisible();
}

async function typeIntoActiveSurface(page: Page, text: string, delay = 2) {
  const touchInput = page.getByLabel("Type here");

  if (await touchInput.isVisible().catch(() => false)) {
    await touchInput.pressSequentially(text, { delay });
    return touchInput;
  }

  const captureInput = page.getByTestId("typing-capture-input");
  await expect(captureInput).toBeAttached();
  await page.keyboard.type(text, { delay });
  return captureInput;
}

async function readRawPrompt(page: Page) {
  await expect
    .poll(async () => {
      return (await page.getByTestId("prompt-board").getAttribute("data-prompt-text")) ?? "";
    })
    .not.toBe("");

  return (await page.getByTestId("prompt-board").getAttribute("data-prompt-text")) ?? "";
}

function normalizeTypedValue(value: string) {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, "");
}

async function applyStoredAppearance(
  page: Page,
  appearance: {
    themeChoice: string;
    bodyFontChoice?: string;
    displayFontChoice?: string;
    monoFontChoice?: string;
  },
) {
  await page.goto("/settings");
  await page.evaluate((nextAppearance) => {
    const storageKey = "nullkeys.preferences.v1";
    const currentPreferences = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...currentPreferences,
        onboardingComplete: true,
        ...nextAppearance,
      }),
    );
  }, appearance);
}

test("practice supports the tour, layout switching, content families, and key details", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /save locally and continue/i }).click();

  await dismissPracticeGuide(page);

  const promptText = (await readRawPrompt(page)).trim();
  const partialPrompt = promptText.slice(0, 24);
  const touchInputVisible = await page.getByLabel("Type here").isVisible().catch(() => false);
  if (!touchInputVisible) {
    await page.locator("body").click({ position: { x: 20, y: 20 } });
  }
  const activeSurface = await typeIntoActiveSurface(page, partialPrompt);
  await expect
    .poll(async () => normalizeTypedValue((await activeSurface.inputValue()) ?? ""))
    .toBe(partialPrompt);
  await expect(page.getByTestId("prompt-board")).toContainText("·");

  await expect(page.locator('[data-testid="practice-key-detail-panel"]:visible')).toBeVisible();
  await expect(page.locator('[data-testid="practice-extended-insights"]:visible')).toBeHidden();

  const historyToggle = page
    .locator("details")
    .filter({ hasText: /history/i })
    .locator("summary");
  await expect(historyToggle).toBeVisible();
  await historyToggle.click({ force: true });
  await expect(page.locator('[data-testid="practice-extended-insights"]:visible')).toBeVisible();

  await page.getByRole("button", { name: /switch view/i }).click({ force: true });
  await expect(page.locator('[data-testid="practice-extended-insights"]:visible')).toBeHidden();

  await page.getByRole("button", { name: /switch view/i }).click({ force: true });
  await expect(page.locator('[data-testid="practice-key-detail-panel"]:visible')).toBeHidden();

  await page.getByRole("button", { name: /switch view/i }).click({ force: true });
  await expect(page.locator('[data-testid="practice-key-detail-panel"]:visible')).toBeVisible();
  await expect(page.locator('[data-testid="practice-extended-insights"]:visible')).toBeHidden();

  const reopenedHistoryToggle = page
    .locator("details")
    .filter({ hasText: /history/i })
    .locator("summary");
  await expect(reopenedHistoryToggle).toBeVisible();
  await reopenedHistoryToggle.click({ force: true });
  await expect(page.locator('[data-testid="practice-extended-insights"]:visible')).toBeVisible();

  await page.getByRole("button", { name: "Numbers" }).click({ force: true });
  await expect(page.getByTestId("prompt-board")).toContainText(/\d/);
});

test("settings behaves like a grouped control center with an apply flow", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByTestId("settings-section-lesson")).toBeVisible();
  await expect(page.getByTestId("settings-section-privacy")).toBeVisible();

  await page.getByTestId("theme-option-dracula").click();
  await page.getByLabel("Body font").selectOption("atkinson-hyperlegible");
  await page.getByLabel("Display font").selectOption("ibm-plex-sans");
  await page.getByLabel("Monospace font").selectOption("jetbrains-mono");
  await page.getByLabel("Default practice layout").selectOption("compact");
  await page.getByLabel("Whitespace style").selectOption("bar");
  await page.getByLabel("Keyboard family").selectOption("ansi-full");
  await page.getByLabel("Layout", { exact: true }).selectOption("ansi-us-full");

  const keyboardPreview = page.getByRole("img", { name: /ansi us full keyboard/i });
  await expect(keyboardPreview).toBeVisible();
  const collapsedWidth = await keyboardPreview.evaluate(
    (element) => Number((element as SVGSVGElement).viewBox.baseVal.width),
  );

  await page.locator("label").filter({ hasText: "Numpad emphasis" }).click();
  const expandedWidth = await keyboardPreview.evaluate(
    (element) => Number((element as SVGSVGElement).viewBox.baseVal.width),
  );

  expect(expandedWidth).toBeGreaterThan(collapsedWidth);
  await page.getByRole("button", { name: /save changes/i }).click();

  await page.reload();
  await expect(page.getByLabel("Default practice layout")).toHaveValue("compact");
  await expect(page.getByLabel("Whitespace style")).toHaveValue("bar");
  await expect(page.getByLabel("Body font")).toHaveValue("atkinson-hyperlegible");
  await expect(page.getByLabel("Display font")).toHaveValue("ibm-plex-sans");
  await expect(page.getByLabel("Monospace font")).toHaveValue("jetbrains-mono");

  await page.goto("/practice");
  await expect(page.getByTestId("prompt-board")).toContainText("|");
});

test("guided tour keeps an opaque, readable surface across bundled themes", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /save locally and continue/i }).click();
  await dismissPracticeGuide(page);

  for (const themeId of bundledThemeIds) {
    await page.evaluate((nextThemeId) => {
      const storageKey = "nullkeys.preferences.v1";
      const currentPreferences = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...currentPreferences,
          themeChoice: nextThemeId,
          onboardingComplete: true,
        }),
      );
    }, themeId);

    await page.goto("/practice");
    await page.getByRole("button", { name: /show guided tour/i }).click();

    const dialog = page.getByTestId("practice-guide-dialog");
    await expect(dialog).toBeVisible();

    const styles = await dialog.evaluate((element) => {
      const overlayStyles = getComputedStyle(element);
      const modalElement = element.firstElementChild as HTMLElement | null;
      const modalStyles = modalElement ? getComputedStyle(modalElement) : null;
      const titleElement = modalElement?.querySelector("#practice-guide-title") as HTMLElement | null;
      const titleStyles = titleElement ? getComputedStyle(titleElement) : null;

      return {
        overlayBackground: overlayStyles.backgroundColor,
        modalBackground: modalStyles?.backgroundColor ?? "",
        modalBorderColor: modalStyles?.borderColor ?? "",
        modalTextColor: modalStyles?.color ?? "",
        titleColor: titleStyles?.color ?? "",
      };
    });

    expect(styles.overlayBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.modalBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.modalBorderColor).not.toBe(styles.modalBackground);
    expect(styles.modalTextColor).not.toBe(styles.modalBackground);
    expect(styles.titleColor).not.toBe(styles.modalBackground);

    await page.getByRole("button", { name: /skip tour/i }).click();
    if (await page.getByRole("button", { name: /^done$/i }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /^done$/i }).click();
    }
  }
});

test("bundled themes keep Persian practice on the shaping-safe prompt path", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /save locally and continue/i }).click();
  await dismissPracticeGuide(page);

  for (const themeId of bundledThemeIds) {
    await page.evaluate((nextThemeId) => {
      const storageKey = "nullkeys.preferences.v1";
      const currentPreferences = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...currentPreferences,
          onboardingComplete: true,
          selectedLanguageId: "persian",
          themeChoice: nextThemeId,
        }),
      );
    }, themeId);

    await page.goto("/practice");

    const promptBoard = page.getByTestId("prompt-board");
    await expect(promptBoard).toHaveAttribute("data-prompt-render-mode", "joined-script");
    await expect(promptBoard).toHaveAttribute("lang", "fa");
    await expect
      .poll(async () => await promptBoard.getAttribute("data-prompt-text"))
      .toMatch(/[\u0600-\u06ff]/u);
    await expect(page.getByTestId("practice-keyboard-shell").getByText("ض")).toBeVisible();

    const surfaceStyles = await page.evaluate(() => {
      const prompt = document.querySelector('[data-testid="prompt-board"]') as HTMLElement | null;
      const keyRect = Array.from(
        document.querySelectorAll('[data-testid="practice-keyboard-shell"] svg rect'),
      ).find((rect) => Number(rect.getAttribute("width") ?? "0") < 90);

      return {
        promptColor: prompt ? getComputedStyle(prompt).color : "",
        keyFill: keyRect?.getAttribute("fill") ?? "",
        keyStroke: keyRect?.getAttribute("stroke") ?? "",
      };
    });

    expect(surfaceStyles.promptColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(surfaceStyles.keyFill).toBeTruthy();
    expect(surfaceStyles.keyStroke).toBeTruthy();
    expect(surfaceStyles.keyFill).not.toBe(surfaceStyles.keyStroke);
  }
});

test("live Persian practice keeps joined words intact under current and mismatch feedback", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /save locally and continue/i }).click();
  await dismissPracticeGuide(page);

  await page.evaluate(() => {
    const storageKey = "nullkeys.preferences.v1";
    const currentPreferences = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...currentPreferences,
        onboardingComplete: true,
        selectedLanguageId: "persian",
        whitespaceStyle: "bar",
      }),
    );
  });

  await page.goto("/practice");

  const promptBoard = page.getByTestId("prompt-board");
  const promptText = await readRawPrompt(page);

  await expect(promptBoard).toHaveAttribute("data-prompt-render-mode", "joined-script");
  await expect(promptBoard.locator('[data-joined-script-base="true"]').first()).toBeVisible();
  await expect(promptBoard.locator('[data-prompt-state="current"]').first()).toBeVisible();

  const joinedWords = await promptBoard.locator('[data-joined-script-base="true"]').allTextContents();
  expect(joinedWords.some((word) => /[\u0600-\u06ff]{2,}/u.test(word))).toBe(true);

  if (/\s/u.test(promptText)) {
    await expect(promptBoard.locator('[data-joined-script-space="true"]').first()).toBeVisible();
  }

  const firstJoinedWord = joinedWords.find((word) => /[\u0600-\u06ff]{2,}/u.test(word)) ?? joinedWords[0] ?? "";

  await typeIntoActiveSurface(page, "x", 1);

  await expect(promptBoard.locator('[data-prompt-state="danger"]').first()).toBeVisible();
  await expect(promptBoard.locator('[data-joined-script-base="true"]').first()).toContainText(
    firstJoinedWord,
  );
});

test("practice warns when typed input stays in the wrong script for Persian", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /save locally and continue/i }).click();
  await dismissPracticeGuide(page);

  await page.evaluate(() => {
    const storageKey = "nullkeys.preferences.v1";
    const currentPreferences = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...currentPreferences,
        onboardingComplete: true,
        selectedLanguageId: "persian",
        whitespaceStyle: "bar",
      }),
    );
  });

  await page.goto("/practice");

  const promptText = await readRawPrompt(page);
  const promptBoard = page.getByTestId("prompt-board");
  const persianRecoverySample = Array.from(
    new Set(promptText.match(/[\u0600-\u06ff]/gu) ?? []),
  )
    .slice(0, 6)
    .join("");

  expect(persianRecoverySample.length).toBeGreaterThanOrEqual(4);
  await expect(promptBoard).toHaveAttribute("data-prompt-render-mode", "joined-script");

  await typeIntoActiveSurface(page, "test", 1);
  await expect(page.getByTestId("input-language-warning")).toContainText(
    /typing English\/Latin characters while practicing Persian/i,
  );

  await typeIntoActiveSurface(page, persianRecoverySample, 1);
  await expect(page.getByTestId("input-language-warning")).toBeHidden();
});

test("Persian benchmark review keeps prompt previews right-to-left and readable", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /save locally and continue/i }).click();
  await dismissPracticeGuide(page);

  await page.evaluate(() => {
    const storageKey = "nullkeys.preferences.v1";
    const currentPreferences = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...currentPreferences,
        onboardingComplete: true,
        selectedLanguageId: "persian",
        whitespaceStyle: "none",
      }),
    );
  });

  await page.goto("/typing-test");
  await page.getByRole("button", { name: /test settings/i }).click();
  await page.getByLabel("Typing test text family").selectOption("phrase-drills");
  await page.getByRole("button", { name: /^test$/i }).click();

  const promptText = await readRawPrompt(page);
  await typeIntoActiveSurface(page, promptText, 1);

  const promptPreview = page.getByTestId("benchmark-prompt-preview");
  await expect(page.getByTestId("benchmark-review-panel")).toBeVisible();
  await expect(promptPreview).toHaveAttribute("lang", "fa");
  await expect(promptPreview).toHaveAttribute("dir", "rtl");
  await expect(promptPreview).toContainText(/[\u0600-\u06ff]{2,}/u);
});

test("benchmark produces a completion report with replayable review", async ({ page }) => {
  await page.goto("/typing-test");
  await page.getByRole("button", { name: /test settings/i }).click();
  await expect(page.getByTestId("benchmark-settings-screen")).toBeVisible();
  await expect(page.getByLabel("Typing test duration preset")).toHaveValue(/.+/);
  await page.getByRole("button", { name: /back to test/i }).click();

  const numbersButton = page.getByRole("button", { name: "Numbers" });
  await numbersButton.scrollIntoViewIfNeeded();
  await numbersButton.click({ force: true });

  const promptText = (await readRawPrompt(page)).trim();
  await typeIntoActiveSurface(page, promptText, 1);

  await expect(page.getByTestId("benchmark-report")).toContainText(/most recent local result/i);
  await expect(page.getByTestId("benchmark-review-panel")).toBeVisible();
  await expect(page.getByText(/speed histogram/i)).toBeVisible();
  await expect(page.getByText(/accuracy histogram/i)).toBeVisible();
  await expect(page.getByText(/wpm graph/i)).toBeVisible();
  await expect(page.getByText(/timing distribution/i)).toBeVisible();
  await expect(
    page.getByTestId("benchmark-report").getByRole("button", { name: /replay same prompt/i }),
  ).toBeVisible();
});

test("progress and layouts expose seeded analytics sections", async ({ page }) => {
  await seedDemoProgress(page);

  await page.goto("/profile");
  await expect(page.getByTestId("progress-summary-section")).toBeVisible();
  await expect(page.getByText(/character pressure heatmap/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Speed histogram", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Key frequency heatmap", exact: true })).toBeVisible();

  await page.goto("/layouts");
  await expect(page.getByTestId("layout-comparison-section")).toBeVisible();
  await expect(page.getByText(/language-aware ranking/i)).toBeVisible();
});

test("bundled themes keep shared surfaces readable across practice, settings, profile, and layouts", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seedDemoProgress(page);

  const auditedRoutes = [
    {
      path: "/practice",
      ready: () => page.getByTestId("prompt-board"),
      surface: () => page.getByRole("link", { name: /settings\.\.\./i }),
    },
    {
      path: "/settings",
      ready: () => page.getByTestId("settings-section-misc"),
      surface: () => page.getByTestId("settings-section-misc"),
    },
    {
      path: "/profile",
      ready: () => page.getByTestId("progress-summary-section"),
      surface: () => page.getByTestId("progress-summary-section"),
    },
    {
      path: "/layouts",
      ready: () => page.getByTestId("layout-comparison-section"),
      surface: () => page.getByTestId("layout-comparison-section"),
    },
  ] as const;

  for (const themeId of bundledThemeIds) {
    await applyStoredAppearance(page, {
      themeChoice: themeId,
      bodyFontChoice: "noto-sans",
      displayFontChoice: "ibm-plex-sans",
      monoFontChoice: "noto-sans-mono",
    });

    for (const auditedRoute of auditedRoutes) {
      await page.goto(auditedRoute.path);
      await expect(auditedRoute.ready()).toBeVisible();

      const surfaceStyles = await auditedRoute.surface().evaluate((element) => {
        const styles = getComputedStyle(element as HTMLElement);

        return {
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
          color: styles.color,
        };
      });

      expect(surfaceStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(surfaceStyles.borderColor).not.toBe(surfaceStyles.backgroundColor);
      expect(surfaceStyles.color).not.toBe(surfaceStyles.backgroundColor);
    }
  }
});

test("font preview stays readable for English, Persian, Russian, and Japanese stacks", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const representativeThemes = [
    "legacy-dark",
    "light-paper",
    "solarized-light",
    "catppuccin-mocha",
  ] as const;
  const fontPresets = [
    {
      bodyFontChoice: "system-sans",
      displayFontChoice: "inter",
      monoFontChoice: "system-mono",
    },
    {
      bodyFontChoice: "vazirmatn-friendly",
      displayFontChoice: "ibm-plex-sans",
      monoFontChoice: "noto-sans-mono",
    },
    {
      bodyFontChoice: "noto-sans",
      displayFontChoice: "avenir-ui",
      monoFontChoice: "noto-sans-mono",
    },
  ] as const;

  for (const themeChoice of representativeThemes) {
    for (const fontPreset of fontPresets) {
      await applyStoredAppearance(page, {
        themeChoice,
        ...fontPreset,
      });

      await page.goto("/settings");
      const displaySection = page.getByTestId("settings-section-misc");
      await expect(displaySection).toBeVisible();
      await expect(displaySection.getByText("فارسی", { exact: true })).toBeVisible();
      await expect(displaySection.getByText("Русский", { exact: true })).toBeVisible();
      await expect(displaySection.getByText("日本語", { exact: true })).toBeVisible();

      for (const nativeLabel of ["English", "فارسی", "Русский", "日本語"]) {
        const card = displaySection
          .locator("div.rounded-xl")
          .filter({ hasText: nativeLabel })
          .first();
        await expect(card).toBeVisible();

        const overflowMetrics = await card.evaluate((element) => ({
          clientWidth: (element as HTMLElement).clientWidth,
          scrollWidth: (element as HTMLElement).scrollWidth,
        }));

        expect(overflowMetrics.scrollWidth).toBeLessThanOrEqual(overflowMetrics.clientWidth + 4);
      }
    }
  }
});

test("help and high scores expose the richer secondary product surfaces", async ({ page }) => {
  await seedDemoProgress(page);

  await page.goto("/help");
  await expect(page.getByRole("heading", { name: /how nullkeys teaches/i })).toBeVisible();
  await expect(page.getByText(/lesson cycle/i)).toBeVisible();
  await expect(page.getByText(/finger-zone concept/i)).toBeVisible();

  await page.goto("/high-scores");
  await expect(page.getByRole("heading", { name: /local leaderboard/i })).toBeVisible();
  await expect(page.getByText(/anonymous local typist/i)).toBeVisible();
  await expect(page.getByText(/best typing tests/i)).toBeVisible();
});
