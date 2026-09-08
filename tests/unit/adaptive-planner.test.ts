import { planAdaptiveSession } from "@/features/adaptive-practice/adaptive-planner";
import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";

function createPerformanceEntry(character: string, masteryScore: number, attemptCount = 18) {
  return {
    character,
    attemptCount,
    correctCount: Math.round((masteryScore / 100) * attemptCount),
    mistakeCount: Math.max(0, attemptCount - Math.round((masteryScore / 100) * attemptCount)),
    smoothedResponseMs: masteryScore > 80 ? 150 : masteryScore > 50 ? 220 : 340,
    bestRecentResponseMs: 120,
    masteryScore,
    lastSeenAt: new Date().toISOString(),
  };
}

describe("adaptive planner", () => {
  it("surfaces weak characters ahead of stable ones", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 96),
        b: createPerformanceEntry("b", 32, 10),
        c: createPerformanceEntry("c", 90),
        d: createPerformanceEntry("d", 91),
        e: createPerformanceEntry("e", 89),
        f: createPerformanceEntry("f", 88),
        g: createPerformanceEntry("g", 87),
        h: createPerformanceEntry("h", 86),
        i: createPerformanceEntry("i", 85),
        j: createPerformanceEntry("j", 84),
        k: createPerformanceEntry("k", 83),
        l: createPerformanceEntry("l", 82),
        s: createPerformanceEntry("s", 32, 10),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        activeCharacterRange: "core",
        punctuationEnabled: false,
      },
      recentSessions: [],
      learnerProgressProfile: null,
    });

    expect(sessionPlan.priorityCharacters).toContain("b");
    expect(sessionPlan.weakCharacters).toContain("b");
    expect(sessionPlan.recoveryCharacters).toContain("b");
  });

  it("adds bridge and exploration characters around recovery keys", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 82),
        b: createPerformanceEntry("b", 28, 6),
        w: createPerformanceEntry("w", 68),
        c: createPerformanceEntry("c", 70),
        d: createPerformanceEntry("d", 75),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        activeCharacterRange: "core",
        punctuationEnabled: false,
      },
      recentSessions: [
        {
          sessionId: "recent-1",
          sessionKind: "adaptive",
          sessionFlavor: "plain",
          languageId: "english",
          keyboardFamilyId: "ansi-tenkeyless",
          keyboardLayoutId: "ansi-us-tenkeyless",
          inputMode: "hardware",
          promptText: "bbbb",
          typedText: "bgbb",
          startedAt: "2026-03-07T10:00:00.000Z",
          endedAt: "2026-03-07T10:01:00.000Z",
          completed: true,
          priorityCharacters: ["b"],
          activeCharacterSet: ["a", "b", "c", "d", "e", "f"],
          unlockedCharacters: ["a", "b", "c", "d", "e", "f"],
          attemptLog: [
            {
              expectedCharacter: "b",
              enteredCharacter: "g",
              elapsedMs: 420,
              occurredAt: "2026-03-07T10:00:02.000Z",
              correct: false,
              inputMode: "hardware",
            },
            {
              expectedCharacter: "b",
              enteredCharacter: "b",
              elapsedMs: 380,
              occurredAt: "2026-03-07T10:00:03.000Z",
              correct: true,
              inputMode: "hardware",
            },
          ],
          perCharacterPerformance: {},
          grossWpm: 20,
          netWpm: 18,
          accuracy: 75,
          correctedErrorCount: 1,
          uncorrectedErrorCount: 1,
          durationMs: 60_000,
        },
      ],
      learnerProgressProfile: null,
    });

    expect(sessionPlan.recoveryCharacters).toContain("b");
    expect(
      sessionPlan.bridgeCharacters.some((character) => ["g", "n", "v", "h"].includes(character)),
    ).toBe(true);
    expect(sessionPlan.explorationCharacters.length).toBeGreaterThan(0);
  });

  it("selects learner-aware difficulty bands for content families", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 92, 26),
        s: createPerformanceEntry("s", 90, 24),
        d: createPerformanceEntry("d", 89, 24),
        f: createPerformanceEntry("f", 88, 24),
        j: createPerformanceEntry("j", 87, 24),
        k: createPerformanceEntry("k", 86, 24),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        activeCharacterRange: "extended",
        punctuationEnabled: true,
        preferredContentFamilyId: "common-words",
        programmerModeEnabled: true,
      },
      recentSessions: [
        {
          sessionId: "recent-code",
          sessionKind: "adaptive",
          sessionFlavor: "code",
          contentFamilyId: "code-drills",
          languageId: "english",
          keyboardFamilyId: "ansi-tenkeyless",
          keyboardLayoutId: "ansi-us-tenkeyless",
          inputMode: "hardware",
          promptText: "const result = items[index] ?? fallbackValue;",
          typedText: "const result = items[index] ?? fallbackValue;",
          startedAt: "2026-03-10T10:00:00.000Z",
          endedAt: "2026-03-10T10:01:00.000Z",
          completed: true,
          priorityCharacters: ["[", "]"],
          activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz[]{}()"),
          unlockedCharacters: Array.from("abcdefghijklmnopqrstuvwxyz[]{}()"),
          attemptLog: [],
          perCharacterPerformance: {},
          grossWpm: 75,
          netWpm: 73,
          accuracy: 99,
          correctedErrorCount: 0,
          uncorrectedErrorCount: 0,
          durationMs: 60_000,
          programmerDrillPresetId: "typescript-symbols",
        },
      ],
      learnerProgressProfile: {
        progressionId: "english:ansi-us-tenkeyless:hardware:programmer",
        languageId: "english",
        keyboardLayoutId: "ansi-us-tenkeyless",
        inputMode: "hardware",
        programmerModeEnabled: true,
        currentStageIndex: 4,
        activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
        unlockedCharacters: Array.from("abcdefghijklmnopqrstuvwxyz0123456789"),
        newlyUnlockedCharacters: ["q", "z"],
        reinforcementCharacters: ["q", "z"],
        stableCharacters: ["a", "s", "d", "f", "j", "k"],
        recoveryCharacters: [],
        unlockPreviewCharacters: ["[", "]"],
        regressionHold: false,
        recentReadinessScore: 82,
        recentStabilityScore: 79,
        completedAdaptiveSessions: 18,
        milestoneHistory: [],
        updatedAt: "2026-03-16T12:00:00.000Z",
        version: 1,
      },
    });

    expect(["fluent", "advanced", "expert-control"]).toContain(sessionPlan.contentDifficultyBand);
    expect(["advanced", "expert-control"]).toContain(
      sessionPlan.contentDifficultyBandsByFamily["shell-drills"],
    );
  });

  it("keeps adaptive blend in natural-language flavors even when programmer bias is enabled", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 90, 20),
        s: createPerformanceEntry("s", 88, 18),
        d: createPerformanceEntry("d", 86, 18),
        f: createPerformanceEntry("f", 84, 18),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        preferredContentFamilyId: "adaptive-blend",
        programmerModeEnabled: true,
        punctuationEnabled: true,
      },
      recentSessions: [],
      learnerProgressProfile: null,
    });

    expect(["plain", "mixed"]).toContain(sessionPlan.suggestedFlavor);
    expect(sessionPlan.suggestedFlavor).not.toBe("code");
  });

  it("keeps adaptive blend plain for ordinary letter confusion even when punctuation is enabled", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 86, 18),
        s: createPerformanceEntry("s", 52, 14),
        d: createPerformanceEntry("d", 48, 14),
        f: createPerformanceEntry("f", 83, 18),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        preferredContentFamilyId: "adaptive-blend",
        punctuationEnabled: true,
        activeCharacterRange: "full",
      },
      recentSessions: [
        {
          sessionId: "recent-letter-confusion",
          sessionKind: "adaptive",
          sessionFlavor: "plain",
          languageId: "english",
          keyboardFamilyId: "ansi-tenkeyless",
          keyboardLayoutId: "ansi-us-tenkeyless",
          inputMode: "hardware",
          promptText: "sad fad",
          typedText: "saf fad",
          startedAt: "2026-03-15T10:00:00.000Z",
          endedAt: "2026-03-15T10:01:00.000Z",
          completed: true,
          priorityCharacters: ["s", "d"],
          activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.;!?"),
          unlockedCharacters: Array.from("abcdefghijklmnopqrstuvwxyz,.;!?"),
          attemptLog: [
            {
              expectedCharacter: "d",
              enteredCharacter: "f",
              elapsedMs: 320,
              occurredAt: "2026-03-15T10:00:04.000Z",
              correct: false,
              inputMode: "hardware",
            },
          ],
          perCharacterPerformance: {},
          grossWpm: 28,
          netWpm: 24,
          accuracy: 92,
          correctedErrorCount: 1,
          uncorrectedErrorCount: 0,
          durationMs: 60_000,
        },
      ],
      learnerProgressProfile: null,
    });

    expect(sessionPlan.suggestedFlavor).toBe("plain");
    expect(sessionPlan.rebalanceCharacters.some((character) => /[0-9]/.test(character))).toBe(
      false,
    );
  });

  it("keeps early punctuation pressure plain while foundational adaptive lessons are still settling", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 84, 18),
        s: createPerformanceEntry("s", 82, 18),
        d: createPerformanceEntry("d", 80, 18),
        ",": createPerformanceEntry(",", 28, 8),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        preferredContentFamilyId: "adaptive-blend",
        punctuationEnabled: true,
        activeCharacterRange: "full",
      },
      recentSessions: [],
      learnerProgressProfile: {
        progressionId: "english:ansi-us-tenkeyless:hardware",
        languageId: "english",
        keyboardLayoutId: "ansi-us-tenkeyless",
        inputMode: "hardware",
        programmerModeEnabled: false,
        currentStageIndex: 1,
        activeCharacterSet: Array.from("asdfjkl"),
        unlockedCharacters: Array.from("asdfjkl"),
        newlyUnlockedCharacters: ["l"],
        reinforcementCharacters: ["d"],
        stableCharacters: ["a", "s", "f", "j", "k"],
        recoveryCharacters: [],
        unlockPreviewCharacters: ["l"],
        regressionHold: false,
        recentReadinessScore: 58,
        recentStabilityScore: 61,
        completedAdaptiveSessions: 6,
        milestoneHistory: [],
        updatedAt: "2026-03-16T12:00:00.000Z",
        version: 1,
      },
    });

    expect(sessionPlan.suggestedFlavor).toBe("plain");
    expect(sessionPlan.adaptiveLessonPreference).not.toBe("quote-drills");
  });

  it("keeps early adaptive recovery on common words when regression pressure is high", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 82, 18),
        s: createPerformanceEntry("s", 80, 18),
        d: createPerformanceEntry("d", 41, 10),
        f: createPerformanceEntry("f", 39, 10),
        j: createPerformanceEntry("j", 78, 16),
        k: createPerformanceEntry("k", 76, 16),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        preferredContentFamilyId: "adaptive-blend",
        punctuationEnabled: true,
        activeCharacterRange: "core",
      },
      recentSessions: [],
      learnerProgressProfile: {
        progressionId: "english:ansi-us-tenkeyless:hardware",
        languageId: "english",
        keyboardLayoutId: "ansi-us-tenkeyless",
        inputMode: "hardware",
        programmerModeEnabled: false,
        currentStageIndex: 1,
        activeCharacterSet: Array.from("asdfjk"),
        unlockedCharacters: Array.from("asdfjk"),
        newlyUnlockedCharacters: ["l"],
        reinforcementCharacters: ["d", "f"],
        stableCharacters: ["a", "s", "j", "k"],
        recoveryCharacters: ["d", "f"],
        unlockPreviewCharacters: ["l"],
        regressionHold: true,
        recentReadinessScore: 44,
        recentStabilityScore: 41,
        completedAdaptiveSessions: 5,
        milestoneHistory: [],
        updatedAt: "2026-03-16T12:00:00.000Z",
        version: 1,
      },
    });

    expect(sessionPlan.adaptiveLessonPreference).toBe("common-words");
    expect(sessionPlan.adaptiveLessonReason).toMatch(/recovery pressure/i);
  });

  it("keeps transitional unlock previews on common words until the new layer feels settled", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 88, 18),
        s: createPerformanceEntry("s", 87, 18),
        d: createPerformanceEntry("d", 84, 18),
        f: createPerformanceEntry("f", 83, 18),
        j: createPerformanceEntry("j", 82, 18),
        k: createPerformanceEntry("k", 81, 18),
        l: createPerformanceEntry("l", 62, 10),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        preferredContentFamilyId: "adaptive-blend",
        punctuationEnabled: false,
        activeCharacterRange: "core",
      },
      recentSessions: [],
      learnerProgressProfile: {
        progressionId: "english:ansi-us-tenkeyless:hardware",
        languageId: "english",
        keyboardLayoutId: "ansi-us-tenkeyless",
        inputMode: "hardware",
        programmerModeEnabled: false,
        currentStageIndex: 2,
        activeCharacterSet: Array.from("asdfjk"),
        unlockedCharacters: Array.from("asdfjk"),
        newlyUnlockedCharacters: ["l"],
        reinforcementCharacters: ["l"],
        stableCharacters: ["a", "s", "d", "f", "j", "k"],
        recoveryCharacters: [],
        unlockPreviewCharacters: ["l"],
        regressionHold: false,
        recentReadinessScore: 66,
        recentStabilityScore: 67,
        completedAdaptiveSessions: 7,
        milestoneHistory: [],
        updatedAt: "2026-03-16T12:00:00.000Z",
        version: 1,
      },
    });

    expect(sessionPlan.adaptiveLessonPreference).toBe("common-words");
  });

  it("promotes stable advanced adaptive sessions into connected passages", () => {
    const stableUnlockedCharacters = Array.from("asdfjklerionthmcpu");
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 96, 26),
        s: createPerformanceEntry("s", 95, 26),
        d: createPerformanceEntry("d", 95, 26),
        f: createPerformanceEntry("f", 94, 26),
        j: createPerformanceEntry("j", 94, 26),
        k: createPerformanceEntry("k", 93, 26),
        l: createPerformanceEntry("l", 93, 24),
        e: createPerformanceEntry("e", 92, 24),
        r: createPerformanceEntry("r", 92, 24),
        i: createPerformanceEntry("i", 91, 24),
        o: createPerformanceEntry("o", 91, 24),
        n: createPerformanceEntry("n", 91, 24),
        t: createPerformanceEntry("t", 90, 24),
        h: createPerformanceEntry("h", 90, 24),
        m: createPerformanceEntry("m", 90, 24),
        c: createPerformanceEntry("c", 89, 24),
        p: createPerformanceEntry("p", 89, 24),
        u: createPerformanceEntry("u", 89, 24),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        preferredContentFamilyId: "adaptive-blend",
        punctuationEnabled: true,
        activeCharacterRange: "full",
      },
      recentSessions: [],
      learnerProgressProfile: {
        progressionId: "english:ansi-us-tenkeyless:hardware",
        languageId: "english",
        keyboardLayoutId: "ansi-us-tenkeyless",
        inputMode: "hardware",
        programmerModeEnabled: false,
        currentStageIndex: 5,
        activeCharacterSet: stableUnlockedCharacters,
        unlockedCharacters: stableUnlockedCharacters,
        newlyUnlockedCharacters: [],
        reinforcementCharacters: ["r", "t"],
        stableCharacters: ["a", "s", "d", "f", "j", "k", "l", "e", "r", "i", "o", "n"],
        recoveryCharacters: [],
        unlockPreviewCharacters: [],
        regressionHold: false,
        recentReadinessScore: 88,
        recentStabilityScore: 91,
        completedAdaptiveSessions: 28,
        milestoneHistory: [],
        updatedAt: "2026-03-16T12:00:00.000Z",
        version: 1,
      },
    });

    expect(sessionPlan.adaptiveLessonPreference).toBe("quote-drills");
    expect(sessionPlan.adaptiveLessonReason).toMatch(/connected passages/i);
  });

  it("allows adaptive blend to become mixed when punctuation itself is the weak target", () => {
    const sessionPlan = planAdaptiveSession({
      characterPerformanceMap: {
        a: createPerformanceEntry("a", 91, 20),
        s: createPerformanceEntry("s", 89, 18),
        d: createPerformanceEntry("d", 87, 18),
        f: createPerformanceEntry("f", 88, 18),
        j: createPerformanceEntry("j", 87, 18),
        k: createPerformanceEntry("k", 87, 18),
        l: createPerformanceEntry("l", 86, 18),
        e: createPerformanceEntry("e", 86, 18),
        r: createPerformanceEntry("r", 86, 18),
        t: createPerformanceEntry("t", 85, 18),
        u: createPerformanceEntry("u", 85, 18),
        i: createPerformanceEntry("i", 85, 18),
        o: createPerformanceEntry("o", 84, 18),
        p: createPerformanceEntry("p", 84, 18),
        n: createPerformanceEntry("n", 84, 18),
        m: createPerformanceEntry("m", 84, 18),
        c: createPerformanceEntry("c", 83, 18),
        v: createPerformanceEntry("v", 83, 18),
        b: createPerformanceEntry("b", 83, 18),
        ",": createPerformanceEntry(",", 24, 8),
        ";": createPerformanceEntry(";", 26, 8),
        ":": createPerformanceEntry(":", 27, 8),
        "?": createPerformanceEntry("?", 29, 8),
      },
      preferences: {
        ...defaultPracticePreferences,
        selectedLanguageId: "english",
        selectedKeyboardLayoutId: "ansi-us-tenkeyless",
        preferredContentFamilyId: "adaptive-blend",
        punctuationEnabled: true,
        activeCharacterRange: "full",
      },
      recentSessions: [],
      learnerProgressProfile: {
        progressionId: "english:ansi-us-tenkeyless:hardware",
        languageId: "english",
        keyboardLayoutId: "ansi-us-tenkeyless",
        inputMode: "hardware",
        programmerModeEnabled: false,
        currentStageIndex: 4,
        activeCharacterSet: Array.from("asdfjklertuiopnm,;:?"),
        unlockedCharacters: Array.from("asdfjklertuiopnmcvb,;:?"),
        newlyUnlockedCharacters: [],
        reinforcementCharacters: [",", ";", ":", "?"],
        stableCharacters: ["a", "s", "d", "f", "j", "k", "l", "e", "r", "t", "u", "i", "o", "p"],
        recoveryCharacters: [",", ";", ":", "?"],
        unlockPreviewCharacters: [],
        regressionHold: false,
        recentReadinessScore: 79,
        recentStabilityScore: 81,
        completedAdaptiveSessions: 24,
        milestoneHistory: [],
        updatedAt: "2026-03-16T12:00:00.000Z",
        version: 1,
      },
    });

    expect(sessionPlan.suggestedFlavor).toBe("mixed");
  });
});
