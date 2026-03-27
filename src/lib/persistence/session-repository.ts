import {
  getAppDatabase,
  APP_DATABASE_SCHEMA_VERSION,
} from "@/lib/persistence/browser-database";
import type {
  AnalyticsSnapshot,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";

export async function saveSessionRecord(sessionRecord: SessionRecord) {
  const database = await getAppDatabase();
  const snapshot: AnalyticsSnapshot = {
    snapshotId: `${sessionRecord.sessionId}-snapshot`,
    sessionId: sessionRecord.sessionId,
    sessionKind: sessionRecord.sessionKind,
    languageId: sessionRecord.languageId,
    keyboardLayoutId: sessionRecord.keyboardLayoutId,
    savedAt: sessionRecord.endedAt,
    perCharacterPerformance: sessionRecord.perCharacterPerformance,
  };

  await database.put("typingSessions", sessionRecord);
  await database.put("analyticsSnapshots", snapshot);
}

export async function listSessionRecords(limit = 120) {
  const database = await getAppDatabase();
  const sessionRecords = await database.getAll("typingSessions");

  return sessionRecords
    .sort(
      (left, right) =>
        new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime(),
    )
    .slice(0, limit);
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
  await Promise.all([
    database.clear("typingSessions"),
    database.clear("analyticsSnapshots"),
    database.clear("progressionProfiles"),
    database.clear("contentCache"),
  ]);
}

export async function replaceStoredHistory({
  sessionRecords,
  learnerProgressProfiles,
  contentCacheEntries,
}: {
  sessionRecords: SessionRecord[];
  learnerProgressProfiles: LearnerProgressProfile[];
  contentCacheEntries: Array<{
    cacheKey: string;
    payload: unknown;
    savedAt: string;
  }>;
}) {
  const database = await getAppDatabase();
  const transaction = database.transaction(
    ["typingSessions", "analyticsSnapshots", "progressionProfiles", "contentCache", "appMeta"],
    "readwrite",
  );

  await Promise.all([
    transaction.objectStore("typingSessions").clear(),
    transaction.objectStore("analyticsSnapshots").clear(),
    transaction.objectStore("progressionProfiles").clear(),
    transaction.objectStore("contentCache").clear(),
  ]);

  for (const sessionRecord of sessionRecords) {
    const snapshot: AnalyticsSnapshot = {
      snapshotId: `${sessionRecord.sessionId}-snapshot`,
      sessionId: sessionRecord.sessionId,
      sessionKind: sessionRecord.sessionKind,
      languageId: sessionRecord.languageId,
      keyboardLayoutId: sessionRecord.keyboardLayoutId,
      savedAt: sessionRecord.endedAt,
      perCharacterPerformance: sessionRecord.perCharacterPerformance,
    };

    await transaction.objectStore("typingSessions").put(sessionRecord);
    await transaction.objectStore("analyticsSnapshots").put(snapshot);
  }

  for (const learnerProgressProfile of learnerProgressProfiles) {
    await transaction.objectStore("progressionProfiles").put(learnerProgressProfile);
  }

  for (const cacheEntry of contentCacheEntries) {
    await transaction.objectStore("contentCache").put(cacheEntry);
  }

  await transaction.objectStore("appMeta").put({
    key: "schemaVersion",
    value: String(APP_DATABASE_SCHEMA_VERSION),
    updatedAt: new Date().toISOString(),
  });

  await transaction.done;
}
