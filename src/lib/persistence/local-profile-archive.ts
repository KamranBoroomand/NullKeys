import {
  clearStoredPreferences,
  readPracticePreferences,
  refreshPracticePreferencesFromStorage,
} from "@/features/user-preferences/preferences-store";
import {
  CURRENT_PREFERENCES_SCHEMA_VERSION,
  type PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import {
  APP_DATABASE_SCHEMA_VERSION,
} from "@/lib/persistence/browser-database";
import {
  assertSafeJsonGraph,
  assertUniqueIds,
  isRecord,
  MAX_ARCHIVE_PROFILES,
  MAX_ARCHIVE_SESSIONS,
  validateLearnerProgressProfile,
  validatePreferences,
  validateSessionRecord,
} from "@/lib/persistence/local-profile-archive-validation";
import {
  clearStoredProfile,
  listAllSessionRecords,
  listLearnerProgressProfiles,
  replaceStoredProfile,
} from "@/lib/persistence/session-repository";
import type { LearnerProgressProfile, SessionRecord } from "@/lib/scoring/session-models";
import {
  CURRENT_ANALYTICS_VERSION,
  CURRENT_SCORING_VERSION,
  migrateSessionRecord,
} from "@/lib/scoring/session-validity";

export interface LocalProfileArchiveSummary {
  sessionCount: number;
  learnerProgressProfileCount: number;
  contentCacheEntryCount: 0;
  preferencesSchemaVersion: number;
}

export interface LocalProfileArchive {
  archiveVersion: number;
  contentType: string;
  appSchemaVersion: number;
  scoringVersion: number;
  analyticsVersion: number;
  createdAt: string;
  summary: LocalProfileArchiveSummary;
  preferences: PracticePreferences;
  sessionRecords: SessionRecord[];
  learnerProgressProfiles: LearnerProgressProfile[];
  integrity: {
    algorithm: "SHA-256";
    digest: string;
  };
}

export const LOCAL_PROFILE_ARCHIVE_VERSION = 2;
export const LOCAL_PROFILE_ARCHIVE_CONTENT_TYPE = "application/vnd.nullkeys.local-profile+json";
export const MAX_LOCAL_PROFILE_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_LEGACY_CACHE_ENTRIES = 5_000;

function invalidArchive(message = "The selected file is not a supported NullKeys local archive."): never {
  throw new Error(message);
}

function assertExactKeys(value: Record<string, unknown>, allowedKeys: readonly string[]) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) invalidArchive();
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 80) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function buildSummary(
  preferences: PracticePreferences,
  sessionRecords: SessionRecord[],
  learnerProgressProfiles: LearnerProgressProfile[],
): LocalProfileArchiveSummary {
  return {
    sessionCount: sessionRecords.length,
    learnerProgressProfileCount: learnerProgressProfiles.length,
    contentCacheEntryCount: 0,
    preferencesSchemaVersion: preferences.schemaVersion,
  };
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

function normalizeJsonPayload<T>(value: T): T {
  const serializedValue = JSON.stringify(value);

  if (serializedValue === undefined) {
    throw new Error("The local archive contains data that cannot be exported as JSON.");
  }

  return JSON.parse(serializedValue) as T;
}

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser cannot verify archive integrity.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function archivePayloadWithoutIntegrity(archive: Omit<LocalProfileArchive, "integrity"> | LocalProfileArchive) {
  return {
    archiveVersion: archive.archiveVersion,
    contentType: archive.contentType,
    appSchemaVersion: archive.appSchemaVersion,
    scoringVersion: archive.scoringVersion,
    analyticsVersion: archive.analyticsVersion,
    createdAt: archive.createdAt,
    summary: archive.summary,
    preferences: archive.preferences,
    sessionRecords: archive.sessionRecords,
    learnerProgressProfiles: archive.learnerProgressProfiles,
  };
}

async function attachIntegrity(
  payload: Omit<LocalProfileArchive, "integrity">,
): Promise<LocalProfileArchive> {
  const normalizedPayload = normalizeJsonPayload(payload);

  return {
    ...normalizedPayload,
    integrity: {
      algorithm: "SHA-256",
      digest: await sha256Hex(canonicalize(normalizedPayload)),
    },
  };
}

export async function buildLocalProfileArchive(): Promise<LocalProfileArchive> {
  const [preferences, sessionRecords, learnerProgressProfiles] = await Promise.all([
    readPracticePreferences(),
    listAllSessionRecords(),
    listLearnerProgressProfiles(),
  ]);
  const payload: Omit<LocalProfileArchive, "integrity"> = {
    archiveVersion: LOCAL_PROFILE_ARCHIVE_VERSION,
    contentType: LOCAL_PROFILE_ARCHIVE_CONTENT_TYPE,
    appSchemaVersion: APP_DATABASE_SCHEMA_VERSION,
    scoringVersion: CURRENT_SCORING_VERSION,
    analyticsVersion: CURRENT_ANALYTICS_VERSION,
    createdAt: new Date().toISOString(),
    summary: buildSummary(preferences, sessionRecords, learnerProgressProfiles),
    preferences,
    sessionRecords,
    learnerProgressProfiles,
  };
  return attachIntegrity(payload);
}

function validateCollections(
  sessionRecords: unknown,
  learnerProgressProfiles: unknown,
  requireCurrentFields: boolean,
) {
  if (!Array.isArray(sessionRecords) || sessionRecords.length > MAX_ARCHIVE_SESSIONS) {
    invalidArchive("The selected archive contains too many session records.");
  }
  if (!Array.isArray(learnerProgressProfiles) || learnerProgressProfiles.length > MAX_ARCHIVE_PROFILES) {
    invalidArchive("The selected archive contains too many learner profiles.");
  }

  sessionRecords.forEach((sessionRecord) => validateSessionRecord(sessionRecord, requireCurrentFields));
  learnerProgressProfiles.forEach(validateLearnerProgressProfile);
  assertUniqueIds(
    (sessionRecords as SessionRecord[]).map((session) => session.sessionId),
    "session records",
  );
  assertUniqueIds(
    (learnerProgressProfiles as LearnerProgressProfile[]).map((profile) => profile.progressionId),
    "learner profiles",
  );
}

async function normalizeCurrentArchive(parsedPayload: Record<string, unknown>) {
  assertExactKeys(parsedPayload, [
    "archiveVersion", "contentType", "appSchemaVersion", "scoringVersion",
    "analyticsVersion", "createdAt", "summary", "preferences", "sessionRecords",
    "learnerProgressProfiles", "integrity",
  ]);
  if (parsedPayload.contentType !== LOCAL_PROFILE_ARCHIVE_CONTENT_TYPE) invalidArchive();
  if (!Number.isInteger(parsedPayload.appSchemaVersion) || Number(parsedPayload.appSchemaVersion) > APP_DATABASE_SCHEMA_VERSION) {
    invalidArchive("The selected archive was created by a newer NullKeys data schema.");
  }
  if (parsedPayload.scoringVersion !== CURRENT_SCORING_VERSION || parsedPayload.analyticsVersion !== CURRENT_ANALYTICS_VERSION) {
    invalidArchive("The selected archive uses an incompatible scoring or analytics model.");
  }
  if (!isExactIsoTimestamp(parsedPayload.createdAt)) invalidArchive();
  if (!isRecord(parsedPayload.integrity)) invalidArchive();
  assertExactKeys(parsedPayload.integrity, ["algorithm", "digest"]);
  if (
    parsedPayload.integrity.algorithm !== "SHA-256" ||
    typeof parsedPayload.integrity.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(parsedPayload.integrity.digest)
  ) invalidArchive("The selected archive has invalid integrity metadata.");

  const candidate = parsedPayload as unknown as LocalProfileArchive;
  const normalizedPayload = normalizeJsonPayload(archivePayloadWithoutIntegrity(candidate));
  const actualDigest = await sha256Hex(canonicalize(normalizedPayload));
  if (actualDigest !== candidate.integrity.digest) {
    invalidArchive("The selected archive failed its integrity check.");
  }

  const preferences = validatePreferences(parsedPayload.preferences);
  validateCollections(parsedPayload.sessionRecords, parsedPayload.learnerProgressProfiles, true);
  if (!isRecord(parsedPayload.summary)) invalidArchive();
  assertExactKeys(parsedPayload.summary, [
    "sessionCount", "learnerProgressProfileCount", "contentCacheEntryCount",
    "preferencesSchemaVersion",
  ]);
  const expectedSummary = buildSummary(
    preferences,
    parsedPayload.sessionRecords as SessionRecord[],
    parsedPayload.learnerProgressProfiles as LearnerProgressProfile[],
  );
  if (canonicalize(parsedPayload.summary) !== canonicalize(expectedSummary)) {
    invalidArchive("The selected archive summary does not match its contents.");
  }
  return candidate;
}

async function migrateLegacyArchive(parsedPayload: Record<string, unknown>) {
  assertExactKeys(parsedPayload, [
    "archiveVersion", "contentType", "appSchemaVersion", "createdAt", "summary",
    "preferences", "sessionRecords", "learnerProgressProfiles", "contentCacheEntries",
  ]);
  if (
    parsedPayload.contentType !== undefined &&
    parsedPayload.contentType !== LOCAL_PROFILE_ARCHIVE_CONTENT_TYPE
  ) invalidArchive();
  if (
    typeof parsedPayload.appSchemaVersion === "number" &&
    parsedPayload.appSchemaVersion > APP_DATABASE_SCHEMA_VERSION
  ) invalidArchive("The selected archive was created by a newer NullKeys data schema.");
  if (parsedPayload.createdAt !== undefined && !isExactIsoTimestamp(parsedPayload.createdAt)) invalidArchive();
  if (!Array.isArray(parsedPayload.contentCacheEntries) || parsedPayload.contentCacheEntries.length > MAX_LEGACY_CACHE_ENTRIES) invalidArchive();
  for (const cacheEntry of parsedPayload.contentCacheEntries) {
    if (!isRecord(cacheEntry)) invalidArchive();
    assertExactKeys(cacheEntry, ["cacheKey", "payload", "savedAt"]);
    if (typeof cacheEntry.cacheKey !== "string" || cacheEntry.cacheKey.length > 256 || !isExactIsoTimestamp(cacheEntry.savedAt)) invalidArchive();
  }

  const preferences = validatePreferences(parsedPayload.preferences);
  validateCollections(parsedPayload.sessionRecords, parsedPayload.learnerProgressProfiles, false);
  const sessionRecords = (parsedPayload.sessionRecords as SessionRecord[]).map(migrateSessionRecord);
  const learnerProgressProfiles = parsedPayload.learnerProgressProfiles as LearnerProgressProfile[];
  return attachIntegrity({
    archiveVersion: LOCAL_PROFILE_ARCHIVE_VERSION,
    contentType: LOCAL_PROFILE_ARCHIVE_CONTENT_TYPE,
    appSchemaVersion: APP_DATABASE_SCHEMA_VERSION,
    scoringVersion: CURRENT_SCORING_VERSION,
    analyticsVersion: CURRENT_ANALYTICS_VERSION,
    createdAt: isExactIsoTimestamp(parsedPayload.createdAt)
      ? parsedPayload.createdAt
      : new Date().toISOString(),
    summary: buildSummary(preferences, sessionRecords, learnerProgressProfiles),
    preferences,
    sessionRecords,
    learnerProgressProfiles,
  });
}

export async function parseLocalProfileArchive(rawPayload: string): Promise<LocalProfileArchive> {
  const payloadBytes = new TextEncoder().encode(rawPayload).length;
  if (payloadBytes > MAX_LOCAL_PROFILE_ARCHIVE_BYTES) {
    invalidArchive("The selected file is too large to import safely.");
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawPayload);
  } catch {
    invalidArchive("The selected file is not valid JSON.");
  }
  assertSafeJsonGraph(parsedPayload);
  if (!isRecord(parsedPayload)) invalidArchive();

  if (parsedPayload.archiveVersion === LOCAL_PROFILE_ARCHIVE_VERSION) {
    return normalizeCurrentArchive(parsedPayload);
  }
  if (parsedPayload.archiveVersion === 1) {
    return migrateLegacyArchive(parsedPayload);
  }
  invalidArchive();
}

export async function restoreLocalProfileArchive(archive: LocalProfileArchive) {
  const normalizedArchive = await parseLocalProfileArchive(JSON.stringify(archive));
  await replaceStoredProfile({
    preferences: normalizedArchive.preferences,
    sessionRecords: normalizedArchive.sessionRecords,
    learnerProgressProfiles: normalizedArchive.learnerProgressProfiles,
  });
  await refreshPracticePreferencesFromStorage();
}

export async function resetAllLocalData() {
  await clearStoredProfile();
  await clearStoredPreferences();
}
