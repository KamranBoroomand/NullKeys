import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";
import { loadPracticePreferences, savePracticePreferences } from "@/features/user-preferences/preferences-store";
import {
  buildLocalProfileArchive,
  MAX_LOCAL_PROFILE_ARCHIVE_BYTES,
  parseLocalProfileArchive,
  restoreLocalProfileArchive,
} from "@/lib/persistence/local-profile-archive";
import {
  clearStoredHistory,
  listSessionRecords,
  saveLearnerProgressProfile,
  saveSessionRecord,
} from "@/lib/persistence/session-repository";
import type { LearnerProgressProfile, SessionRecord } from "@/lib/scoring/session-models";

describe("local profile archive", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clearStoredHistory();
  });

  it("exports and restores local-only state through a versioned archive", async () => {
    savePracticePreferences({
      ...defaultPracticePreferences,
      onboardingComplete: true,
      selectedLanguageId: "persian",
      selectedKeyboardLayoutId: "touch-android-standard",
      selectedInputMode: "touch",
    });

    const sessionRecord: SessionRecord = {
      sessionId: "archive-session-1",
      sessionKind: "benchmark",
      sessionFlavor: "plain",
      contentFamilyId: "common-words",
      languageId: "persian",
      keyboardFamilyId: "touch-android",
      keyboardLayoutId: "touch-android-standard",
      inputMode: "touch",
      promptText: "سلام دنیا",
      typedText: "سلام دنیا",
      startedAt: "2026-03-08T10:00:00.000Z",
      endedAt: "2026-03-08T10:01:00.000Z",
      completed: true,
      priorityCharacters: [],
      activeCharacterSet: ["س", "ل", "ا", "م"],
      unlockedCharacters: ["س", "ل", "ا", "م", "د", "ن", "ی"],
      attemptLog: [],
      perCharacterPerformance: {},
      benchmarkDurationSeconds: 60,
      grossWpm: 48,
      netWpm: 46,
      accuracy: 98,
      correctedErrorCount: 1,
      uncorrectedErrorCount: 0,
      durationMs: 60_000,
    };

    const learnerProgressProfile: LearnerProgressProfile = {
      progressionId: "persian:touch-android-standard:touch:general",
      languageId: "persian",
      keyboardLayoutId: "touch-android-standard",
      inputMode: "touch",
      programmerModeEnabled: false,
      currentStageIndex: 2,
      activeCharacterSet: ["س", "ل", "ا", "م"],
      unlockedCharacters: ["س", "ل", "ا", "م", "د", "ن", "ی"],
      newlyUnlockedCharacters: ["د"],
      reinforcementCharacters: ["د"],
      stableCharacters: ["س", "ل", "ا", "م"],
      recoveryCharacters: [],
      unlockPreviewCharacters: ["ی"],
      regressionHold: false,
      recentReadinessScore: 83,
      recentStabilityScore: 80,
      completedAdaptiveSessions: 7,
      milestoneHistory: [],
      updatedAt: "2026-03-08T10:01:00.000Z",
      version: 1,
    };

    await saveSessionRecord(sessionRecord);
    await saveLearnerProgressProfile(learnerProgressProfile);

    const archive = await buildLocalProfileArchive();
    const serializedArchive = JSON.stringify(archive);

    savePracticePreferences(defaultPracticePreferences);
    await clearStoredHistory();

    await restoreLocalProfileArchive(parseLocalProfileArchive(serializedArchive));

    const restoredPreferences = loadPracticePreferences();
    const restoredSessions = await listSessionRecords();

    expect(restoredPreferences.selectedLanguageId).toBe("persian");
    expect(restoredSessions[0]?.sessionId).toBe("archive-session-1");
    expect(archive.archiveVersion).toBe(1);
    expect(archive.summary.sessionCount).toBe(1);
  });

  it("accepts the current archive version and rebuilds its summary", () => {
    const archivePayload = JSON.stringify({
      archiveVersion: 1,
      createdAt: "2026-03-08T10:01:00.000Z",
      preferences: defaultPracticePreferences,
      sessionRecords: [],
      learnerProgressProfiles: [],
      contentCacheEntries: [],
    });

    const archive = parseLocalProfileArchive(archivePayload);

    expect(archive.archiveVersion).toBe(1);
    expect(archive.summary.sessionCount).toBe(0);
    expect(archive.summary.preferencesSchemaVersion).toBe(defaultPracticePreferences.schemaVersion);
  });

  it("rejects invalid JSON and unsupported archive versions with clear errors", () => {
    expect(() => parseLocalProfileArchive("{not-json")).toThrow(/not valid json/i);

    expect(() =>
      parseLocalProfileArchive(
        JSON.stringify({
          archiveVersion: 999,
          preferences: defaultPracticePreferences,
          sessionRecords: [],
          learnerProgressProfiles: [],
          contentCacheEntries: [],
        }),
      ),
    ).toThrow(/supported nullkeys local archive/i);
  });

  it("rejects oversized archives and malformed session records early", () => {
    expect(() => parseLocalProfileArchive("a".repeat(MAX_LOCAL_PROFILE_ARCHIVE_BYTES + 1))).toThrow(
      /too large to import safely/i,
    );

    expect(() =>
      parseLocalProfileArchive(
        JSON.stringify({
          archiveVersion: 1,
          preferences: defaultPracticePreferences,
          sessionRecords: [
            {
              sessionId: 42,
            },
          ],
          learnerProgressProfiles: [],
          contentCacheEntries: [],
        }),
      ),
    ).toThrow(/supported nullkeys local archive/i);
  });
});
