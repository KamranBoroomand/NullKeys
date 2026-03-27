import {
  clearStoredHistory,
  listSessionRecords,
  readContentCacheEntry,
  readLearnerProgressProfile,
  saveContentCacheEntry,
  saveLearnerProgressProfile,
  saveSessionRecord,
} from "@/lib/persistence/session-repository";
import type { LearnerProgressProfile, SessionRecord } from "@/lib/scoring/session-models";

describe("local persistence adapters", () => {
  beforeEach(async () => {
    await clearStoredHistory();
  });

  it("stores and reloads session records from IndexedDB", async () => {
    const sessionRecord: SessionRecord = {
      sessionId: "session-1",
      sessionKind: "adaptive",
      sessionFlavor: "plain",
      languageId: "english",
      keyboardFamilyId: "ansi-compact",
      keyboardLayoutId: "ansi-us-compact",
      inputMode: "hardware",
      promptText: "steady signal",
      typedText: "steady signal",
      startedAt: "2026-03-07T10:00:00.000Z",
      endedAt: "2026-03-07T10:01:00.000Z",
      completed: true,
      priorityCharacters: ["s", "g"],
      activeCharacterSet: ["s", "t", "e", "a", "d", "y"],
      unlockedCharacters: ["s", "t", "e", "a", "d", "y", "g", "n", "l"],
      attemptLog: [],
      perCharacterPerformance: {},
      grossWpm: 30,
      netWpm: 30,
      accuracy: 100,
      correctedErrorCount: 0,
      uncorrectedErrorCount: 0,
      durationMs: 60_000,
    };

    await saveSessionRecord(sessionRecord);
    const sessionRecords = await listSessionRecords();

    expect(sessionRecords).toHaveLength(1);
    expect(sessionRecords[0]?.sessionId).toBe("session-1");
  });

  it("stores content cache payloads", async () => {
    await saveContentCacheEntry("language:english", { words: ["steady", "signal"] });
    const cachedEntry = await readContentCacheEntry<{ words: string[] }>("language:english");

    expect(cachedEntry?.words).toEqual(["steady", "signal"]);
  });

  it("stores learner progression profiles for adaptive unlock state", async () => {
    const learnerProgressProfile: LearnerProgressProfile = {
      progressionId: "english:ansi-us-tenkeyless:hardware:general",
      languageId: "english",
      keyboardLayoutId: "ansi-us-tenkeyless",
      inputMode: "hardware",
      programmerModeEnabled: false,
      currentStageIndex: 1,
      activeCharacterSet: ["e", "t", "a", "o", "i", "n"],
      unlockedCharacters: ["e", "t", "a", "o", "i", "n", "s", "r"],
      newlyUnlockedCharacters: ["s", "r"],
      reinforcementCharacters: ["s", "r"],
      stableCharacters: ["e", "t", "a", "o"],
      recoveryCharacters: ["i"],
      unlockPreviewCharacters: ["l"],
      regressionHold: false,
      recentReadinessScore: 78,
      recentStabilityScore: 74,
      completedAdaptiveSessions: 6,
      milestoneHistory: [],
      updatedAt: "2026-03-07T10:10:00.000Z",
      version: 1,
    };

    await saveLearnerProgressProfile(learnerProgressProfile);
    const storedProfile = await readLearnerProgressProfile(learnerProgressProfile.progressionId);

    expect(storedProfile?.currentStageIndex).toBe(1);
    expect(storedProfile?.reinforcementCharacters).toContain("s");
  });
});
