import { scoreTypingSession } from "@/lib/scoring/session-scorer";

describe("session scorer", () => {
  it("computes gross speed, net speed, and error counts", () => {
    const scoredSession = scoreTypingSession({
      promptText: "steady signal",
      typedText: "steady sigxal",
      attemptLog: [
        {
          expectedCharacter: "n",
          enteredCharacter: "x",
          elapsedMs: 240,
          occurredAt: new Date().toISOString(),
          correct: false,
          inputMode: "hardware",
        },
      ],
      correctedErrorCount: 1,
      startedAt: "2026-03-07T10:00:00.000Z",
      endedAt: "2026-03-07T10:00:30.000Z",
    });

    expect(scoredSession.metrics.grossWpm).toBeGreaterThan(4);
    expect(scoredSession.metrics.uncorrectedErrorCount).toBe(1);
    expect(scoredSession.metrics.correctedErrorCount).toBe(1);
    expect(scoredSession.metrics.accuracy).toBeLessThan(100);
  });

  it("does not double-penalize the same uncorrected mistake in net WPM", () => {
    const scoredSession = scoreTypingSession({
      promptText: "abcde",
      typedText: "abxde",
      attemptLog: [],
      correctedErrorCount: 0,
      startedAt: "2026-03-07T10:00:00.000Z",
      endedAt: "2026-03-07T10:01:00.000Z",
    });

    expect(scoredSession.metrics.grossWpm).toBe(1);
    expect(scoredSession.metrics.netWpm).toBe(0.8);
    expect(scoredSession.metrics.accuracy).toBe(80);
    expect(scoredSession.metrics.uncorrectedErrorCount).toBe(1);
  });

  it("scores Unicode grapheme clusters as visible characters", () => {
    const scoredSession = scoreTypingSession({
      promptText: "👩🏽‍💻a",
      typedText: "👩🏽‍💻x",
      attemptLog: [],
      correctedErrorCount: 0,
      startedAt: "2026-03-07T10:00:00.000Z",
      endedAt: "2026-03-07T10:01:00.000Z",
    });

    expect(scoredSession.metrics.grossWpm).toBe(0.4);
    expect(scoredSession.metrics.netWpm).toBe(0.2);
    expect(scoredSession.metrics.accuracy).toBe(50);
    expect(scoredSession.metrics.uncorrectedErrorCount).toBe(1);
  });

  it("keeps boundary metrics finite for empty and extremely short sessions", () => {
    const scoredSession = scoreTypingSession({
      promptText: "",
      typedText: "",
      attemptLog: [],
      correctedErrorCount: 0,
      startedAt: "2026-03-07T10:00:00.000Z",
      endedAt: "2026-03-07T10:00:00.000Z",
    });

    expect(scoredSession.metrics.durationMs).toBe(1);
    expect(scoredSession.metrics.grossWpm).toBe(0);
    expect(scoredSession.metrics.netWpm).toBe(0);
    expect(scoredSession.metrics.accuracy).toBe(100);
    expect(Number.isFinite(scoredSession.metrics.accuracy)).toBe(true);
  });
});
