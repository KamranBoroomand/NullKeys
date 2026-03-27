"use client";

import {
  bodyFontChoices,
  getBodyFontDefinition,
  getMonoFontDefinition,
  monoFontChoices,
} from "@/features/user-preferences/font-registry";
import {
  CURRENT_PREFERENCES_SCHEMA_VERSION,
  defaultPracticePreferences,
  type PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import { normalizeVisibleContentFamilyId } from "@/features/content-families/content-family-registry";
import {
  getThemeDefinition,
  themeChoices,
  type ThemeChoice,
} from "@/features/user-preferences/theme-registry";

const PREFERENCES_STORAGE_KEY = "nullkeys.preferences.v1";
const ONBOARDING_COOKIE_NAME = "nullkeys-setup";
const INSTALL_HINT_COOKIE_NAME = "nullkeys-install-hint";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredPreferences() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as Partial<PracticePreferences>;
  } catch {
    return null;
  }
}

function hasStringValue<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
): value is T {
  return value !== undefined && allowedValues.includes(value as T);
}

function hasBooleanValue(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function normalizeNonEmptyString(
  value: unknown,
  fallback: string,
  maxLength = 80,
) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength
    ? value
    : fallback;
}

function normalizeBoundedInteger(
  value: unknown,
  fallback: number,
  bounds: {
    min: number;
    max: number;
  },
) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalizedValue = Math.round(Number(value));

  if (normalizedValue < bounds.min || normalizedValue > bounds.max) {
    return fallback;
  }

  return normalizedValue;
}

export function normalizePracticePreferences(
  storedPreferences: Partial<PracticePreferences> | null,
): PracticePreferences {
  if (!storedPreferences || !isRecord(storedPreferences)) {
    return defaultPracticePreferences;
  }

  const nextPreferences: PracticePreferences = {
    ...defaultPracticePreferences,
    ...storedPreferences,
    schemaVersion: CURRENT_PREFERENCES_SCHEMA_VERSION,
  };

  if (!hasStringValue(nextPreferences.themeChoice, themeChoices)) {
    nextPreferences.themeChoice = defaultPracticePreferences.themeChoice;
  }

  if (
    !hasStringValue(nextPreferences.practicePresentationMode, ["full", "compact", "minimal"])
  ) {
    nextPreferences.practicePresentationMode = defaultPracticePreferences.practicePresentationMode;
  }

  if (!hasStringValue(nextPreferences.whitespaceStyle, ["none", "bar", "bullet"])) {
    nextPreferences.whitespaceStyle = defaultPracticePreferences.whitespaceStyle;
  }

  if (!hasStringValue(nextPreferences.contentSourceBias, ["real", "synthetic", "mixed"])) {
    nextPreferences.contentSourceBias = defaultPracticePreferences.contentSourceBias;
  }

  if (!hasStringValue(nextPreferences.progressionPace, ["measured", "balanced", "accelerated"])) {
    nextPreferences.progressionPace = defaultPracticePreferences.progressionPace;
  }

  if (!hasStringValue(nextPreferences.activeCharacterRange, ["core", "extended", "full"])) {
    nextPreferences.activeCharacterRange = defaultPracticePreferences.activeCharacterRange;
  }

  if (!hasStringValue(nextPreferences.bodyFontChoice, bodyFontChoices)) {
    nextPreferences.bodyFontChoice = defaultPracticePreferences.bodyFontChoice;
  }

  if (!hasStringValue(nextPreferences.displayFontChoice, bodyFontChoices)) {
    nextPreferences.displayFontChoice = defaultPracticePreferences.displayFontChoice;
  }

  if (!hasStringValue(nextPreferences.monoFontChoice, monoFontChoices)) {
    nextPreferences.monoFontChoice = defaultPracticePreferences.monoFontChoice;
  }

  if (!hasStringValue(nextPreferences.devicePreference, ["desktop", "mobile", "hybrid"])) {
    nextPreferences.devicePreference = defaultPracticePreferences.devicePreference;
  }

  if (!hasStringValue(nextPreferences.selectedInputMode, ["hardware", "touch"])) {
    nextPreferences.selectedInputMode = defaultPracticePreferences.selectedInputMode;
  }

  nextPreferences.onboardingComplete = hasBooleanValue(storedPreferences.onboardingComplete)
    ? storedPreferences.onboardingComplete
    : defaultPracticePreferences.onboardingComplete;
  nextPreferences.selectedLanguageId = normalizeNonEmptyString(
    storedPreferences.selectedLanguageId,
    defaultPracticePreferences.selectedLanguageId,
  );
  nextPreferences.selectedKeyboardFamilyId = normalizeNonEmptyString(
    storedPreferences.selectedKeyboardFamilyId,
    defaultPracticePreferences.selectedKeyboardFamilyId,
  );
  nextPreferences.selectedKeyboardLayoutId = normalizeNonEmptyString(
    storedPreferences.selectedKeyboardLayoutId,
    defaultPracticePreferences.selectedKeyboardLayoutId,
  );
  nextPreferences.lessonSpanSeconds = normalizeBoundedInteger(
    storedPreferences.lessonSpanSeconds,
    defaultPracticePreferences.lessonSpanSeconds,
    {
      min: 30,
      max: 600,
    },
  );
  nextPreferences.passageWordGoal = normalizeBoundedInteger(
    storedPreferences.passageWordGoal,
    defaultPracticePreferences.passageWordGoal,
    {
      min: 6,
      max: 160,
    },
  );
  nextPreferences.masterySpeedGoal = normalizeBoundedInteger(
    storedPreferences.masterySpeedGoal,
    defaultPracticePreferences.masterySpeedGoal,
    {
      min: 20,
      max: 400,
    },
  );
  nextPreferences.punctuationEnabled = hasBooleanValue(storedPreferences.punctuationEnabled)
    ? storedPreferences.punctuationEnabled
    : defaultPracticePreferences.punctuationEnabled;
  nextPreferences.capitalizationEnabled = hasBooleanValue(storedPreferences.capitalizationEnabled)
    ? storedPreferences.capitalizationEnabled
    : defaultPracticePreferences.capitalizationEnabled;
  nextPreferences.spaceSkipsWords = hasBooleanValue(storedPreferences.spaceSkipsWords)
    ? storedPreferences.spaceSkipsWords
    : defaultPracticePreferences.spaceSkipsWords;
  nextPreferences.programmerModeEnabled = hasBooleanValue(storedPreferences.programmerModeEnabled)
    ? storedPreferences.programmerModeEnabled
    : defaultPracticePreferences.programmerModeEnabled;
  nextPreferences.retrainWeakCharacters = hasBooleanValue(storedPreferences.retrainWeakCharacters)
    ? storedPreferences.retrainWeakCharacters
    : defaultPracticePreferences.retrainWeakCharacters;
  nextPreferences.numpadEnabled = hasBooleanValue(storedPreferences.numpadEnabled)
    ? storedPreferences.numpadEnabled
    : defaultPracticePreferences.numpadEnabled;
  nextPreferences.touchOptimizationEnabled = hasBooleanValue(
    storedPreferences.touchOptimizationEnabled,
  )
    ? storedPreferences.touchOptimizationEnabled
    : defaultPracticePreferences.touchOptimizationEnabled;
  nextPreferences.soundEnabled = hasBooleanValue(storedPreferences.soundEnabled)
    ? storedPreferences.soundEnabled
    : defaultPracticePreferences.soundEnabled;
  nextPreferences.practiceGuideDismissed = hasBooleanValue(
    storedPreferences.practiceGuideDismissed,
  )
    ? storedPreferences.practiceGuideDismissed
    : defaultPracticePreferences.practiceGuideDismissed;

  nextPreferences.preferredContentFamilyId = normalizeVisibleContentFamilyId(
    nextPreferences.preferredContentFamilyId,
  );

  return nextPreferences;
}

export function loadPracticePreferences() {
  return normalizePracticePreferences(readStoredPreferences());
}

export function savePracticePreferences(preferences: PracticePreferences) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedPreferences = normalizePracticePreferences(preferences);

  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalizedPreferences));
  document.cookie = `${ONBOARDING_COOKIE_NAME}=${normalizedPreferences.onboardingComplete ? "done" : "pending"}; path=/; max-age=${60 * 60 * 24 * 365}`;
  applyAppearancePreferences(normalizedPreferences);
}

export function clearStoredPreferences() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  document.cookie = `${ONBOARDING_COOKIE_NAME}=; path=/; max-age=0`;
  document.cookie = `${INSTALL_HINT_COOKIE_NAME}=; path=/; max-age=0`;
  applyAppearancePreferences(defaultPracticePreferences);
}

export function setInstallHintDismissedCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${INSTALL_HINT_COOKIE_NAME}=dismissed; path=/; max-age=${60 * 60 * 24 * 30}`;
}

export function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  return document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1] ?? null;
}

export function isInstallHintDismissed() {
  return readCookieValue(INSTALL_HINT_COOKIE_NAME) === "dismissed";
}

export function applyThemeChoice(themeChoice: PracticePreferences["themeChoice"]) {
  if (typeof window === "undefined") {
    return;
  }

  const themeDefinition = getThemeDefinition(themeChoice);

  document.documentElement.dataset.theme = themeDefinition.id;
  document.documentElement.classList.toggle("dark", themeDefinition.mode === "dark");
  document.documentElement.style.colorScheme = themeDefinition.mode;

  for (const [variableName, variableValue] of Object.entries(themeDefinition.cssVariables)) {
    document.documentElement.style.setProperty(variableName, variableValue);
  }
}

export function applyFontChoices(options: Pick<
  PracticePreferences,
  "bodyFontChoice" | "displayFontChoice" | "monoFontChoice"
>) {
  if (typeof window === "undefined") {
    return;
  }

  document.documentElement.style.setProperty(
    "--font-body",
    getBodyFontDefinition(options.bodyFontChoice).stack,
  );
  document.documentElement.style.setProperty(
    "--font-display",
    getBodyFontDefinition(options.displayFontChoice).stack,
  );
  document.documentElement.style.setProperty(
    "--font-mono",
    getMonoFontDefinition(options.monoFontChoice).stack,
  );
}

export function applyAppearancePreferences(options: Pick<
  PracticePreferences,
  "themeChoice" | "bodyFontChoice" | "displayFontChoice" | "monoFontChoice"
>) {
  applyThemeChoice(options.themeChoice);
  applyFontChoices(options);
}
