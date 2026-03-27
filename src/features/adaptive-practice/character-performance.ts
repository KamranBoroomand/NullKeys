import {
  deriveMasteryScore,
  smoothCharacterResponse,
} from "@/features/adaptive-practice/timing-smoothing";
import { SPACE_SKIP_MARKER } from "@/lib/input/typing-markers";
import type {
  CharacterAttemptRecord,
  CharacterPerformanceEntry,
} from "@/lib/scoring/session-models";

const HESITATION_MULTIPLIER = 1.35;

function isHesitantAttempt(
  attempt: CharacterAttemptRecord,
  masterySpeedGoal: number,
) {
  return attempt.hesitant ?? attempt.elapsedMs >= masterySpeedGoal * HESITATION_MULTIPLIER;
}

function buildDominantConfusions(confusionCounts: Record<string, number>) {
  return Object.entries(confusionCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([character, count]) => ({
      character,
      count,
    }));
}

export function createEmptyCharacterPerformanceEntry(character: string): CharacterPerformanceEntry {
  return {
    character,
    attemptCount: 0,
    correctCount: 0,
    mistakeCount: 0,
    smoothedResponseMs: 0,
    bestRecentResponseMs: 0,
    masteryScore: 0,
    lastSeenAt: new Date(0).toISOString(),
    hesitationCount: 0,
    hesitationRate: 0,
    repeatedFailureCount: 0,
    longestErrorRun: 0,
    confusionCounts: {},
    dominantConfusions: [],
  };
}

export function buildCharacterPerformanceMap(options: {
  attemptLog: CharacterAttemptRecord[];
  previousCharacterPerformanceMap?: Record<string, CharacterPerformanceEntry>;
  masterySpeedGoal?: number;
}) {
  const characterPerformanceMap = {
    ...(options.previousCharacterPerformanceMap ?? {}),
  } satisfies Record<string, CharacterPerformanceEntry>;
  const currentErrorRuns = new Map<string, number>();
  const previousFailureByCharacter = new Map<string, string>();
  const masterySpeedGoal = options.masterySpeedGoal ?? 220;

  for (const attempt of options.attemptLog) {
    const trackedCharacter = attempt.expectedCharacter;
    const existingEntry =
      characterPerformanceMap[trackedCharacter] ??
      createEmptyCharacterPerformanceEntry(trackedCharacter);
    const smoothedResponseMs = smoothCharacterResponse(
      existingEntry.attemptCount === 0 ? null : existingEntry.smoothedResponseMs,
      attempt.elapsedMs,
    );
    const correctCount = existingEntry.correctCount + (attempt.correct ? 1 : 0);
    const attemptCount = existingEntry.attemptCount + 1;
    const mistakeCount = existingEntry.mistakeCount + (attempt.correct ? 0 : 1);
    const hesitationCount =
      (existingEntry.hesitationCount ?? 0) +
      (isHesitantAttempt(attempt, masterySpeedGoal) ? 1 : 0);
    const bestRecentResponseMs =
      attempt.correct && attempt.elapsedMs > 0
        ? existingEntry.bestRecentResponseMs === 0
          ? attempt.elapsedMs
          : Math.min(existingEntry.bestRecentResponseMs, attempt.elapsedMs)
        : existingEntry.bestRecentResponseMs;
    const confusionCounts = {
      ...(existingEntry.confusionCounts ?? {}),
    };
    const nextErrorRun = attempt.correct
      ? 0
      : (currentErrorRuns.get(trackedCharacter) ?? 0) + 1;
    const repeatedFailureCount =
      (existingEntry.repeatedFailureCount ?? 0) +
      (!attempt.correct &&
      previousFailureByCharacter.get(trackedCharacter) === attempt.enteredCharacter
        ? 1
        : 0);
    const longestErrorRun = Math.max(existingEntry.longestErrorRun ?? 0, nextErrorRun);

    if (
      !attempt.correct &&
      attempt.enteredCharacter &&
      attempt.enteredCharacter !== SPACE_SKIP_MARKER
    ) {
      confusionCounts[attempt.enteredCharacter] =
        (confusionCounts[attempt.enteredCharacter] ?? 0) + 1;
      previousFailureByCharacter.set(trackedCharacter, attempt.enteredCharacter);
    } else {
      previousFailureByCharacter.delete(trackedCharacter);
    }

    currentErrorRuns.set(trackedCharacter, nextErrorRun);

    characterPerformanceMap[trackedCharacter] = {
      character: trackedCharacter,
      attemptCount,
      correctCount,
      mistakeCount,
      smoothedResponseMs,
      bestRecentResponseMs,
      masteryScore: deriveMasteryScore({
        attemptCount,
        correctCount,
        smoothedResponseMs,
        masterySpeedGoal,
      }),
      lastSeenAt: attempt.occurredAt,
      hesitationCount,
      hesitationRate: Number((hesitationCount / Math.max(1, attemptCount)).toFixed(3)),
      repeatedFailureCount,
      longestErrorRun,
      confusionCounts,
      dominantConfusions: buildDominantConfusions(confusionCounts),
    };
  }

  return characterPerformanceMap;
}
