import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  AnalyticsSnapshot,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";

interface AppDatabaseSchema extends DBSchema {
  typingSessions: {
    key: string;
    value: SessionRecord;
  };
  analyticsSnapshots: {
    key: string;
    value: AnalyticsSnapshot;
  };
  progressionProfiles: {
    key: string;
    value: LearnerProgressProfile;
  };
  contentCache: {
    key: string;
    value: {
      cacheKey: string;
      payload: unknown;
      savedAt: string;
    };
  };
  appMeta: {
    key: string;
    value: {
      key: string;
      value: string;
      updatedAt: string;
    };
  };
}

export const APP_DATABASE_SCHEMA_VERSION = 1;

let databasePromise: Promise<IDBPDatabase<AppDatabaseSchema>> | null = null;

export function getAppDatabase() {
  if (!databasePromise) {
    databasePromise = openDB<AppDatabaseSchema>(
      "nullkeys-local-v1",
      APP_DATABASE_SCHEMA_VERSION,
      {
        upgrade(database, oldVersion) {
          if (oldVersion < 1 && !database.objectStoreNames.contains("typingSessions")) {
            database.createObjectStore("typingSessions", {
              keyPath: "sessionId",
            });
          }

          if (oldVersion < 1 && !database.objectStoreNames.contains("analyticsSnapshots")) {
            database.createObjectStore("analyticsSnapshots", {
              keyPath: "snapshotId",
            });
          }

          if (oldVersion < 2 && !database.objectStoreNames.contains("progressionProfiles")) {
            database.createObjectStore("progressionProfiles", {
              keyPath: "progressionId",
            });
          }

          if (oldVersion < 1 && !database.objectStoreNames.contains("contentCache")) {
            database.createObjectStore("contentCache", {
              keyPath: "cacheKey",
            });
          }

          if (oldVersion < 3 && !database.objectStoreNames.contains("appMeta")) {
            database.createObjectStore("appMeta", {
              keyPath: "key",
            });
          }
        },
      },
    ).then(async (database) => {
      await database.put("appMeta", {
        key: "schemaVersion",
        value: String(APP_DATABASE_SCHEMA_VERSION),
        updatedAt: new Date().toISOString(),
      });
      return database;
    });
  }

  return databasePromise;
}
