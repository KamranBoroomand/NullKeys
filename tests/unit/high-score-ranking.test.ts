import {
  buildComparableBenchmarkBoards,
  rankComparableBenchmarkSessions,
} from "@/features/product-shell/high-scores-screen";
import type { SessionRecord } from "@/lib/scoring/session-models";
import {
  CURRENT_ANALYTICS_VERSION,
  CURRENT_SCORING_VERSION,
  createSessionIntegrity,
} from "@/lib/scoring/session-validity";

function benchmarkRecord(
  sessionId: string,
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    sessionId,
    sessionKind: "benchmark",
    sessionFlavor: "plain",
    contentFamilyId: "common-words",
    languageId: "english",
    keyboardFamilyId: "ansi-compact",
    keyboardLayoutId: "ansi-us-compact",
    inputMode: "hardware",
    promptText: "steady benchmark text",
    typedText: "steady benchmark text",
    startedAt: "2026-08-23T10:00:00.000Z",
    endedAt: "2026-08-23T10:00:30.000Z",
    completed: true,
    completionReason: "prompt-completed",
    integrity: { ...createSessionIntegrity(), rankingEligible: true },
    promptCompleted: true,
    analyticsEligible: true,
    rankingEligible: true,
    learnerModelEligible: false,
    activeElapsedMs: 30_000,
    pausedDurationMs: 0,
    scoringVersion: CURRENT_SCORING_VERSION,
    analyticsVersion: CURRENT_ANALYTICS_VERSION,
    priorityCharacters: [],
    activeCharacterSet: [],
    unlockedCharacters: [],
    attemptLog: [],
    perCharacterPerformance: {},
    grossWpm: 60,
    netWpm: 58,
    accuracy: 98,
    correctedErrorCount: 0,
    uncorrectedErrorCount: 0,
    durationMs: 30_000,
    benchmarkDurationSeconds: 30,
    ...overrides,
  };
}

describe("local benchmark ranking", () => {
  it("orders matching results by net WPM, accuracy, then session id", () => {
    const ranked = rankComparableBenchmarkSessions([
      benchmarkRecord("speed-tie-lower-accuracy", { netWpm: 70, accuracy: 96 }),
      benchmarkRecord("z-exact-tie", { netWpm: 70, accuracy: 99 }),
      benchmarkRecord("a-exact-tie", { netWpm: 70, accuracy: 99 }),
      benchmarkRecord("slower", { netWpm: 69, accuracy: 100 }),
    ]);

    expect(ranked.map(({ sessionRecord }) => sessionRecord.sessionId)).toEqual([
      "a-exact-tie",
      "z-exact-tie",
      "speed-tie-lower-accuracy",
      "slower",
    ]);
  });

  it("keeps different benchmark configurations on separate boards", () => {
    const ranked = rankComparableBenchmarkSessions([
      benchmarkRecord("thirty-second"),
      benchmarkRecord("sixty-second", { benchmarkDurationSeconds: 60 }),
      benchmarkRecord("alternate-layout", { keyboardLayoutId: "iso-uk" }),
    ]);
    const boards = buildComparableBenchmarkBoards(ranked);

    expect(boards).toHaveLength(3);
    expect(boards.flatMap((board) => board.entries)).toHaveLength(3);
    expect(boards.every((board) => board.entries.length === 1)).toBe(true);
  });

  it("measures prompt display length with shared grapheme segmentation", () => {
    const [ranked] = rankComparableBenchmarkSessions([
      benchmarkRecord("graphemes", { promptText: "e\u0301 👩🏽‍💻 سُ" }),
    ]);

    expect(ranked).toMatchObject({
      promptLength: 3,
      uniqueGraphemeCount: 3,
    });
  });
});
