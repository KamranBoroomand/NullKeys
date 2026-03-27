import {
  applyAppearancePreferences,
  applyThemeChoice,
  clearStoredPreferences,
  loadPracticePreferences,
  savePracticePreferences,
} from "@/features/user-preferences/preferences-store";
import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";

describe("preferences store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = "nullkeys-setup=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("persists and reloads local-only practice preferences", () => {
    savePracticePreferences({
      ...defaultPracticePreferences,
      onboardingComplete: true,
      selectedLanguageId: "thai",
      selectedKeyboardLayoutId: "touch-android-standard",
      selectedInputMode: "touch",
    });

    const reloadedPreferences = loadPracticePreferences();

    expect(reloadedPreferences.selectedLanguageId).toBe("thai");
    expect(reloadedPreferences.selectedKeyboardLayoutId).toBe("touch-android-standard");
    expect(document.cookie).toContain("nullkeys-setup=done");
    expect(reloadedPreferences.schemaVersion).toBe(defaultPracticePreferences.schemaVersion);
  });

  it("applies theme choice directly to the document root", () => {
    applyThemeChoice("legacy-dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("legacy-dark");

    applyThemeChoice("light-paper");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("light-paper");
  });

  it("applies local font preferences to the document root", () => {
    applyAppearancePreferences({
      ...defaultPracticePreferences,
      themeChoice: "nullkeys-classic",
      bodyFontChoice: "vazirmatn-friendly",
      displayFontChoice: "atkinson-hyperlegible",
      monoFontChoice: "jetbrains-mono",
    });

    expect(document.documentElement.style.getPropertyValue("--font-body")).toContain("Vazirmatn");
    expect(document.documentElement.style.getPropertyValue("--font-display")).toContain(
      "Atkinson Hyperlegible",
    );
    expect(document.documentElement.style.getPropertyValue("--font-mono")).toContain(
      "JetBrains Mono",
    );
  });

  it("clears stored preferences and onboarding hints", () => {
    savePracticePreferences({
      ...defaultPracticePreferences,
      onboardingComplete: true,
      selectedLanguageId: "russian",
      themeChoice: "legacy-dark",
    });

    clearStoredPreferences();

    expect(window.localStorage.getItem("nullkeys.preferences.v1")).toBeNull();
    expect(document.cookie).not.toContain("nullkeys-setup=done");
    expect(document.documentElement.classList.contains("dark")).toBe(
      defaultPracticePreferences.themeChoice === "legacy-dark",
    );
  });

  it("ignores obsolete pre-release preference keys", () => {
    window.localStorage.setItem(
      "pre-release.preferences.v1",
      JSON.stringify({
        onboardingComplete: true,
        selectedLanguageId: "russian",
        whitespaceStyle: "bar",
        themeChoice: "dark",
      }),
    );

    const reloadedPreferences = loadPracticePreferences();

    expect(reloadedPreferences.selectedLanguageId).toBe(defaultPracticePreferences.selectedLanguageId);
    expect(reloadedPreferences.whitespaceStyle).toBe(defaultPracticePreferences.whitespaceStyle);
    expect(reloadedPreferences.themeChoice).toBe(defaultPracticePreferences.themeChoice);
    expect(reloadedPreferences.schemaVersion).toBe(defaultPracticePreferences.schemaVersion);
  });

  it("normalizes hidden books preferences back to visible phrase drills", () => {
    savePracticePreferences({
      ...defaultPracticePreferences,
      preferredContentFamilyId: "quote-drills",
    });

    const reloadedPreferences = loadPracticePreferences();

    expect(reloadedPreferences.preferredContentFamilyId).toBe("phrase-drills");
  });

  it("falls back safely when local storage contains corrupted primitive values", () => {
    window.localStorage.setItem(
      "nullkeys.preferences.v1",
      JSON.stringify({
        onboardingComplete: "yes",
        selectedLanguageId: "",
        selectedKeyboardLayoutId: { bad: true },
        lessonSpanSeconds: 9_999,
        passageWordGoal: -5,
        masterySpeedGoal: "fast",
        punctuationEnabled: "sometimes",
        soundEnabled: "loud",
        themeChoice: "not-a-real-theme",
      }),
    );

    const reloadedPreferences = loadPracticePreferences();

    expect(reloadedPreferences.onboardingComplete).toBe(defaultPracticePreferences.onboardingComplete);
    expect(reloadedPreferences.selectedLanguageId).toBe(defaultPracticePreferences.selectedLanguageId);
    expect(reloadedPreferences.selectedKeyboardLayoutId).toBe(
      defaultPracticePreferences.selectedKeyboardLayoutId,
    );
    expect(reloadedPreferences.lessonSpanSeconds).toBe(defaultPracticePreferences.lessonSpanSeconds);
    expect(reloadedPreferences.passageWordGoal).toBe(defaultPracticePreferences.passageWordGoal);
    expect(reloadedPreferences.masterySpeedGoal).toBe(defaultPracticePreferences.masterySpeedGoal);
    expect(reloadedPreferences.punctuationEnabled).toBe(defaultPracticePreferences.punctuationEnabled);
    expect(reloadedPreferences.soundEnabled).toBe(defaultPracticePreferences.soundEnabled);
    expect(reloadedPreferences.themeChoice).toBe(defaultPracticePreferences.themeChoice);
  });
});
