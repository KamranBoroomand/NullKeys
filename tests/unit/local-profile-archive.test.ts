import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";
import {
  loadPracticePreferences,
  resetPracticePreferencesStoreForTests,
  savePracticePreferences,
} from "@/features/user-preferences/preferences-store";
import {
  buildLocalProfileArchive,
  LOCAL_PROFILE_ARCHIVE_CONTENT_TYPE,
  MAX_LOCAL_PROFILE_ARCHIVE_BYTES,
  parseLocalProfileArchive,
  restoreLocalProfileArchive,
  type LocalProfileArchive,
} from "@/lib/persistence/local-profile-archive";
import {
  clearStoredHistory,
  clearStoredProfile,
  listSessionRecords,
  replaceStoredProfile,
  saveLearnerProgressProfile,
  saveSessionRecord,
} from "@/lib/persistence/session-repository";
import type { LearnerProgressProfile, SessionRecord } from "@/lib/scoring/session-models";
import {
  createSessionIntegrity,
  CURRENT_ANALYTICS_VERSION,
  CURRENT_SCORING_VERSION,
} from "@/lib/scoring/session-validity";

function createCurrentSessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const sessionKind = overrides.sessionKind ?? "adaptive";

  return {
    sessionId: `current-${sessionKind}`,
    sessionKind,
    sessionFlavor: "plain",
    contentFamilyId: "common-words",
    languageId: "english",
    keyboardFamilyId: "ansi-compact",
    keyboardLayoutId: "ansi-us-compact",
    inputMode: "hardware",
    promptText: "steady practice",
    typedText: "steady practice",
    startedAt: "2026-08-30T10:00:00.000Z",
    endedAt: "2026-08-30T10:00:12.000Z",
    completed: true,
    completionReason: "prompt-completed",
    integrity: {
      ...createSessionIntegrity(),
      rankingEligible: sessionKind === "benchmark",
    },
    promptCompleted: true,
    analyticsEligible: true,
    rankingEligible: sessionKind === "benchmark",
    learnerModelEligible: sessionKind === "adaptive",
    activeElapsedMs: 12_000,
    pausedDurationMs: 0,
    scoringVersion: CURRENT_SCORING_VERSION,
    analyticsVersion: CURRENT_ANALYTICS_VERSION,
    priorityCharacters: [],
    activeCharacterSet: ["s", "t", "e", "a", "d", "y"],
    unlockedCharacters: ["s", "t", "e", "a", "d", "y"],
    attemptLog: [],
    perCharacterPerformance: {},
    grossWpm: 14,
    netWpm: 14,
    accuracy: 100,
    correctedErrorCount: 0,
    uncorrectedErrorCount: 0,
    durationMs: 12_000,
    ...overrides,
  };
}

describe("local profile archive", () => {
  beforeEach(async () => {
    resetPracticePreferencesStoreForTests();
    window.localStorage.clear();
    await clearStoredProfile();
  });

  it("exports and restores local-only state through a versioned archive", async () => {
    await savePracticePreferences({
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

    await savePracticePreferences(defaultPracticePreferences);
    await clearStoredHistory();

    await restoreLocalProfileArchive(await parseLocalProfileArchive(serializedArchive));

    const restoredPreferences = loadPracticePreferences();
    const restoredSessions = await listSessionRecords();

    expect(restoredPreferences.selectedLanguageId).toBe("persian");
    expect(restoredSessions[0]?.sessionId).toBe("archive-session-1");
    expect(archive.archiveVersion).toBe(2);
    expect(archive.summary.sessionCount).toBe(1);
  });

  it("accepts the current archive version and verifies its summary", async () => {
    const archivePayload = JSON.stringify(await buildLocalProfileArchive());
    const archive = await parseLocalProfileArchive(archivePayload);

    expect(archive.archiveVersion).toBe(2);
    expect(archive.summary.sessionCount).toBe(0);
    expect(archive.summary.preferencesSchemaVersion).toBe(defaultPracticePreferences.schemaVersion);
  });

  it("hashes the JSON-representable form of current session records", async () => {
    await saveSessionRecord(createCurrentSessionRecord({
      sessionId: "current-benchmark-with-undefined-optionals",
      sessionKind: "benchmark",
      benchmarkDurationSeconds: 30,
      progressionStageIndex: undefined,
      programmerDrillPresetId: undefined,
      contentMetrics: {
        difficultyBand: "foundational",
        noveltyScore: 0.8,
        repetitionScore: 0.1,
        lexicalDiversity: 0.7,
        contentVariantId: undefined,
      },
    }));
    await saveSessionRecord(createCurrentSessionRecord({
      sessionId: "current-adaptive",
      progressionStageIndex: 2,
      contentMetrics: {
        difficultyBand: "developing",
        noveltyScore: 0.7,
        repetitionScore: 0.2,
        lexicalDiversity: 0.6,
        contentVariantId: "adaptive-standard",
      },
    }));

    const archive = await buildLocalProfileArchive();
    const serializedArchive = JSON.stringify(archive);
    const parsedArchive = await parseLocalProfileArchive(serializedArchive);
    const benchmarkRecord = archive.sessionRecords.find(
      (sessionRecord) => sessionRecord.sessionId === "current-benchmark-with-undefined-optionals",
    );

    expect(parsedArchive.sessionRecords).toHaveLength(2);
    expect(benchmarkRecord).toBeDefined();
    expect(Object.hasOwn(benchmarkRecord ?? {}, "progressionStageIndex")).toBe(false);
    expect(Object.hasOwn(benchmarkRecord ?? {}, "programmerDrillPresetId")).toBe(false);
    expect(Object.hasOwn(benchmarkRecord?.contentMetrics ?? {}, "contentVariantId")).toBe(false);

    const tamperedArchive = JSON.parse(serializedArchive) as LocalProfileArchive;
    tamperedArchive.sessionRecords[0].netWpm += 1;

    await expect(parseLocalProfileArchive(JSON.stringify(tamperedArchive))).rejects.toThrow(
      /integrity check/i,
    );
  });

  it("rejects invalid JSON and unsupported archive versions with clear errors", async () => {
    await expect(parseLocalProfileArchive("{not-json")).rejects.toThrow(/not valid json/i);

    await expect(
      parseLocalProfileArchive(
        JSON.stringify({
          archiveVersion: 999,
          preferences: defaultPracticePreferences,
          sessionRecords: [],
          learnerProgressProfiles: [],
          contentCacheEntries: [],
        }),
      ),
    ).rejects.toThrow(/supported nullkeys local archive/i);
  });

  it("rejects oversized archives, malformed records, duplicates, and newer schemas early", async () => {
    await expect(parseLocalProfileArchive("a".repeat(MAX_LOCAL_PROFILE_ARCHIVE_BYTES + 1))).rejects.toThrow(
      /too large to import safely/i,
    );

    await expect(
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
    ).rejects.toThrow(/invalid nullkeys archive|supported nullkeys local archive/i);

    const duplicateSession = {
      sessionId: "duplicate-session",
      sessionKind: "adaptive",
      sessionFlavor: "plain",
      languageId: "english",
      keyboardFamilyId: "ansi",
      keyboardLayoutId: "ansi-us",
      inputMode: "hardware",
      promptText: "aa",
      typedText: "aa",
      startedAt: "2026-03-08T10:00:00.000Z",
      endedAt: "2026-03-08T10:00:10.000Z",
      completed: true,
      priorityCharacters: [],
      activeCharacterSet: ["a"],
      unlockedCharacters: ["a"],
      attemptLog: [],
      perCharacterPerformance: {},
      grossWpm: 2,
      netWpm: 2,
      accuracy: 100,
      correctedErrorCount: 0,
      uncorrectedErrorCount: 0,
      durationMs: 10_000,
    };

    await expect(
      parseLocalProfileArchive(
        JSON.stringify({
          archiveVersion: 1,
          appSchemaVersion: 999,
          preferences: defaultPracticePreferences,
          sessionRecords: [],
          learnerProgressProfiles: [],
          contentCacheEntries: [],
        }),
      ),
    ).rejects.toThrow(/newer nullkeys data schema/i);

    await expect(
      parseLocalProfileArchive(
        JSON.stringify({
          archiveVersion: 1,
          preferences: defaultPracticePreferences,
          sessionRecords: [duplicateSession, duplicateSession],
          learnerProgressProfiles: [],
          contentCacheEntries: [],
        }),
      ),
    ).rejects.toThrow(/duplicate session records|duplicate IDs/i);
  });

  it("preserves existing history when archive replacement fails", async () => {
    const sessionRecord: SessionRecord = {
      sessionId: "safe-session",
      sessionKind: "adaptive",
      sessionFlavor: "plain",
      languageId: "english",
      keyboardFamilyId: "ansi-compact",
      keyboardLayoutId: "ansi-us-compact",
      inputMode: "hardware",
      promptText: "safe",
      typedText: "safe",
      startedAt: "2026-03-08T10:00:00.000Z",
      endedAt: "2026-03-08T10:01:00.000Z",
      completed: true,
      priorityCharacters: [],
      activeCharacterSet: ["s", "a", "f", "e"],
      unlockedCharacters: ["s", "a", "f", "e"],
      attemptLog: [],
      perCharacterPerformance: {},
      grossWpm: 20,
      netWpm: 20,
      accuracy: 100,
      correctedErrorCount: 0,
      uncorrectedErrorCount: 0,
      durationMs: 60_000,
    };

    await saveSessionRecord(sessionRecord);
    const archive = await buildLocalProfileArchive();
    const tamperedArchive = JSON.stringify({
      ...archive,
      sessionRecords: [],
    });

    await expect(parseLocalProfileArchive(tamperedArchive)).rejects.toThrow(/integrity check/i);

    const restoredSessions = await listSessionRecords();

    expect(restoredSessions).toHaveLength(1);
    expect(restoredSessions[0]?.sessionId).toBe("safe-session");
  });

  it("aborts every profile-replacement fault stage without exposing partial state", async () => {
    const originalSession: SessionRecord = {
      sessionId: "atomic-original",
      sessionKind: "adaptive",
      sessionFlavor: "plain",
      languageId: "english",
      keyboardFamilyId: "ansi-compact",
      keyboardLayoutId: "ansi-us-compact",
      inputMode: "hardware",
      promptText: "safe",
      typedText: "safe",
      startedAt: "2026-03-08T10:00:00.000Z",
      endedAt: "2026-03-08T10:00:04.000Z",
      completed: true,
      priorityCharacters: [],
      activeCharacterSet: ["s", "a", "f", "e"],
      unlockedCharacters: ["s", "a", "f", "e"],
      attemptLog: [],
      perCharacterPerformance: {},
      grossWpm: 12,
      netWpm: 12,
      accuracy: 100,
      correctedErrorCount: 0,
      uncorrectedErrorCount: 0,
      durationMs: 4_000,
    };
    await replaceStoredProfile({
      preferences: { ...defaultPracticePreferences, selectedLanguageId: "english" },
      sessionRecords: [originalSession],
      learnerProgressProfiles: [],
    });

    for (const faultAt of ["after-clear", "after-sessions", "after-profiles", "before-commit"] as const) {
      await expect(
        replaceStoredProfile({
          preferences: { ...defaultPracticePreferences, selectedLanguageId: "persian" },
          sessionRecords: [],
          learnerProgressProfiles: [],
          faultAt,
        }),
      ).rejects.toThrow(/injected profile replacement fault/i);

      expect((await listSessionRecords())[0]?.sessionId).toBe("atomic-original");
    }
  });

  it("rejects dangerous object keys and malformed nested attempts", async () => {
    const dangerousPayload = `{"archiveVersion":1,"preferences":${JSON.stringify(defaultPracticePreferences)},"sessionRecords":[],"learnerProgressProfiles":[],"contentCacheEntries":[{"cacheKey":"content-pack:test","savedAt":"2026-03-08T10:00:00.000Z","payload":{"__proto__":{"polluted":true}}}]}`;
    await expect(parseLocalProfileArchive(dangerousPayload)).rejects.toThrow(/field name/i);

    const malformedNestedPayload = JSON.stringify({
      archiveVersion: 1,
      preferences: defaultPracticePreferences,
      sessionRecords: [{
        sessionId: "nested-malformed",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        languageId: "english",
        keyboardFamilyId: "ansi-compact",
        keyboardLayoutId: "ansi-us-compact",
        inputMode: "hardware",
        promptText: "a",
        typedText: "a",
        startedAt: "2026-03-08T10:00:00.000Z",
        endedAt: "2026-03-08T10:00:01.000Z",
        completed: true,
        priorityCharacters: [],
        activeCharacterSet: ["a"],
        unlockedCharacters: ["a"],
        attemptLog: [{ expectedCharacter: "a", enteredCharacter: "a", elapsedMs: -1 }],
        perCharacterPerformance: {},
        grossWpm: 12,
        netWpm: 12,
        accuracy: 100,
        correctedErrorCount: 0,
        uncorrectedErrorCount: 0,
        durationMs: 1_000,
      }],
      learnerProgressProfiles: [],
      contentCacheEntries: [],
    });
    await expect(parseLocalProfileArchive(malformedNestedPayload)).rejects.toThrow(/attempt/i);
  });
});
