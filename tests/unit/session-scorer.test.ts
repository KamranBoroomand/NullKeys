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
});

