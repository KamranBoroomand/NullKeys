import {
  getAppDatabase,
  APP_DATABASE_SCHEMA_VERSION,
} from "@/lib/persistence/browser-database";
import {
  CURRENT_PREFERENCES_SCHEMA_VERSION,
  type PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import type {
  AnalyticsSnapshot,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";
import {
  isPracticeAnalyticsEligibleSession,
  migrateSessionRecord,
} from "@/lib/scoring/session-validity";

export async function saveSessionRecord(sessionRecord: SessionRecord) {
  const database = await getAppDatabase();
  const transaction = database.transaction(["typingSessions", "analyticsSnapshots"], "readwrite");
  const normalizedSessionRecord = migrateSessionRecord(sessionRecord);
  const snapshot: AnalyticsSnapshot = {
    snapshotId: `${normalizedSessionRecord.sessionId}-snapshot`,
    sessionId: normalizedSessionRecord.sessionId,
    sessionKind: normalizedSessionRecord.sessionKind,
    languageId: normalizedSessionRecord.languageId,
    keyboardLayoutId: normalizedSessionRecord.keyboardLayoutId,
    savedAt: normalizedSessionRecord.endedAt,
    perCharacterPerformance: normalizedSessionRecord.perCharacterPerformance,
  };

  await transaction.objectStore("typingSessions").put(normalizedSessionRecord);

  if (isPracticeAnalyticsEligibleSession(normalizedSessionRecord)) {
    await transaction.objectStore("analyticsSnapshots").put(snapshot);
  } else {
    await transaction.objectStore("analyticsSnapshots").delete(snapshot.snapshotId);
  }
  await transaction.done;
}

export async function listSessionRecords(limit = 120) {
  const database = await getAppDatabase();
  const sessionRecords = await database.getAll("typingSessions");

  return sessionRecords
    .filter(isPlausibleStoredSessionRecord)
    .map(migrateSessionRecord)
    .sort(
      (left, right) =>
        new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime(),
    )
    .slice(0, limit);
}

export function listAllSessionRecords() {
  return listSessionRecords(Number.POSITIVE_INFINITY);
}

export async function listAnalyticsSnapshots(limit = 240) {
  const database = await getAppDatabase();
  const snapshots = await database.getAll("analyticsSnapshots");

  return snapshots
    .sort(
      (left, right) =>
        new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime(),
    )
    .slice(0, limit);
}

export async function listLearnerProgressProfiles() {
  const database = await getAppDatabase();
  return database.getAll("progressionProfiles");
}

export async function saveLearnerProgressProfile(
  learnerProgressProfile: LearnerProgressProfile,
) {
  const database = await getAppDatabase();
  await database.put("progressionProfiles", learnerProgressProfile);
}

export async function readLearnerProgressProfile(progressionId: string) {
  const database = await getAppDatabase();
  return (await database.get("progressionProfiles", progressionId)) ?? null;
}

export async function saveContentCacheEntry(cacheKey: string, payload: unknown) {
  if (!/^content-pack:[a-z0-9._:-]+$/i.test(cacheKey) || cacheKey.length > 256) {
    throw new Error("Invalid content-cache key.");
  }

  const serializedPayload = JSON.stringify(payload);
  if (serializedPayload === undefined || serializedPayload.length > 5 * 1024 * 1024) {
    throw new Error("Content-cache payload exceeds the safe local limit.");
  }

  const database = await getAppDatabase();

  await database.put("contentCache", {
    cacheKey,
    payload,
    savedAt: new Date().toISOString(),
  });
}

export async function readContentCacheEntry<T>(cacheKey: string) {
  const database = await getAppDatabase();
  const record = await database.get("contentCache", cacheKey);

  return (record?.payload as T | undefined) ?? null;
}

export async function listContentCacheEntries() {
  const database = await getAppDatabase();
  return database.getAll("contentCache");
}

export async function removeContentCacheEntries(cacheKeys: string[]) {
  if (cacheKeys.length === 0) {
    return;
  }

  const database = await getAppDatabase();
  const transaction = database.transaction("contentCache", "readwrite");

  await Promise.all(cacheKeys.map((cacheKey) => transaction.store.delete(cacheKey)));
  await transaction.done;
}

export async function readAppMetaValue(key: string) {
  const database = await getAppDatabase();
  return (await database.get("appMeta", key))?.value ?? null;
}

export async function clearStoredHistory() {
  const database = await getAppDatabase();
  const transaction = database.transaction(
    ["typingSessions", "analyticsSnapshots", "progressionProfiles", "contentCache"],
    "readwrite",
  );

  await Promise.all([
    transaction.objectStore("typingSessions").clear(),
    transaction.objectStore("analyticsSnapshots").clear(),
    transaction.objectStore("progressionProfiles").clear(),
    transaction.objectStore("contentCache").clear(),
  ]);
  await transaction.done;
}

export async function clearStoredProfile() {
  const database = await getAppDatabase();
  const transaction = database.transaction(
    ["typingSessions", "analyticsSnapshots", "progressionProfiles", "contentCache", "preferences"],
    "readwrite",
  );

  await Promise.all([
    transaction.objectStore("typingSessions").clear(),
    transaction.objectStore("analyticsSnapshots").clear(),
    transaction.objectStore("progressionProfiles").clear(),
    transaction.objectStore("contentCache").clear(),
    transaction.objectStore("preferences").clear(),
  ]);
  await transaction.done;
}

export type ProfileReplacementFaultStage =
  | "after-clear"
  | "after-sessions"
  | "after-profiles"
  | "before-commit";

function isPlausibleStoredSessionRecord(value: unknown): value is SessionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<SessionRecord>;
  return (
    typeof record.sessionId === "string" &&
    (record.sessionKind === "adaptive" || record.sessionKind === "benchmark") &&
    typeof record.startedAt === "string" &&
    Number.isFinite(Date.parse(record.startedAt)) &&
    typeof record.endedAt === "string" &&
    Number.isFinite(Date.parse(record.endedAt)) &&
    Array.isArray(record.attemptLog) &&
    record.perCharacterPerformance !== null &&
    typeof record.perCharacterPerformance === "object"
  );
}

export async function replaceStoredProfile({
  preferences,
  sessionRecords,
  learnerProgressProfiles,
  faultAt,
}: {
  preferences: PracticePreferences;
  sessionRecords: SessionRecord[];
  learnerProgressProfiles: LearnerProgressProfile[];
  faultAt?: ProfileReplacementFaultStage;
}) {
  const database = await getAppDatabase();
  const transaction = database.transaction(
    ["typingSessions", "analyticsSnapshots", "progressionProfiles", "contentCache", "preferences", "appMeta"],
    "readwrite",
  );

  const injectFault = (stage: ProfileReplacementFaultStage) => {
    if (faultAt === stage) throw new Error(`Injected profile replacement fault: ${stage}`);
  };

  try {
    await Promise.all([
      transaction.objectStore("typingSessions").clear(),
      transaction.objectStore("analyticsSnapshots").clear(),
      transaction.objectStore("progressionProfiles").clear(),
      transaction.objectStore("contentCache").clear(),
      transaction.objectStore("preferences").clear(),
    ]);
    injectFault("after-clear");

    for (const sessionRecord of sessionRecords) {
      const normalizedSessionRecord = migrateSessionRecord(sessionRecord);
      await transaction.objectStore("typingSessions").put(normalizedSessionRecord);
      if (isPracticeAnalyticsEligibleSession(normalizedSessionRecord)) {
        await transaction.objectStore("analyticsSnapshots").put({
          snapshotId: `${normalizedSessionRecord.sessionId}-snapshot`,
          sessionId: normalizedSessionRecord.sessionId,
          sessionKind: normalizedSessionRecord.sessionKind,
          languageId: normalizedSessionRecord.languageId,
          keyboardLayoutId: normalizedSessionRecord.keyboardLayoutId,
          savedAt: normalizedSessionRecord.endedAt,
          perCharacterPerformance: normalizedSessionRecord.perCharacterPerformance,
        });
      }
    }
    injectFault("after-sessions");

    for (const learnerProgressProfile of learnerProgressProfiles) {
      await transaction.objectStore("progressionProfiles").put(learnerProgressProfile);
    }
    injectFault("after-profiles");

    await transaction.objectStore("preferences").put({
      key: "practice",
      value: preferences,
      schemaVersion: CURRENT_PREFERENCES_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    });
    await transaction.objectStore("appMeta").put({
      key: "schemaVersion",
      value: String(APP_DATABASE_SCHEMA_VERSION),
      updatedAt: new Date().toISOString(),
    });
    injectFault("before-commit");
    await transaction.done;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // IndexedDB may already have aborted the transaction.
    }
    await transaction.done.catch(() => undefined);
    throw error;
  }
}
