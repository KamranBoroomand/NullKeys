import {
  addIntegrityInvalidReason,
  buildSessionDatasets,
  CURRENT_ANALYTICS_VERSION,
  CURRENT_SCORING_VERSION,
  createSessionIntegrity,
  finalizeSessionEligibility,
} from "@/lib/scoring/session-validity";
import type { SessionRecord } from "@/lib/scoring/session-models";

function sessionRecord(
  sessionId: string,
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  const sessionKind = overrides.sessionKind ?? "benchmark";
  return {
    sessionId,
    sessionKind,
    sessionFlavor: "plain",
    languageId: "english",
    keyboardFamilyId: "ansi-compact",
    keyboardLayoutId: "ansi-us-compact",
    inputMode: "hardware",
    promptText: "steady practice keeps benchmark comparisons honest across repeated local sessions",
    typedText: "steady practice keeps benchmark comparisons honest across repeated local sessions",
    startedAt: "2026-08-23T10:00:00.000Z",
    endedAt: "2026-08-23T10:00:30.000Z",
    completed: true,
    completionReason: "prompt-completed",
    integrity: { ...createSessionIntegrity(), rankingEligible: sessionKind === "benchmark" },
    promptCompleted: true,
    analyticsEligible: true,
    rankingEligible: sessionKind === "benchmark",
    learnerModelEligible: sessionKind === "adaptive",
    activeElapsedMs: 30_000,
    pausedDurationMs: 0,
    scoringVersion: CURRENT_SCORING_VERSION,
    analyticsVersion: CURRENT_ANALYTICS_VERSION,
    priorityCharacters: [],
    activeCharacterSet: ["a", "b", "c"],
    unlockedCharacters: ["a", "b", "c"],
    attemptLog: [],
    perCharacterPerformance: {},
    grossWpm: 12,
    netWpm: 12,
    accuracy: 100,
    correctedErrorCount: 0,
    uncorrectedErrorCount: 0,
    durationMs: 30_000,
    benchmarkDurationSeconds: 60,
    ...overrides,
  };
}

describe("session eligibility policy", () => {
  it("ranks only normally completed, integrity-valid benchmarks", () => {
    expect(
      finalizeSessionEligibility({
        sessionKind: "benchmark",
        completionReason: "prompt-completed",
        promptCompleted: true,
        integrity: createSessionIntegrity(),
        hasAuthoritativeAttemptTiming: true,
      }),
    ).toEqual({
      promptCompleted: true,
      analyticsEligible: true,
      rankingEligible: true,
      learnerModelEligible: false,
    });
  });

  it("keeps pasted completions in diagnostic history only", () => {
    const integrity = addIntegrityInvalidReason(createSessionIntegrity(), "pasted-text");

    expect(
      finalizeSessionEligibility({
        sessionKind: "benchmark",
        completionReason: "invalid-input",
        promptCompleted: true,
        integrity,
        hasAuthoritativeAttemptTiming: false,
      }),
    ).toMatchObject({
      analyticsEligible: false,
      rankingEligible: false,
      learnerModelEligible: false,
    });
  });

  it("builds stable diagnostic, ranking, analytics, and learner golden datasets", () => {
    const pastedIntegrity = addIntegrityInvalidReason(createSessionIntegrity(), "pasted-text");
    const fixedRecords = [
      sessionRecord("valid-benchmark"),
      sessionRecord("valid-practice", {
        sessionKind: "adaptive",
        rankingEligible: false,
        learnerModelEligible: true,
      }),
      sessionRecord("pasted", {
        integrity: pastedIntegrity,
        completionReason: "invalid-input",
        analyticsEligible: false,
        rankingEligible: false,
        learnerModelEligible: false,
      }),
      sessionRecord("timed-out", {
        completed: false,
        promptCompleted: false,
        completionReason: "time-expired",
        analyticsEligible: false,
        rankingEligible: false,
        learnerModelEligible: false,
      }),
      sessionRecord("old-scoring", {
        scoringVersion: 1,
      }),
      sessionRecord("corrupted-metric", {
        netWpm: Number.NaN,
      }),
      sessionRecord("unsupported-benchmark", {
        benchmarkDurationSeconds: 15,
      }),
      {
        ...sessionRecord("legacy"),
        completionReason: undefined,
        integrity: undefined,
        promptCompleted: undefined,
        analyticsEligible: undefined,
        rankingEligible: undefined,
        learnerModelEligible: undefined,
        scoringVersion: undefined,
        analyticsVersion: undefined,
      },
    ];

    const datasets = buildSessionDatasets(fixedRecords);

    expect(datasets.diagnosticHistory.map(({ sessionId }) => sessionId)).toEqual([
      "valid-benchmark",
      "valid-practice",
      "pasted",
      "timed-out",
      "old-scoring",
      "corrupted-metric",
      "unsupported-benchmark",
      "legacy",
    ]);
    expect(datasets.ranking.map(({ sessionId }) => sessionId)).toEqual(["valid-benchmark"]);
    expect(datasets.practiceAnalytics.map(({ sessionId }) => sessionId)).toEqual([
      "valid-benchmark",
      "valid-practice",
    ]);
    expect(datasets.learnerModel.map(({ sessionId }) => sessionId)).toEqual(["valid-practice"]);
  });

  it("uses grapheme counts for the short-duration prompt threshold", () => {
    const records = [
      sessionRecord("decomposed-below-threshold", {
        promptText: "e\u0301".repeat(79),
        typedText: "e\u0301".repeat(79),
        durationMs: 9_000,
      }),
      sessionRecord("decomposed-at-threshold", {
        promptText: "e\u0301".repeat(80),
        typedText: "e\u0301".repeat(80),
        durationMs: 9_000,
      }),
      sessionRecord("joined-emoji-at-threshold", {
        promptText: "👩🏽‍💻".repeat(80),
        typedText: "👩🏽‍💻".repeat(80),
        durationMs: 9_000,
      }),
      sessionRecord("persian-combining-at-threshold", {
        languageId: "persian",
        promptText: "سُ".repeat(80),
        typedText: "سُ".repeat(80),
        durationMs: 9_000,
      }),
    ];

    expect(buildSessionDatasets(records).ranking.map(({ sessionId }) => sessionId)).toEqual([
      "decomposed-at-threshold",
      "joined-emoji-at-threshold",
      "persian-combining-at-threshold",
    ]);
  });
});
