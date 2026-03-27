import {
  clearStoredPreferences,
  loadPracticePreferences,
  normalizePracticePreferences,
  savePracticePreferences,
} from "@/features/user-preferences/preferences-store";
import {
  clearStoredHistory,
  listContentCacheEntries,
  listLearnerProgressProfiles,
  listSessionRecords,
  replaceStoredHistory,
} from "@/lib/persistence/session-repository";
import { APP_DATABASE_SCHEMA_VERSION } from "@/lib/persistence/browser-database";
import {
  CURRENT_PREFERENCES_SCHEMA_VERSION,
  type PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import type { LearnerProgressProfile, SessionRecord } from "@/lib/scoring/session-models";

export interface LocalProfileArchive {
  archiveVersion: number;
  appSchemaVersion: number;
  createdAt: string;
  summary: {
    sessionCount: number;
    learnerProgressProfileCount: number;
    contentCacheEntryCount: number;
    preferencesSchemaVersion: number;
  };
  preferences: PracticePreferences;
  sessionRecords: SessionRecord[];
  learnerProgressProfiles: LearnerProgressProfile[];
  contentCacheEntries: Array<{
    cacheKey: string;
    payload: unknown;
    savedAt: string;
  }>;
}

export const LOCAL_PROFILE_ARCHIVE_VERSION = 1;
export const MAX_LOCAL_PROFILE_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVED_SESSION_RECORDS = 10_000;
const MAX_ARCHIVED_LEARNER_PROGRESS_PROFILES = 512;
const MAX_ARCHIVED_CONTENT_CACHE_ENTRIES = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength = 4_096): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isIsoDateString(value: unknown): value is string {
  return isNonEmptyString(value, 80) && Number.isFinite(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isStringArray(value: unknown, maxEntries = 512): value is string[] {
  return Array.isArray(value) && value.length <= maxEntries && value.every((entry) => typeof entry === "string");
}

function isValidSessionRecord(value: unknown): value is SessionRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.sessionId, 160) &&
    (value.sessionKind === "adaptive" || value.sessionKind === "benchmark") &&
    (value.sessionFlavor === "plain" ||
      value.sessionFlavor === "symbols" ||
      value.sessionFlavor === "numbers" ||
      value.sessionFlavor === "code" ||
      value.sessionFlavor === "mixed") &&
    isNonEmptyString(value.languageId, 80) &&
    isNonEmptyString(value.keyboardFamilyId, 80) &&
    isNonEmptyString(value.keyboardLayoutId, 80) &&
    (value.inputMode === "hardware" || value.inputMode === "touch") &&
    typeof value.promptText === "string" &&
    typeof value.typedText === "string" &&
    isIsoDateString(value.startedAt) &&
    isIsoDateString(value.endedAt) &&
    typeof value.completed === "boolean" &&
    isStringArray(value.priorityCharacters, 512) &&
    isStringArray(value.activeCharacterSet, 512) &&
    isStringArray(value.unlockedCharacters, 1_024) &&
    Array.isArray(value.attemptLog) &&
    isRecord(value.perCharacterPerformance) &&
    Number.isFinite(value.grossWpm) &&
    Number.isFinite(value.netWpm) &&
    Number.isFinite(value.accuracy) &&
    isNonNegativeInteger(value.correctedErrorCount) &&
    isNonNegativeInteger(value.uncorrectedErrorCount) &&
    isNonNegativeInteger(value.durationMs) &&
    (value.benchmarkDurationSeconds === undefined || isNonNegativeInteger(value.benchmarkDurationSeconds))
  );
}

function isValidLearnerProgressProfile(value: unknown): value is LearnerProgressProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.progressionId, 160) &&
    isNonEmptyString(value.languageId, 80) &&
    isNonEmptyString(value.keyboardLayoutId, 80) &&
    (value.inputMode === "hardware" || value.inputMode === "touch") &&
    typeof value.programmerModeEnabled === "boolean" &&
    isNonNegativeInteger(value.currentStageIndex) &&
    isStringArray(value.activeCharacterSet, 512) &&
    isStringArray(value.unlockedCharacters, 1_024) &&
    isStringArray(value.newlyUnlockedCharacters, 512) &&
    isStringArray(value.reinforcementCharacters, 512) &&
    isStringArray(value.stableCharacters, 1_024) &&
    isStringArray(value.recoveryCharacters, 512) &&
    isStringArray(value.unlockPreviewCharacters, 512) &&
    typeof value.regressionHold === "boolean" &&
    Number.isFinite(value.recentReadinessScore) &&
    Number.isFinite(value.recentStabilityScore) &&
    isNonNegativeInteger(value.completedAdaptiveSessions) &&
    Array.isArray(value.milestoneHistory) &&
    isIsoDateString(value.updatedAt) &&
    isNonNegativeInteger(value.version)
  );
}

function isValidContentCacheEntry(
  value: unknown,
): value is LocalProfileArchive["contentCacheEntries"][number] {
  return (
    isRecord(value) &&
    isNonEmptyString(value.cacheKey, 256) &&
    isIsoDateString(value.savedAt)
  );
}

function assertArchiveLimit(
  entries: unknown[],
  maxEntries: number,
) {
  return entries.length <= maxEntries;
}

function buildArchiveSummary(options: {
  sessionRecords: SessionRecord[];
  learnerProgressProfiles: LearnerProgressProfile[];
  contentCacheEntries: LocalProfileArchive["contentCacheEntries"];
  preferencesSchemaVersion: number;
}) {
  return {
    sessionCount: options.sessionRecords.length,
    learnerProgressProfileCount: options.learnerProgressProfiles.length,
    contentCacheEntryCount: options.contentCacheEntries.length,
    preferencesSchemaVersion: options.preferencesSchemaVersion,
  };
}

export async function buildLocalProfileArchive(): Promise<LocalProfileArchive> {
  const [sessionRecords, learnerProgressProfiles, contentCacheEntries] = await Promise.all([
    listSessionRecords(10_000),
    listLearnerProgressProfiles(),
    listContentCacheEntries(),
  ]);

  return {
    archiveVersion: LOCAL_PROFILE_ARCHIVE_VERSION,
    appSchemaVersion: APP_DATABASE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    summary: {
      sessionCount: sessionRecords.length,
      learnerProgressProfileCount: learnerProgressProfiles.length,
      contentCacheEntryCount: contentCacheEntries.length,
      preferencesSchemaVersion: CURRENT_PREFERENCES_SCHEMA_VERSION,
    },
    preferences: loadPracticePreferences(),
    sessionRecords,
    learnerProgressProfiles,
    contentCacheEntries,
  };
}

function normalizeLocalProfileArchive(
  parsedPayload: Partial<LocalProfileArchive>,
): LocalProfileArchive {
  if (!parsedPayload || typeof parsedPayload !== "object") {
    throw new Error("The selected file is not a supported NullKeys local archive.");
  }

  if (!isRecord(parsedPayload.preferences)) {
    throw new Error("The selected file is not a supported NullKeys local archive.");
  }

  if (
    !Array.isArray(parsedPayload.sessionRecords) ||
    !Array.isArray(parsedPayload.learnerProgressProfiles) ||
    !Array.isArray(parsedPayload.contentCacheEntries)
  ) {
    throw new Error("The selected file is not a supported NullKeys local archive.");
  }

  if (
    !assertArchiveLimit(parsedPayload.sessionRecords, MAX_ARCHIVED_SESSION_RECORDS) ||
    !assertArchiveLimit(
      parsedPayload.learnerProgressProfiles,
      MAX_ARCHIVED_LEARNER_PROGRESS_PROFILES,
    ) ||
    !assertArchiveLimit(parsedPayload.contentCacheEntries, MAX_ARCHIVED_CONTENT_CACHE_ENTRIES)
  ) {
    throw new Error("The selected file is too large to import safely.");
  }

  if (
    !parsedPayload.sessionRecords.every((sessionRecord) => isValidSessionRecord(sessionRecord)) ||
    !parsedPayload.learnerProgressProfiles.every((profile) => isValidLearnerProgressProfile(profile)) ||
    !parsedPayload.contentCacheEntries.every((cacheEntry) => isValidContentCacheEntry(cacheEntry))
  ) {
    throw new Error("The selected file is not a supported NullKeys local archive.");
  }

  const preferences = normalizePracticePreferences(
    parsedPayload.preferences as Partial<PracticePreferences>,
  );
  const sessionRecords = parsedPayload.sessionRecords as SessionRecord[];
  const learnerProgressProfiles =
    parsedPayload.learnerProgressProfiles as LearnerProgressProfile[];
  const contentCacheEntries =
    parsedPayload.contentCacheEntries as LocalProfileArchive["contentCacheEntries"];
  const createdAt = isIsoDateString(parsedPayload.createdAt)
    ? parsedPayload.createdAt
    : new Date().toISOString();
  const summary = buildArchiveSummary({
    sessionRecords,
    learnerProgressProfiles,
    contentCacheEntries,
    preferencesSchemaVersion: preferences.schemaVersion,
  });

  if (parsedPayload.archiveVersion !== LOCAL_PROFILE_ARCHIVE_VERSION) {
    throw new Error("The selected file is not a supported NullKeys local archive.");
  }

  return {
    archiveVersion: LOCAL_PROFILE_ARCHIVE_VERSION,
    appSchemaVersion:
      isNonNegativeInteger(parsedPayload.appSchemaVersion)
        ? parsedPayload.appSchemaVersion
        : APP_DATABASE_SCHEMA_VERSION,
    createdAt,
    summary,
    preferences,
    sessionRecords,
    learnerProgressProfiles,
    contentCacheEntries,
  };
}

export function parseLocalProfileArchive(rawPayload: string): LocalProfileArchive {
  const payloadBytes = new TextEncoder().encode(rawPayload).length;

  if (payloadBytes > MAX_LOCAL_PROFILE_ARCHIVE_BYTES) {
    throw new Error("The selected file is too large to import safely.");
  }

  try {
    const parsedPayload = JSON.parse(rawPayload) as Partial<LocalProfileArchive>;
    return normalizeLocalProfileArchive(parsedPayload);
  } catch (error) {
    if (error instanceof Error && error.message.includes("supported NullKeys local archive")) {
      throw error;
    }

    throw new Error("The selected file is not valid JSON.");
  }
}

export async function restoreLocalProfileArchive(archive: LocalProfileArchive) {
  await clearStoredHistory();
  await replaceStoredHistory({
    sessionRecords: archive.sessionRecords,
    learnerProgressProfiles: archive.learnerProgressProfiles,
    contentCacheEntries: archive.contentCacheEntries,
  });
  savePracticePreferences(archive.preferences);
}

export async function resetAllLocalData() {
  await clearStoredHistory();
  clearStoredPreferences();
}
