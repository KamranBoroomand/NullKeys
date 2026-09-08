import { buildComparisonSummary } from "@/features/progress-analytics/summary-selectors";
import type { SessionRecord } from "@/lib/scoring/session-models";

const sampleSessions: SessionRecord[] = [
  {
    sessionId: "a1",
    sessionKind: "adaptive",
    sessionFlavor: "plain",
    languageId: "english",
    keyboardFamilyId: "ansi-tenkeyless",
    keyboardLayoutId: "ansi-us-tenkeyless",
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
    grossWpm: 50,
    netWpm: 46,
    accuracy: 98,
    correctedErrorCount: 1,
    uncorrectedErrorCount: 0,
    durationMs: 60_000,
  },
  {
    sessionId: "b1",
    sessionKind: "benchmark",
    sessionFlavor: "code",
    languageId: "russian",
    keyboardFamilyId: "apple-compact",
    keyboardLayoutId: "apple-us-compact",
    inputMode: "touch",
    promptText: "const value = map[key]",
    typedText: "const value = map[key]",
    startedAt: "2026-03-07T11:00:00.000Z",
    endedAt: "2026-03-07T11:01:00.000Z",
    completed: true,
    priorityCharacters: ["[", "]"],
    activeCharacterSet: ["c", "o", "n", "s", "t", "[", "]"],
    unlockedCharacters: ["c", "o", "n", "s", "t", "[", "]", "{", "}"],
    attemptLog: [],
    perCharacterPerformance: {},
    grossWpm: 42,
    netWpm: 39,
    accuracy: 95,
    correctedErrorCount: 2,
    uncorrectedErrorCount: 1,
    durationMs: 60_000,
    benchmarkDurationSeconds: 60,
    programmerDrillPresetId: "typescript-symbols",
  },
];

describe("progress analytics comparisons", () => {
  it("builds language, layout, mode, and consistency summaries", () => {
    const comparisonSummary = buildComparisonSummary(sampleSessions);

    expect(comparisonSummary.languageComparisons).toHaveLength(2);
    expect(comparisonSummary.layoutComparisons[0]?.label).toBe("ansi-us-tenkeyless");
    expect(comparisonSummary.modeComparisons).toHaveLength(2);
    expect(comparisonSummary.bestBenchmarks[0]?.sessionId).toBe("b1");
    expect(comparisonSummary.consistencyScore).toBeGreaterThan(0);
    expect(comparisonSummary.benchmarkVsAdaptiveDelta?.netWpmDelta).toBeLessThan(0);
    expect(Array.isArray(comparisonSummary.zonePerformance)).toBe(true);
  });
});
