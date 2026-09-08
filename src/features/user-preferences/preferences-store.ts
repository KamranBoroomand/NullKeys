"use client";

import {
  bodyFontChoices,
  getBodyFontDefinition,
  getMonoFontDefinition,
  monoFontChoices,
} from "@/features/user-preferences/font-registry";
import { normalizeVisibleContentFamilyId } from "@/features/content-families/content-family-registry";
import { inferSuggestedPreferences } from "@/features/onboarding-flow/setup-inference";
import { normalizeFirstClassLanguageId } from "@/features/language-support/language-registry";
import {
  CURRENT_PREFERENCES_SCHEMA_VERSION,
  defaultPracticePreferences,
  type PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import {
  getThemeDefinition,
  themeChoices,
} from "@/features/user-preferences/theme-registry";
import { getAppDatabase } from "@/lib/persistence/browser-database";

const LEGACY_PREFERENCES_STORAGE_KEY = "nullkeys.preferences.v1";
const PREFERENCES_SYNC_STORAGE_KEY = "nullkeys.preferences.sync.v2";
const PREFERENCES_CHANNEL_NAME = "nullkeys.preferences.v2";
const ONBOARDING_COOKIE_NAME = "nullkeys-setup";
const INSTALL_HINT_COOKIE_NAME = "nullkeys-install-hint";

export type PreferencesRecordState =
  | "none"
  | "valid"
  | "malformed"
  | "old-version"
  | "partially-valid";

export type PreferencesPersistenceStatus = "idle" | "saving" | "saved" | "failed";

export interface PracticePreferencesStoreSnapshot {
  preferences: PracticePreferences;
  hydrated: boolean;
  recordState: PreferencesRecordState;
  persistenceStatus: PreferencesPersistenceStatus;
  persistenceError: string | null;
}

const serverSnapshot: PracticePreferencesStoreSnapshot = {
  preferences: defaultPracticePreferences,
  hydrated: false,
  recordState: "none",
  persistenceStatus: "idle",
  persistenceError: null,
};

let storeSnapshot = serverSnapshot;
let hydrationPromise: Promise<PracticePreferencesStoreSnapshot> | null = null;
let persistenceQueue = Promise.resolve();
let persistenceRevision = 0;
let preferencesChannel: BroadcastChannel | null = null;
let synchronizationStarted = false;
const storeListeners = new Set<() => void>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringValue<T extends string>(value: unknown, allowedValues: readonly T[]): value is T {
  return typeof value === "string" && allowedValues.includes(value as T);
}

function hasBooleanValue(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function normalizeNonEmptyString(value: unknown, fallback: string, maxLength = 80) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength
    ? value
    : fallback;
}

function normalizeBoundedInteger(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
) {
  if (!Number.isFinite(value)) return fallback;
  const normalizedValue = Math.round(Number(value));
  return normalizedValue >= bounds.min && normalizedValue <= bounds.max
    ? normalizedValue
    : fallback;
}

function readLegacyPreferences(): { state: PreferencesRecordState; value: unknown } {
  if (typeof window === "undefined") return { state: "none", value: null };

  let rawValue: string | null;
  try {
    rawValue = window.localStorage.getItem(LEGACY_PREFERENCES_STORAGE_KEY);
  } catch {
    return { state: "malformed", value: null };
  }

  if (!rawValue) return { state: "none", value: null };

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    return { state: classifyPreferencesRecord(parsedValue), value: parsedValue };
  } catch {
    return { state: "malformed", value: null };
  }
}

function classifyPreferencesRecord(value: unknown): PreferencesRecordState {
  if (!isRecord(value)) return "malformed";
  if (
    typeof value.schemaVersion === "number" &&
    value.schemaVersion < CURRENT_PREFERENCES_SCHEMA_VERSION
  ) {
    return "old-version";
  }
  if (
    typeof value.schemaVersion === "number" &&
    value.schemaVersion > CURRENT_PREFERENCES_SCHEMA_VERSION
  ) {
    return "malformed";
  }

  const preferenceKeys = Object.keys(defaultPracticePreferences);
  if (Object.keys(value).some((key) => !preferenceKeys.includes(key))) return "partially-valid";
  if (preferenceKeys.some((key) => !Object.hasOwn(value, key))) return "partially-valid";

  const normalized = normalizePracticePreferences(value as Partial<PracticePreferences>);
  return preferenceKeys.every((key) => value[key] === normalized[key as keyof PracticePreferences])
    ? "valid"
    : "partially-valid";
}

function publishStoreSnapshot(nextSnapshot: PracticePreferencesStoreSnapshot) {
  storeSnapshot = nextSnapshot;
  for (const listener of storeListeners) listener();
}

function persistenceErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "Browser storage is full. Free space or export and clear old history, then retry.";
  }
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Preferences could not be saved to browser storage.";
}

function updatePreferenceCookies(preferences: PracticePreferences) {
  if (typeof document === "undefined") return;
  document.cookie = `${ONBOARDING_COOKIE_NAME}=${preferences.onboardingComplete ? "done" : "pending"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

function signalPreferenceChange() {
  preferencesChannel?.postMessage("preferences-changed");
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREFERENCES_SYNC_STORAGE_KEY, crypto.randomUUID());
    } catch {
      // BroadcastChannel remains the primary synchronization path when storage is unavailable.
    }
  }
}

async function readPersistedPreferences() {
  const database = await getAppDatabase();
  return (await database.get("preferences", "practice"))?.value as unknown;
}

async function writePersistedPreferences(preferences: PracticePreferences) {
  const database = await getAppDatabase();
  await database.put("preferences", {
    key: "practice",
    value: preferences,
    schemaVersion: CURRENT_PREFERENCES_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  });
}

async function reloadPreferencesFromDatabase() {
  try {
    const persistedValue = await readPersistedPreferences();
    if (!persistedValue) return;
    const recordState = classifyPreferencesRecord(persistedValue);
    if (recordState === "malformed") return;
    const preferences = normalizePracticePreferences(
      persistedValue as Partial<PracticePreferences>,
    );
    applyAppearancePreferences(preferences);
    updatePreferenceCookies(preferences);
    publishStoreSnapshot({
      preferences,
      hydrated: true,
      recordState,
      persistenceStatus: "saved",
      persistenceError: null,
    });
  } catch (error) {
    publishStoreSnapshot({
      ...storeSnapshot,
      hydrated: true,
      persistenceStatus: "failed",
      persistenceError: persistenceErrorMessage(error),
    });
  }
}

function startPreferenceSynchronization() {
  if (synchronizationStarted || typeof window === "undefined") return;
  synchronizationStarted = true;

  if (typeof BroadcastChannel !== "undefined") {
    preferencesChannel = new BroadcastChannel(PREFERENCES_CHANNEL_NAME);
    preferencesChannel.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (event.data === "preferences-changed") void reloadPreferencesFromDatabase();
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === PREFERENCES_SYNC_STORAGE_KEY) void reloadPreferencesFromDatabase();
  });
}

export function normalizePracticePreferences(
  storedPreferences: Partial<PracticePreferences> | null,
): PracticePreferences {
  if (!storedPreferences || !isRecord(storedPreferences)) return defaultPracticePreferences;

  const nextPreferences: PracticePreferences = { ...defaultPracticePreferences };
  nextPreferences.schemaVersion = CURRENT_PREFERENCES_SCHEMA_VERSION;
  nextPreferences.themeChoice = hasStringValue(storedPreferences.themeChoice, themeChoices)
    ? storedPreferences.themeChoice
    : defaultPracticePreferences.themeChoice;
  nextPreferences.practicePresentationMode = hasStringValue(
    storedPreferences.practicePresentationMode,
    ["full", "compact", "minimal"],
  )
    ? storedPreferences.practicePresentationMode
    : defaultPracticePreferences.practicePresentationMode;
  nextPreferences.whitespaceStyle = hasStringValue(storedPreferences.whitespaceStyle, ["none", "bar", "bullet"])
    ? storedPreferences.whitespaceStyle
    : defaultPracticePreferences.whitespaceStyle;
  nextPreferences.contentSourceBias = hasStringValue(storedPreferences.contentSourceBias, ["real", "synthetic", "mixed"])
    ? storedPreferences.contentSourceBias
    : defaultPracticePreferences.contentSourceBias;
  nextPreferences.progressionPace = hasStringValue(storedPreferences.progressionPace, ["measured", "balanced", "accelerated"])
    ? storedPreferences.progressionPace
    : defaultPracticePreferences.progressionPace;
  nextPreferences.activeCharacterRange = hasStringValue(storedPreferences.activeCharacterRange, ["core", "extended", "full"])
    ? storedPreferences.activeCharacterRange
    : defaultPracticePreferences.activeCharacterRange;
  nextPreferences.bodyFontChoice = hasStringValue(storedPreferences.bodyFontChoice, bodyFontChoices)
    ? storedPreferences.bodyFontChoice
    : defaultPracticePreferences.bodyFontChoice;
  nextPreferences.displayFontChoice = hasStringValue(storedPreferences.displayFontChoice, bodyFontChoices)
    ? storedPreferences.displayFontChoice
    : defaultPracticePreferences.displayFontChoice;
  nextPreferences.monoFontChoice = hasStringValue(storedPreferences.monoFontChoice, monoFontChoices)
    ? storedPreferences.monoFontChoice
    : defaultPracticePreferences.monoFontChoice;
  nextPreferences.devicePreference = hasStringValue(storedPreferences.devicePreference, ["desktop", "mobile", "hybrid"])
    ? storedPreferences.devicePreference
    : defaultPracticePreferences.devicePreference;
  nextPreferences.selectedInputMode = hasStringValue(storedPreferences.selectedInputMode, ["hardware", "touch"])
    ? storedPreferences.selectedInputMode
    : defaultPracticePreferences.selectedInputMode;
  nextPreferences.onboardingComplete = hasBooleanValue(storedPreferences.onboardingComplete)
    ? storedPreferences.onboardingComplete
    : defaultPracticePreferences.onboardingComplete;
  nextPreferences.selectedLanguageId = normalizeFirstClassLanguageId(storedPreferences.selectedLanguageId);
  nextPreferences.selectedKeyboardFamilyId = normalizeNonEmptyString(
    storedPreferences.selectedKeyboardFamilyId,
    defaultPracticePreferences.selectedKeyboardFamilyId,
  );
  nextPreferences.selectedKeyboardLayoutId = normalizeNonEmptyString(
    storedPreferences.selectedKeyboardLayoutId,
    defaultPracticePreferences.selectedKeyboardLayoutId,
  );
  nextPreferences.lessonSpanSeconds = normalizeBoundedInteger(storedPreferences.lessonSpanSeconds, defaultPracticePreferences.lessonSpanSeconds, { min: 30, max: 600 });
  nextPreferences.passageWordGoal = normalizeBoundedInteger(storedPreferences.passageWordGoal, defaultPracticePreferences.passageWordGoal, { min: 6, max: 160 });
  nextPreferences.masterySpeedGoal = normalizeBoundedInteger(storedPreferences.masterySpeedGoal, defaultPracticePreferences.masterySpeedGoal, { min: 20, max: 400 });

  for (const key of [
    "punctuationEnabled",
    "capitalizationEnabled",
    "spaceSkipsWords",
    "programmerModeEnabled",
    "retrainWeakCharacters",
    "numpadEnabled",
    "touchOptimizationEnabled",
    "soundEnabled",
    "practiceGuideDismissed",
  ] as const) {
    nextPreferences[key] = hasBooleanValue(storedPreferences[key])
      ? storedPreferences[key]
      : defaultPracticePreferences[key];
  }

  nextPreferences.preferredContentFamilyId = normalizeVisibleContentFamilyId(
    storedPreferences.preferredContentFamilyId,
  );
  return nextPreferences;
}

export function getPracticePreferencesSnapshot() {
  return storeSnapshot;
}

export function getPracticePreferencesServerSnapshot() {
  return serverSnapshot;
}

export function subscribeToPracticePreferences(listener: () => void) {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

export function initializePracticePreferences() {
  if (storeSnapshot.hydrated) return Promise.resolve(storeSnapshot);
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    startPreferenceSynchronization();
    let persistedValue: unknown = null;
    let recordState: PreferencesRecordState = "none";

    try {
      persistedValue = await readPersistedPreferences();
      recordState = persistedValue ? classifyPreferencesRecord(persistedValue) : "none";
    } catch (error) {
      const failedSnapshot = {
        ...storeSnapshot,
        hydrated: true,
        persistenceStatus: "failed" as const,
        persistenceError: persistenceErrorMessage(error),
      };
      publishStoreSnapshot(failedSnapshot);
      return failedSnapshot;
    }

    if (!persistedValue) {
      const legacy = readLegacyPreferences();
      if (legacy.value) {
        persistedValue = legacy.value;
        recordState = legacy.state;
      }
    }

    const inferredPreferences = inferSuggestedPreferences();
    const preferences = persistedValue && recordState !== "malformed"
      ? normalizePracticePreferences(persistedValue as Partial<PracticePreferences>)
      : normalizePracticePreferences({
          ...defaultPracticePreferences,
          ...inferredPreferences,
        });

    applyAppearancePreferences(preferences);
    updatePreferenceCookies(preferences);
    publishStoreSnapshot({
      preferences,
      hydrated: true,
      recordState,
      persistenceStatus: "idle",
      persistenceError: null,
    });

    if (recordState !== "valid") {
      await savePracticePreferences(preferences);
      try {
        window.localStorage.removeItem(LEGACY_PREFERENCES_STORAGE_KEY);
      } catch {
        // The IndexedDB record is authoritative even when legacy cleanup is unavailable.
      }
    }

    return storeSnapshot;
  })().finally(() => {
    hydrationPromise = null;
  });

  return hydrationPromise;
}

export function loadPracticePreferences() {
  return storeSnapshot.preferences;
}

export async function readPracticePreferences() {
  await initializePracticePreferences();
  return storeSnapshot.preferences;
}

export function savePracticePreferences(preferences: PracticePreferences) {
  const saveRevision = ++persistenceRevision;
  const normalizedPreferences = normalizePracticePreferences(preferences);
  applyAppearancePreferences(normalizedPreferences);
  updatePreferenceCookies(normalizedPreferences);
  publishStoreSnapshot({
    ...storeSnapshot,
    preferences: normalizedPreferences,
    hydrated: true,
    persistenceStatus: "saving",
    persistenceError: null,
  });

  const saveOperation = persistenceQueue.then(async () => {
    try {
      await writePersistedPreferences(normalizedPreferences);
      if (saveRevision === persistenceRevision) {
        publishStoreSnapshot({
          ...storeSnapshot,
          persistenceStatus: "saved",
          persistenceError: null,
        });
      }
      signalPreferenceChange();
    } catch (error) {
      if (saveRevision === persistenceRevision) {
        publishStoreSnapshot({
          ...storeSnapshot,
          persistenceStatus: "failed",
          persistenceError: persistenceErrorMessage(error),
        });
      }
      throw error;
    }
  });
  persistenceQueue = saveOperation.catch(() => undefined);
  return saveOperation;
}

export async function clearStoredPreferences() {
  const database = await getAppDatabase();
  await database.delete("preferences", "practice");
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LEGACY_PREFERENCES_STORAGE_KEY);
    } catch {
      // The legacy record is not authoritative.
    }
  }
  if (typeof document !== "undefined") {
    document.cookie = `${ONBOARDING_COOKIE_NAME}=; path=/; max-age=0`;
    document.cookie = `${INSTALL_HINT_COOKIE_NAME}=; path=/; max-age=0`;
  }
  applyAppearancePreferences(defaultPracticePreferences);
  publishStoreSnapshot(serverSnapshot);
  signalPreferenceChange();
}

export async function refreshPracticePreferencesFromStorage() {
  await reloadPreferencesFromDatabase();
  return storeSnapshot;
}

export function resetPracticePreferencesStoreForTests() {
  preferencesChannel?.close();
  preferencesChannel = null;
  synchronizationStarted = false;
  hydrationPromise = null;
  persistenceQueue = Promise.resolve();
  persistenceRevision = 0;
  storeSnapshot = serverSnapshot;
  storeListeners.clear();
}

export function setInstallHintDismissedCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${INSTALL_HINT_COOKIE_NAME}=dismissed; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function readCookieValue(name: string) {
  if (typeof document === "undefined") return null;
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
  if (typeof window === "undefined") return;
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
  if (typeof window === "undefined") return;
  document.documentElement.style.setProperty("--font-body", getBodyFontDefinition(options.bodyFontChoice).stack);
  document.documentElement.style.setProperty("--font-display", getBodyFontDefinition(options.displayFontChoice).stack);
  document.documentElement.style.setProperty("--font-mono", getMonoFontDefinition(options.monoFontChoice).stack);
}

export function applyAppearancePreferences(options: Pick<
  PracticePreferences,
  "themeChoice" | "bodyFontChoice" | "displayFontChoice" | "monoFontChoice"
>) {
  applyThemeChoice(options.themeChoice);
  applyFontChoices(options);
}
