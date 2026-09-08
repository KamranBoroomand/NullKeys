export function smoothCharacterResponse(previousMs: number | null, nextMs: number, weight = 0.28) {
  if (previousMs === null) {
    return nextMs;
  }

  const normalizedNext = Math.max(30, Math.min(nextMs, 2_500));
  return Math.round(previousMs * (1 - weight) + normalizedNext * weight);
}

export function deriveMasteryScore(input: {
  attemptCount: number;
  correctCount: number;
  smoothedResponseMs: number;
  masterySpeedGoal: number;
}) {
  const accuracyRatio =
    input.attemptCount === 0 ? 0 : input.correctCount / input.attemptCount;
  const exposureScore = Math.min(input.attemptCount / 14, 1);
  const speedScore = Math.max(
    0,
    Math.min(input.masterySpeedGoal / Math.max(input.smoothedResponseMs, 30), 1.2),
  );

  return Math.round((accuracyRatio * 0.46 + exposureScore * 0.18 + speedScore * 0.36) * 100);
}

