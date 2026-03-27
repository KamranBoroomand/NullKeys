import { buildCharacterPerformanceMap } from "@/features/adaptive-practice/character-performance";
import type { CharacterAttemptRecord, SessionMetrics } from "@/lib/scoring/session-models";

function countUncorrectedErrors(promptText: string, typedText: string) {
  const comparableLength = Math.min(promptText.length, typedText.length);
  let mismatchCount = 0;

  for (let index = 0; index < comparableLength; index += 1) {
    if (promptText[index] !== typedText[index]) {
      mismatchCount += 1;
    }
  }

  return mismatchCount + Math.max(0, typedText.length - promptText.length);
}

export function scoreTypingSession(input: {
  promptText: string;
  typedText: string;
  attemptLog: CharacterAttemptRecord[];
  startedAt: string | null;
  endedAt: string | null;
  correctedErrorCount: number;
  masterySpeedGoal?: number;
}) {
  const durationMs =
    input.startedAt && input.endedAt
      ? Math.max(new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime(), 1)
      : 1;
  const durationMinutes = durationMs / 60_000;
  const comparableLength = Math.min(input.promptText.length, input.typedText.length);
  let correctCharacterCount = 0;

  for (let index = 0; index < comparableLength; index += 1) {
    if (input.promptText[index] === input.typedText[index]) {
      correctCharacterCount += 1;
    }
  }

  const uncorrectedErrorCount = countUncorrectedErrors(input.promptText, input.typedText);
  const grossWpm = durationMinutes === 0 ? 0 : input.typedText.length / 5 / durationMinutes;
  const netWpm = Math.max(
    0,
    durationMinutes === 0
      ? 0
      : (correctCharacterCount - uncorrectedErrorCount) / 5 / durationMinutes,
  );
  const accuracy =
    input.typedText.length === 0 ? 100 : (correctCharacterCount / input.typedText.length) * 100;

  return {
    metrics: {
      grossWpm,
      netWpm,
      accuracy,
      correctedErrorCount: input.correctedErrorCount,
      uncorrectedErrorCount,
      durationMs,
    } satisfies SessionMetrics,
    perCharacterPerformance: buildCharacterPerformanceMap({
      attemptLog: input.attemptLog,
      masterySpeedGoal: input.masterySpeedGoal,
    }),
  };
}

