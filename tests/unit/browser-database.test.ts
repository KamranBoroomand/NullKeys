import {
  APP_DATABASE_NAME,
  APP_DATABASE_SCHEMA_VERSION,
  getAppDatabase,
  getAppDatabaseConnectionSnapshot,
  resetAppDatabaseConnectionForTests,
  retryAppDatabaseConnection,
} from "@/lib/persistence/browser-database";

function deleteDatabase(databaseName: string) {
  resetAppDatabaseConnectionForTests();

  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`Database deletion was blocked: ${databaseName}`));
  });
}

function withDatabaseTimeout<T>(operation: Promise<T>, label: string) {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), 1_000);
    }),
  ]);
}

async function waitForConnectionStatus(
  status: ReturnType<typeof getAppDatabaseConnectionSnapshot>["status"],
) {
  const deadline = Date.now() + 1_000;

  while (getAppDatabaseConnectionSnapshot().status !== status && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 1));
  }
}

function createLegacyDatabase(
  version: number,
  stores: Array<{
    name: string;
    keyPath: string;
  }>,
  seed?: (transaction: IDBTransaction) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(APP_DATABASE_NAME, version);

    request.onupgradeneeded = () => {
      const database = request.result;

      for (const store of stores) {
        if (!database.objectStoreNames.contains(store.name)) {
          database.createObjectStore(store.name, { keyPath: store.keyPath });
        }
      }

      if (request.transaction) {
        try {
          seed?.(request.transaction);
        } catch (error) {
          reject(error);
        }
      }
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function openMigratedDatabase() {
  resetAppDatabaseConnectionForTests();
  return getAppDatabase();
}

describe("browser database migrations", () => {
  beforeEach(async () => {
    await deleteDatabase(APP_DATABASE_NAME);
  });

  afterEach(async () => {
    const database = await getAppDatabase().catch(() => null);
    database?.close();
    await deleteDatabase(APP_DATABASE_NAME);
  });

  it("creates the current schema on fresh install", async () => {
    const database = await openMigratedDatabase();

    expect(database.version).toBe(APP_DATABASE_SCHEMA_VERSION);
    expect(Array.from(database.objectStoreNames).sort()).toEqual([
      "analyticsSnapshots",
      "appMeta",
      "contentCache",
      "preferences",
      "progressionProfiles",
      "typingSessions",
    ]);
  });

  it("upgrades a version 1 database without deleting legacy records", async () => {
    await withDatabaseTimeout(
      createLegacyDatabase(
        1,
        [
          { name: "typingSessions", keyPath: "sessionId" },
          { name: "analyticsSnapshots", keyPath: "snapshotId" },
          { name: "contentCache", keyPath: "cacheKey" },
        ],
        (transaction) => {
          transaction.objectStore("typingSessions").put({
            sessionId: "legacy-session",
            malformed: true,
          });
        },
      ),
      "legacy v1 creation",
    );

    const database = await withDatabaseTimeout(openMigratedDatabase(), "v1 migration");
    const legacyRecord = await withDatabaseTimeout(
      database.get("typingSessions", "legacy-session"),
      "legacy record read",
    );

    expect(database.version).toBe(APP_DATABASE_SCHEMA_VERSION);
    expect(database.objectStoreNames.contains("progressionProfiles")).toBe(true);
    expect(database.objectStoreNames.contains("appMeta")).toBe(true);
    expect(legacyRecord).toEqual({
      sessionId: "legacy-session",
      malformed: true,
    });
  });

  it("upgrades a version 2 database and adds app metadata", async () => {
    await createLegacyDatabase(2, [
      { name: "typingSessions", keyPath: "sessionId" },
      { name: "analyticsSnapshots", keyPath: "snapshotId" },
      { name: "contentCache", keyPath: "cacheKey" },
      { name: "progressionProfiles", keyPath: "progressionId" },
    ]);

    const database = await openMigratedDatabase();

    expect(database.version).toBe(APP_DATABASE_SCHEMA_VERSION);
    expect(database.objectStoreNames.contains("appMeta")).toBe(true);
    expect(database.objectStoreNames.contains("preferences")).toBe(true);
  });

  it("upgrades a version 3 database by adding the transactional preferences store", async () => {
    await createLegacyDatabase(3, [
      { name: "typingSessions", keyPath: "sessionId" },
      { name: "analyticsSnapshots", keyPath: "snapshotId" },
      { name: "contentCache", keyPath: "cacheKey" },
      { name: "progressionProfiles", keyPath: "progressionId" },
      { name: "appMeta", keyPath: "key" },
    ]);

    const database = await openMigratedDatabase();

    expect(database.objectStoreNames.contains("preferences")).toBe(true);
    expect(database.version).toBe(APP_DATABASE_SCHEMA_VERSION);
  });

  it("repairs missing stores during historical upgrades", async () => {
    await createLegacyDatabase(1, [
      { name: "typingSessions", keyPath: "sessionId" },
      { name: "analyticsSnapshots", keyPath: "snapshotId" },
    ]);

    const database = await openMigratedDatabase();

    expect(Array.from(database.objectStoreNames).sort()).toEqual([
      "analyticsSnapshots",
      "appMeta",
      "contentCache",
      "preferences",
      "progressionProfiles",
      "typingSessions",
    ]);
  });

  it("reopens successfully after migration", async () => {
    await createLegacyDatabase(1, [
      { name: "typingSessions", keyPath: "sessionId" },
      { name: "analyticsSnapshots", keyPath: "snapshotId" },
      { name: "contentCache", keyPath: "cacheKey" },
    ]);

    const firstDatabase = await openMigratedDatabase();
    firstDatabase.close();
    resetAppDatabaseConnectionForTests();

    const reopenedDatabase = await getAppDatabase();

    expect(reopenedDatabase.version).toBe(APP_DATABASE_SCHEMA_VERSION);
    expect(reopenedDatabase.objectStoreNames.contains("appMeta")).toBe(true);
  });

  it("reports a blocked migration and recovers after the old connection closes", async () => {
    const legacyRequest = indexedDB.open(APP_DATABASE_NAME, 3);
    const legacyDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      legacyRequest.onupgradeneeded = () => {
        legacyRequest.result.createObjectStore("typingSessions", { keyPath: "sessionId" });
      };
      legacyRequest.onsuccess = () => resolve(legacyRequest.result);
      legacyRequest.onerror = () => reject(legacyRequest.error);
    });

    resetAppDatabaseConnectionForTests();
    const opening = getAppDatabase();
    try {
      await waitForConnectionStatus("blocked");
      expect(getAppDatabaseConnectionSnapshot().status).toBe("blocked");
    } finally {
      legacyDatabase.close();
    }
    const database = await withDatabaseTimeout(opening, "blocked migration recovery");
    expect(database.version).toBe(APP_DATABASE_SCHEMA_VERSION);
    expect(getAppDatabaseConnectionSnapshot().status).toBe("ready");
  });

  it("does not cache a failed open and can retry", async () => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    Object.defineProperty(indexedDB, "open", {
      configurable: true,
      value: () => {
        throw new DOMException("Private mode denied storage", "InvalidStateError");
      },
    });

    await expect(getAppDatabase()).rejects.toThrow(/private mode denied storage/i);
    expect(getAppDatabaseConnectionSnapshot().status).toBe("failed");

    Object.defineProperty(indexedDB, "open", {
      configurable: true,
      value: originalOpen,
    });
    const database = await retryAppDatabaseConnection();

    expect(database.version).toBe(APP_DATABASE_SCHEMA_VERSION);
    expect(getAppDatabaseConnectionSnapshot().status).toBe("ready");
  });

  it("shares one ready connection across concurrent callers", async () => {
    const [left, right, third] = await Promise.all([
      getAppDatabase(),
      getAppDatabase(),
      getAppDatabase(),
    ]);

    expect(left).toBe(right);
    expect(right).toBe(third);
  });
});
