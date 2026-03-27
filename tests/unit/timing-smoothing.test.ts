import { deriveMasteryScore, smoothCharacterResponse } from "@/features/adaptive-practice/timing-smoothing";

describe("timing smoothing", () => {
  it("blends new response times into an existing average", () => {
    expect(smoothCharacterResponse(200, 300)).toBe(228);
  });

  it("produces a higher mastery score for fast, accurate characters", () => {
    const fastScore = deriveMasteryScore({
      attemptCount: 20,
      correctCount: 19,
      smoothedResponseMs: 150,
      masterySpeedGoal: 220,
    });
    const slowScore = deriveMasteryScore({
      attemptCount: 20,
      correctCount: 15,
      smoothedResponseMs: 320,
      masterySpeedGoal: 220,
    });

    expect(fastScore).toBeGreaterThan(slowScore);
  });
});

