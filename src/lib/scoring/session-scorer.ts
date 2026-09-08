import { buildCharacterPerformanceMap } from "@/features/adaptive-practice/character-performance";
import type { CharacterAttemptRecord, SessionMetrics } from "@/lib/scoring/session-models";
import { splitTextIntoGraphemes } from "@/lib/text/language-text-normalization";

function clampFiniteMetric(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function countFinalTextAccuracy(promptText: string, typedText: string) {
  const promptGraphemes = splitTextIntoGraphemes(promptText);
  const typedGraphemes = splitTextIntoGraphemes(typedText);
  const comparableLength = Math.min(promptGraphemes.length, typedGraphemes.length);
  let correctCharacterCount = 0;
  let mismatchCount = 0;

  for (let index = 0; index < comparableLength; index += 1) {
    if (promptGraphemes[index] === typedGraphemes[index]) {
      correctCharacterCount += 1;
    } else {
      mismatchCount += 1;
    }
  }

  return {
    promptCharacterCount: promptGraphemes.length,
    typedCharacterCount: typedGraphemes.length,
    correctCharacterCount,
    uncorrectedErrorCount: mismatchCount + Math.max(0, typedGraphemes.length - promptGraphemes.length),
  };
}

export function scoreTypingSession(input: {
  promptText: string;
  typedText: string;
  attemptLog: CharacterAttemptRecord[];
  startedAt: string | null;
  endedAt: string | null;
  correctedErrorCount: number;
  masterySpeedGoal?: number;
  durationMs?: number;
}) {
  const rawDurationMs =
    input.durationMs !== undefined
      ? input.durationMs
      : input.startedAt && input.endedAt
      ? new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()
      : 0;
  const durationMs = Math.max(clampFiniteMetric(rawDurationMs, 0), 1);
  const durationMinutes = durationMs / 60_000;
  const finalTextAccuracy = countFinalTextAccuracy(input.promptText, input.typedText);
  const grossWpm =
    durationMinutes === 0
      ? 0
      : finalTextAccuracy.typedCharacterCount / 5 / durationMinutes;
  const netCharacterCount = Math.max(
    0,
    finalTextAccuracy.typedCharacterCount - finalTextAccuracy.uncorrectedErrorCount,
  );
  const netWpm = durationMinutes === 0 ? 0 : netCharacterCount / 5 / durationMinutes;
  const accuracy =
    finalTextAccuracy.typedCharacterCount === 0
      ? 100
      : (finalTextAccuracy.correctCharacterCount / finalTextAccuracy.typedCharacterCount) * 100;

  return {
    metrics: {
      grossWpm: clampFiniteMetric(grossWpm),
      netWpm: clampFiniteMetric(netWpm),
      accuracy: Math.min(100, Math.max(0, clampFiniteMetric(accuracy, 100))),
      correctedErrorCount: Math.max(0, input.correctedErrorCount),
      uncorrectedErrorCount: finalTextAccuracy.uncorrectedErrorCount,
      durationMs,
    } satisfies SessionMetrics,
    perCharacterPerformance: buildCharacterPerformanceMap({
      attemptLog: input.attemptLog,
      masterySpeedGoal: input.masterySpeedGoal,
    }),
  };
}
