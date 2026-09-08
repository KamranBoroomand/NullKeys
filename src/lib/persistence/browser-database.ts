import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PracticePreferences } from "@/features/user-preferences/preferences-schema";
import type {
  AnalyticsSnapshot,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";

export interface PersistedPreferencesRecord {
  key: "practice";
  value: PracticePreferences;
  schemaVersion: number;
  updatedAt: string;
}

interface AppDatabaseSchema extends DBSchema {
  typingSessions: { key: string; value: SessionRecord };
  analyticsSnapshots: { key: string; value: AnalyticsSnapshot };
  progressionProfiles: { key: string; value: LearnerProgressProfile };
  contentCache: {
    key: string;
    value: { cacheKey: string; payload: unknown; savedAt: string };
  };
  appMeta: {
    key: string;
    value: { key: string; value: string; updatedAt: string };
  };
  preferences: { key: "practice"; value: PersistedPreferencesRecord };
}

type AppDatabaseStoreName =
  | "typingSessions"
  | "analyticsSnapshots"
  | "progressionProfiles"
  | "contentCache"
  | "appMeta"
  | "preferences";

export type AppDatabaseConnectionStatus =
  | "idle"
  | "opening"
  | "ready"
  | "blocked"
  | "failed"
  | "reconnecting"
  | "closed";

export interface AppDatabaseConnectionSnapshot {
  status: AppDatabaseConnectionStatus;
  errorMessage: string | null;
  blockedByVersion: number | null;
}

export const APP_DATABASE_NAME = "nullkeys-local-v1";
export const APP_DATABASE_SCHEMA_VERSION = 4;

let databasePromise: Promise<IDBPDatabase<AppDatabaseSchema>> | null = null;
let databaseInstance: IDBPDatabase<AppDatabaseSchema> | null = null;
let databaseChannel: BroadcastChannel | null = null;
let connectionSnapshot: AppDatabaseConnectionSnapshot = {
  status: "idle",
  errorMessage: null,
  blockedByVersion: null,
};
const connectionListeners = new Set<() => void>();

function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "Browser storage is full. Free space, export unneeded data, and retry.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "NullKeys could not open browser storage.";
}

function publishConnectionSnapshot(nextSnapshot: AppDatabaseConnectionSnapshot) {
  connectionSnapshot = nextSnapshot;
  for (const listener of connectionListeners) listener();
}

function getDatabaseChannel() {
  if (typeof BroadcastChannel === "undefined") return null;

  if (!databaseChannel) {
    databaseChannel = new BroadcastChannel("nullkeys.database.v1");
    databaseChannel.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (event.data !== "close-for-version-change") return;

      databaseInstance?.close();
      databaseInstance = null;
      databasePromise = null;
      publishConnectionSnapshot({
        status: "closed",
        errorMessage: "Browser storage changed in another tab. Reopen it to continue.",
        blockedByVersion: null,
      });
    });
  }

  return databaseChannel;
}

function createStoreIfMissing(
  database: IDBPDatabase<AppDatabaseSchema>,
  storeName: AppDatabaseStoreName,
  keyPath: string,
) {
  if (!database.objectStoreNames.contains(storeName)) {
    database.createObjectStore(storeName, { keyPath });
  }
}

function migrateToVersion1(database: IDBPDatabase<AppDatabaseSchema>) {
  createStoreIfMissing(database, "typingSessions", "sessionId");
  createStoreIfMissing(database, "analyticsSnapshots", "snapshotId");
  createStoreIfMissing(database, "contentCache", "cacheKey");
}

function migrateToVersion2(database: IDBPDatabase<AppDatabaseSchema>) {
  createStoreIfMissing(database, "progressionProfiles", "progressionId");
}

function migrateToVersion3(database: IDBPDatabase<AppDatabaseSchema>) {
  createStoreIfMissing(database, "appMeta", "key");
}

function migrateToVersion4(database: IDBPDatabase<AppDatabaseSchema>) {
  createStoreIfMissing(database, "preferences", "key");
}

function clearConnection(status: "failed" | "closed", message: string | null) {
  databaseInstance?.close();
  databaseInstance = null;
  databasePromise = null;
  publishConnectionSnapshot({ status, errorMessage: message, blockedByVersion: null });
}

export function getAppDatabaseConnectionSnapshot() {
  return connectionSnapshot;
}

export function subscribeToAppDatabaseConnection(listener: () => void) {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

export function getAppDatabase() {
  if (databaseInstance && connectionSnapshot.status === "ready") {
    return Promise.resolve(databaseInstance);
  }
  if (databasePromise) return databasePromise;

  const reconnecting = connectionSnapshot.status === "failed" || connectionSnapshot.status === "closed";
  publishConnectionSnapshot({
    status: reconnecting ? "reconnecting" : "opening",
    errorMessage: null,
    blockedByVersion: null,
  });
  getDatabaseChannel();

  let openingPromise: Promise<IDBPDatabase<AppDatabaseSchema>>;
  try {
    openingPromise = openDB<AppDatabaseSchema>(APP_DATABASE_NAME, APP_DATABASE_SCHEMA_VERSION, {
    upgrade(database, oldVersion) {
      // Every migration is idempotent so historically incomplete schemas are repaired too.
      migrateToVersion1(database);
      migrateToVersion2(database);
      migrateToVersion3(database);
      migrateToVersion4(database);
    },
    blocked(_currentVersion, blockedVersion) {
      publishConnectionSnapshot({
        status: "blocked",
        errorMessage: "Another NullKeys tab is blocking a browser-storage upgrade. Close or refresh the older tab, then retry.",
        blockedByVersion: blockedVersion ?? APP_DATABASE_SCHEMA_VERSION,
      });
      getDatabaseChannel()?.postMessage("close-for-version-change");
    },
    blocking() {
      clearConnection("closed", "Browser storage changed in another tab. Reopen it to continue.");
    },
    terminated() {
      clearConnection("failed", "The browser terminated the local database connection. Retry to reconnect.");
    },
    });
  } catch (error) {
    clearConnection("failed", errorMessage(error));
    return Promise.reject(error);
  }

  databasePromise = openingPromise
    .then(async (database) => {
      databaseInstance = database;
      await database.put("appMeta", {
        key: "schemaVersion",
        value: String(APP_DATABASE_SCHEMA_VERSION),
        updatedAt: new Date().toISOString(),
      });
      publishConnectionSnapshot({ status: "ready", errorMessage: null, blockedByVersion: null });
      return database;
    })
    .catch((error: unknown) => {
      clearConnection("failed", errorMessage(error));
      throw error;
    });

  return databasePromise;
}

export function retryAppDatabaseConnection() {
  clearConnection("closed", null);
  return getAppDatabase();
}

export function closeAppDatabaseConnection() {
  clearConnection("closed", null);
}

export function resetAppDatabaseConnectionForTests() {
  databaseInstance?.close();
  databaseInstance = null;
  databasePromise = null;
  databaseChannel?.close();
  databaseChannel = null;
  publishConnectionSnapshot({ status: "idle", errorMessage: null, blockedByVersion: null });
}
