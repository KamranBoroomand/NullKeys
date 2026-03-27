import {
  buildProgressionStages,
  createInitialLearnerProgressProfile,
  evaluateLearnerProgressProfile,
} from "@/features/adaptive-practice/learner-progression";
import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";
import type {
  CharacterAttemptRecord,
  CharacterPerformanceEntry,
  SessionRecord,
} from "@/lib/scoring/session-models";

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function createPerformanceEntry(
  character: string,
  masteryScore: number,
  attemptCount = 8,
): CharacterPerformanceEntry {
  const correctCount = masteryScore >= 75 ? attemptCount : Math.max(1, Math.round(attemptCount * 0.6));

  return {
    character,
    attemptCount,
    correctCount,
    mistakeCount: Math.max(0, attemptCount - correctCount),
    smoothedResponseMs: masteryScore >= 75 ? 150 : 320,
    bestRecentResponseMs: masteryScore >= 75 ? 110 : 260,
    masteryScore,
    lastSeenAt: minutesAgo(8),
  };
}

function createAttemptLog(
  characters: string[],
  correctness: "strong" | "weak",
): CharacterAttemptRecord[] {
  return characters.flatMap((character, characterIndex) =>
    Array.from({ length: 4 }, (_, repetitionIndex) => ({
      expectedCharacter: character,
      enteredCharacter:
        correctness === "strong" || repetitionIndex > 0
          ? character
          : character === "x"
            ? "z"
            : "x",
      elapsedMs: correctness === "strong" ? 150 : 360,
      occurredAt: minutesAgo(22 - characterIndex * 2 - repetitionIndex),
      correct: correctness === "strong" || repetitionIndex > 0,
      inputMode: "hardware" as const,
    })),
  );
}

function createAdaptiveSessionRecord(
  stageCharacters: string[],
  masteryScore: number,
): SessionRecord {
  const performanceEntries = Object.fromEntries(
    stageCharacters.map((character) => [
      character,
      createPerformanceEntry(character, masteryScore),
    ]),
  );

  return {
    sessionId: `adaptive-${masteryScore}-${stageCharacters.join("")}`,
    sessionKind: "adaptive",
    sessionFlavor: "plain",
    languageId: "english",
    keyboardFamilyId: "ansi-tenkeyless",
    keyboardLayoutId: "ansi-us-tenkeyless",
    inputMode: "hardware",
    promptText: stageCharacters.join(" "),
    typedText: stageCharacters.join(" "),
    startedAt: minutesAgo(16),
    endedAt: minutesAgo(15),
    completed: true,
    priorityCharacters: stageCharacters.slice(0, 3),
    activeCharacterSet: stageCharacters,
    unlockedCharacters: stageCharacters,
    progressionStageIndex: 0,
    attemptLog: createAttemptLog(stageCharacters, masteryScore >= 75 ? "strong" : "weak"),
    perCharacterPerformance: performanceEntries,
    grossWpm: masteryScore >= 75 ? 52 : 24,
    netWpm: masteryScore >= 75 ? 49 : 18,
    accuracy: masteryScore >= 75 ? 98 : 74,
    correctedErrorCount: masteryScore >= 75 ? 0 : 2,
    uncorrectedErrorCount: masteryScore >= 75 ? 0 : 2,
    durationMs: 60_000,
  };
}

describe("learner progression", () => {
  it("unlocks the next stage when the active stage is stable", () => {
    const preferences = {
      ...defaultPracticePreferences,
      selectedLanguageId: "english",
      selectedKeyboardLayoutId: "ansi-us-tenkeyless",
      activeCharacterRange: "core" as const,
      progressionPace: "balanced" as const,
      punctuationEnabled: false,
    };
    const initialProfile = createInitialLearnerProgressProfile({ preferences });
    const strongSessions = [
      createAdaptiveSessionRecord(initialProfile.activeCharacterSet, 92),
      createAdaptiveSessionRecord(initialProfile.activeCharacterSet, 88),
    ];

    const nextProfile = evaluateLearnerProgressProfile({
      existingProfile: initialProfile,
      preferences,
      recentSessions: strongSessions,
    });

    expect(nextProfile.currentStageIndex).toBeGreaterThan(initialProfile.currentStageIndex);
    expect(nextProfile.newlyUnlockedCharacters.length).toBeGreaterThan(0);
    expect(nextProfile.milestoneHistory[0]?.kind).toBe("unlock");
  });

  it("holds progression and re-centers recovery when a later stage regresses", () => {
    const preferences = {
      ...defaultPracticePreferences,
      selectedLanguageId: "english",
      selectedKeyboardLayoutId: "ansi-us-tenkeyless",
      activeCharacterRange: "core" as const,
      progressionPace: "balanced" as const,
      punctuationEnabled: false,
    };
    const progressionStages = buildProgressionStages({ preferences });
    const secondStageCharacters = progressionStages[1]?.characters ?? [];
    const seededProfile = {
      ...createInitialLearnerProgressProfile({ preferences }),
      currentStageIndex: 1,
      activeCharacterSet: [...progressionStages[0].characters, ...secondStageCharacters],
      unlockedCharacters: [...progressionStages[0].characters, ...secondStageCharacters],
      newlyUnlockedCharacters: secondStageCharacters,
    };
    const weakSessions = [
      createAdaptiveSessionRecord(secondStageCharacters, 42),
      createAdaptiveSessionRecord(secondStageCharacters, 38),
    ];

    const nextProfile = evaluateLearnerProgressProfile({
      existingProfile: seededProfile,
      preferences,
      recentSessions: weakSessions,
    });

    expect(nextProfile.regressionHold).toBe(true);
    expect(nextProfile.recoveryCharacters).toEqual(
      expect.arrayContaining(secondStageCharacters.slice(0, 2)),
    );
    expect(nextProfile.milestoneHistory[0]?.kind).toBe("regression-hold");
  });

  it("keeps balanced progression previews and unlocks gradual until the frontier is firmly settled", () => {
    const preferences = {
      ...defaultPracticePreferences,
      selectedLanguageId: "english",
      selectedKeyboardLayoutId: "ansi-us-tenkeyless",
      activeCharacterRange: "core" as const,
      progressionPace: "balanced" as const,
      punctuationEnabled: false,
    };
    const initialProfile = createInitialLearnerProgressProfile({ preferences });
    const strongButEarlySessions = [
      createAdaptiveSessionRecord(initialProfile.activeCharacterSet, 90),
      createAdaptiveSessionRecord(initialProfile.activeCharacterSet, 88),
      createAdaptiveSessionRecord(initialProfile.activeCharacterSet, 89),
    ];

    const nextProfile = evaluateLearnerProgressProfile({
      existingProfile: initialProfile,
      preferences,
      recentSessions: strongButEarlySessions,
    });

    expect(nextProfile.unlockedCharacters.length - initialProfile.unlockedCharacters.length).toBe(1);
    expect(nextProfile.unlockPreviewCharacters.length).toBeLessThanOrEqual(1);
  });
});
