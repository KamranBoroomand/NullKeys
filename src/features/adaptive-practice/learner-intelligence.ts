import type { PracticePreferences } from "@/features/user-preferences/preferences-schema";
import { SPACE_SKIP_MARKER } from "@/lib/input/typing-markers";
import type {
  CharacterAttemptRecord,
  CharacterConfusionCount,
  CharacterPerformanceEntry,
  LearnerCharacterProfile,
  LearnerConfusionPair,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";

const RECENT_ATTEMPT_WINDOW = 12;
const CHARACTER_ATTEMPT_LIMIT = 36;
const HESITATION_MULTIPLIER = 1.35;
const HOUR_IN_MS = 60 * 60 * 1000;

export interface LearnerModelSummary {
  characterProfiles: Record<string, LearnerCharacterProfile>;
  topConfusionPairs: LearnerConfusionPair[];
  newCharacters: string[];
  shakyCharacters: string[];
  forgottenCharacters: string[];
  stableCharacters: string[];
  overtrainedCharacters: string[];
  scheduledReviewCharacters: string[];
  hesitationCharacters: string[];
  rankedCharacters: Array<{
    character: string;
    score: number;
  }>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function uniqueCharacters(characters: string[]) {
  return Array.from(new Set(characters.filter(Boolean)));
}

function getPaceMultiplier(progressionPace: PracticePreferences["progressionPace"]) {
  switch (progressionPace) {
    case "measured":
      return 0.88;
    case "accelerated":
      return 1.14;
    case "balanced":
    default:
      return 1;
  }
}

function sortAttemptsByRecency(left: CharacterAttemptRecord, right: CharacterAttemptRecord) {
  return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
}

function buildCharacterAttemptBuckets(
  sessionRecords: SessionRecord[],
  limitPerCharacter = CHARACTER_ATTEMPT_LIMIT,
) {
  const buckets = new Map<string, CharacterAttemptRecord[]>();
  const orderedAttempts = sessionRecords
    .slice()
    .sort(
      (left, right) =>
        new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime(),
    )
    .flatMap((sessionRecord) => sessionRecord.attemptLog)
    .sort(sortAttemptsByRecency);

  for (const attempt of orderedAttempts) {
    const existingAttempts = buckets.get(attempt.expectedCharacter) ?? [];

    if (existingAttempts.length < limitPerCharacter) {
      existingAttempts.push(attempt);
      buckets.set(attempt.expectedCharacter, existingAttempts);
    }
  }

  return buckets;
}

function isHesitantAttempt(
  attempt: CharacterAttemptRecord,
  masterySpeedGoal: number,
) {
  return attempt.hesitant ?? attempt.elapsedMs >= masterySpeedGoal * HESITATION_MULTIPLIER;
}

function averageResponseMs(attempts: CharacterAttemptRecord[], fallbackMs: number) {
  return attempts.length === 0
    ? fallbackMs
    : attempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0) / attempts.length;
}

function toConfusionCounts(
  attempts: CharacterAttemptRecord[],
): Record<string, { count: number; recentCount: number }> {
  const counters = new Map<string, { count: number; recentCount: number }>();

  for (const [attemptIndex, attempt] of attempts.entries()) {
    if (
      attempt.correct ||
      !attempt.enteredCharacter ||
      attempt.enteredCharacter === SPACE_SKIP_MARKER ||
      attempt.enteredCharacter === attempt.expectedCharacter
    ) {
      continue;
    }

    const existingEntry = counters.get(attempt.enteredCharacter) ?? {
      count: 0,
      recentCount: 0,
    };

    counters.set(attempt.enteredCharacter, {
      count: existingEntry.count + 1,
      recentCount:
        existingEntry.recentCount + (attemptIndex < RECENT_ATTEMPT_WINDOW ? 1 : 0),
    });
  }

  return Object.fromEntries(counters.entries());
}

function toTopConfusions(
  confusionCounts: Record<string, { count: number; recentCount: number }>,
): CharacterConfusionCount[] {
  return Object.entries(confusionCounts)
    .sort(
      (left, right) =>
        right[1].recentCount - left[1].recentCount || right[1].count - left[1].count,
    )
    .slice(0, 3)
    .map(([character, counts]) => ({
      character,
      count: counts.count,
    }));
}

function countRepeatedFailures(attempts: CharacterAttemptRecord[]) {
  const chronologicalAttempts = attempts.slice().reverse();
  let repeatedFailureCount = 0;
  let longestErrorRun = 0;
  let currentErrorRun = 0;
  let previousFailureSignature: string | null = null;

  for (const attempt of chronologicalAttempts) {
    if (attempt.correct) {
      currentErrorRun = 0;
      previousFailureSignature = null;
      continue;
    }

    currentErrorRun += 1;
    longestErrorRun = Math.max(longestErrorRun, currentErrorRun);

    const failureSignature = `${attempt.expectedCharacter}->${attempt.enteredCharacter}`;
    if (failureSignature === previousFailureSignature) {
      repeatedFailureCount += 1;
    } else if (currentErrorRun >= 2) {
      repeatedFailureCount += 1;
    }

    previousFailureSignature = failureSignature;
  }

  return {
    repeatedFailureCount,
    longestErrorRun,
  };
}

function findLatestAttempt(
  attempts: CharacterAttemptRecord[],
  predicate: (attempt: CharacterAttemptRecord) => boolean,
) {
  return attempts.find(predicate)?.occurredAt ?? null;
}

function classifyCharacterState(input: {
  attemptCount: number;
  recentAttemptCount: number;
  recentAccuracy: number;
  hesitationRate: number;
  repeatedFailureCount: number;
  masteryScore: number;
  memoryStrength: number;
  stabilityScore: number;
  hoursSinceLastSeen: number;
  hoursSinceIntroduced: number;
}) {
  if (
    input.attemptCount <= 4 ||
    (input.attemptCount <= 8 &&
      input.hoursSinceIntroduced < 30 &&
      input.recentAttemptCount < 10)
  ) {
    return "new" as const;
  }

  const lapsed = Number.isFinite(input.hoursSinceLastSeen) && input.hoursSinceLastSeen >= 24;
  if (
    lapsed &&
    input.memoryStrength < 72 &&
    (input.recentAccuracy < 0.9 ||
      input.hesitationRate >= 0.18 ||
      input.repeatedFailureCount >= 2)
  ) {
    return "forgotten" as const;
  }

  if (
    input.recentAccuracy < 0.86 ||
    input.hesitationRate >= 0.26 ||
    input.repeatedFailureCount >= 2 ||
    input.stabilityScore < 60 ||
    input.masteryScore < 58
  ) {
    return "shaky" as const;
  }

  if (
    input.memoryStrength >= 90 &&
    input.stabilityScore >= 86 &&
    input.hesitationRate <= 0.1 &&
    input.attemptCount >= 22 &&
    input.hoursSinceLastSeen <= 18
  ) {
    return "overtrained" as const;
  }

  return "stable" as const;
}

function computeReviewIntervalHours(input: {
  state: LearnerCharacterProfile["state"];
  masteryScore: number;
  memoryStrength: number;
  hesitationRate: number;
  attemptCount: number;
  progressionPace: PracticePreferences["progressionPace"];
}) {
  const paceMultiplier = getPaceMultiplier(input.progressionPace);
  let baseIntervalHours = 6;

  switch (input.state) {
    case "new":
      baseIntervalHours = 0.75 + Math.min(2.75, input.attemptCount * 0.3);
      break;
    case "forgotten":
      baseIntervalHours = 0.35;
      break;
    case "shaky":
      baseIntervalHours =
        2.2 +
        clamp(input.memoryStrength / 32, 0, 2.6) -
        clamp(input.hesitationRate * 3.5, 0, 1.2);
      break;
    case "overtrained":
      baseIntervalHours = 72 + clamp(input.memoryStrength * 0.7, 0, 56);
      break;
    case "stable":
    default:
      baseIntervalHours =
        12 +
        clamp(input.memoryStrength * 0.52, 0, 44) +
        clamp((input.masteryScore - 70) * 0.24, 0, 12);
      break;
  }

  return Number((Math.max(0.25, baseIntervalHours) * paceMultiplier).toFixed(2));
}

function buildConfusionPairs(
  characterProfiles: Record<string, LearnerCharacterProfile>,
  recentBuckets: Map<string, CharacterAttemptRecord[]>,
) {
  const pairAccumulator = new Map<string, LearnerConfusionPair>();

  for (const [character, profile] of Object.entries(characterProfiles)) {
    for (const confusion of profile.topConfusions) {
      const pairKey = `${character}->${confusion.character}`;
      const existingPair = pairAccumulator.get(pairKey);
      const recentCount =
        recentBuckets
          .get(character)
          ?.slice(0, RECENT_ATTEMPT_WINDOW)
          .filter(
            (attempt) =>
              !attempt.correct &&
              attempt.enteredCharacter === confusion.character,
          ).length ?? 0;

      pairAccumulator.set(pairKey, {
        pairKey,
        expectedCharacter: character,
        enteredCharacter: confusion.character,
        count: (existingPair?.count ?? 0) + confusion.count,
        recentCount: (existingPair?.recentCount ?? 0) + recentCount,
      });
    }
  }

  return Array.from(pairAccumulator.values()).sort(
    (left, right) =>
      right.recentCount - left.recentCount || right.count - left.count,
  );
}

export function scoreCharacterTrainingNeed(characterProfile: LearnerCharacterProfile) {
  const stateBias =
    characterProfile.state === "forgotten"
      ? 26
      : characterProfile.state === "shaky"
        ? 18
        : characterProfile.state === "new"
          ? 12
          : characterProfile.state === "stable"
            ? 4
            : -16;
  const speedPenalty = Math.max(0, characterProfile.recentResponseMs - 220) / 8;
  const accuracyPenalty = (1 - characterProfile.recentAccuracy) * 54;

  return Number(
    (
      stateBias +
      characterProfile.dueScore * 28 +
      characterProfile.recentMistakeCount * 10 +
      characterProfile.recentHesitationCount * 7 +
      characterProfile.repeatedFailureCount * 8 +
      accuracyPenalty +
      speedPenalty
    ).toFixed(2),
  );
}

export function buildLearnerModelSummary(options: {
  characters: string[];
  characterPerformanceMap: Record<string, CharacterPerformanceEntry>;
  sessionRecords: SessionRecord[];
  preferences: PracticePreferences;
  learnerProgressProfile?: LearnerProgressProfile | null;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const recentBuckets = buildCharacterAttemptBuckets(options.sessionRecords);
  const existingCharacterProfiles = options.learnerProgressProfile?.characterProfiles ?? {};
  const characters = uniqueCharacters([
    ...options.characters,
    ...Object.keys(options.characterPerformanceMap),
    ...Object.keys(existingCharacterProfiles),
    ...Array.from(recentBuckets.keys()),
  ]);
  const characterProfiles = Object.fromEntries(
    characters.map((character) => {
      const performanceEntry = options.characterPerformanceMap[character];
      const attempts = recentBuckets.get(character) ?? [];
      const recentAttempts = attempts.slice(0, RECENT_ATTEMPT_WINDOW);
      const attemptCount = performanceEntry?.attemptCount ?? attempts.length;
      const correctCount =
        performanceEntry?.correctCount ??
        attempts.filter((attempt) => attempt.correct).length;
      const mistakeCount =
        performanceEntry?.mistakeCount ?? Math.max(0, attemptCount - correctCount);
      const recentCorrectCount = recentAttempts.filter((attempt) => attempt.correct).length;
      const recentMistakeCount = recentAttempts.length - recentCorrectCount;
      const hesitationCount =
        performanceEntry?.hesitationCount ??
        attempts.filter((attempt) =>
          isHesitantAttempt(attempt, options.preferences.masterySpeedGoal),
        ).length;
      const recentHesitationCount = recentAttempts.filter((attempt) =>
        isHesitantAttempt(attempt, options.preferences.masterySpeedGoal),
      ).length;
      const hesitationRate =
        attemptCount === 0 ? 0 : hesitationCount / Math.max(1, attemptCount);
      const recentAccuracy =
        recentAttempts.length === 0
          ? attemptCount === 0
            ? 0
            : correctCount / Math.max(1, attemptCount)
          : recentCorrectCount / recentAttempts.length;
      const accuracy = attemptCount === 0 ? 0 : correctCount / Math.max(1, attemptCount);
      const meanResponseMs =
        performanceEntry?.smoothedResponseMs ??
        averageResponseMs(attempts, options.preferences.masterySpeedGoal * 1.4);
      const recentResponseMs = averageResponseMs(recentAttempts, meanResponseMs);
      const confusionCounts =
        performanceEntry?.confusionCounts != null
          ? Object.fromEntries(
              Object.entries(performanceEntry.confusionCounts).map(([enteredCharacter, count]) => [
                enteredCharacter,
                {
                  count,
                  recentCount:
                    recentAttempts.filter(
                      (attempt) =>
                        !attempt.correct && attempt.enteredCharacter === enteredCharacter,
                    ).length,
                },
              ]),
            )
          : toConfusionCounts(attempts);
      const topConfusions =
        performanceEntry?.dominantConfusions && performanceEntry.dominantConfusions.length > 0
          ? performanceEntry.dominantConfusions
          : toTopConfusions(confusionCounts);
      const previousProfile = existingCharacterProfiles[character];
      const lastSeenAt = performanceEntry?.lastSeenAt ?? attempts[0]?.occurredAt ?? previousProfile?.lastSeenAt ?? null;
      const introducedAt =
        previousProfile?.introducedAt ?? lastSeenAt ?? now.toISOString();
      const hoursSinceLastSeen =
        lastSeenAt == null
          ? Number.POSITIVE_INFINITY
          : (now.getTime() - new Date(lastSeenAt).getTime()) / HOUR_IN_MS;
      const hoursSinceIntroduced =
        (now.getTime() - new Date(introducedAt).getTime()) / HOUR_IN_MS;
      const responsePenalty = clamp(
        ((recentResponseMs - options.preferences.masterySpeedGoal) /
          options.preferences.masterySpeedGoal) *
          24,
        0,
        32,
      );
      const { repeatedFailureCount } = countRepeatedFailures(recentAttempts);
      const confusionPenalty = topConfusions.reduce(
        (sum, confusion) => sum + Math.min(confusion.count, 3) * 1.8,
        0,
      );
      const memoryStrength = Math.round(
        clamp(
          (performanceEntry?.masteryScore ?? 0) * 0.42 +
            accuracy * 100 * 0.24 +
            Math.min(attemptCount / 20, 1) * 18 +
            Math.max(0, 16 - responsePenalty) -
            hesitationRate * 26 -
            repeatedFailureCount * 5 -
            confusionPenalty,
          0,
          100,
        ),
      );
      const stabilityScore = Math.round(
        clamp(
          recentAccuracy * 100 * 0.56 +
            Math.min(recentAttempts.length / RECENT_ATTEMPT_WINDOW, 1) * 12 +
            Math.min(attemptCount / 16, 1) * 12 -
            hesitationRate * 32 -
            repeatedFailureCount * 5 -
            responsePenalty,
          0,
          100,
        ),
      );
      const state = classifyCharacterState({
        attemptCount,
        recentAttemptCount: recentAttempts.length,
        recentAccuracy,
        hesitationRate,
        repeatedFailureCount,
        masteryScore: performanceEntry?.masteryScore ?? 0,
        memoryStrength,
        stabilityScore,
        hoursSinceLastSeen,
        hoursSinceIntroduced,
      });
      const reviewIntervalHours = computeReviewIntervalHours({
        state,
        masteryScore: performanceEntry?.masteryScore ?? 0,
        memoryStrength,
        hesitationRate,
        attemptCount,
        progressionPace: options.preferences.progressionPace,
      });
      const nextReviewAt =
        lastSeenAt == null
          ? now.toISOString()
          : new Date(
              new Date(lastSeenAt).getTime() + reviewIntervalHours * HOUR_IN_MS,
            ).toISOString();
      const hoursPastDue =
        lastSeenAt == null
          ? 0
          : (now.getTime() - new Date(nextReviewAt).getTime()) / HOUR_IN_MS;
      const dueScore = Number(
        clamp(
          Math.max(0, hoursPastDue / Math.max(reviewIntervalHours, 0.25)) +
            (state === "forgotten"
              ? 1
              : state === "shaky"
                ? 0.45
                : state === "new"
                  ? 0.2
                  : state === "overtrained"
                    ? -0.4
                    : 0),
          0,
          6,
        ).toFixed(2),
      );

      return [
        character,
        {
          character,
          state,
          introducedAt,
          lastSeenAt,
          lastCorrectAt: findLatestAttempt(attempts, (attempt) => attempt.correct),
          lastMistakeAt: findLatestAttempt(attempts, (attempt) => !attempt.correct),
          attemptCount,
          recentAttemptCount: recentAttempts.length,
          accuracy: Number(accuracy.toFixed(3)),
          recentAccuracy: Number(recentAccuracy.toFixed(3)),
          mistakeCount,
          recentMistakeCount,
          hesitationCount,
          recentHesitationCount,
          hesitationRate: Number(hesitationRate.toFixed(3)),
          repeatedFailureCount,
          masteryScore: performanceEntry?.masteryScore ?? 0,
          meanResponseMs: Math.round(meanResponseMs),
          recentResponseMs: Math.round(recentResponseMs),
          memoryStrength,
          stabilityScore,
          dueScore,
          reviewIntervalHours,
          nextReviewAt,
          topConfusions,
        } satisfies LearnerCharacterProfile,
      ];
    }),
  );
  const topConfusionPairs = buildConfusionPairs(characterProfiles, recentBuckets);
  const rankedCharacters = Object.values(characterProfiles)
    .map((characterProfile) => ({
      character: characterProfile.character,
      score: scoreCharacterTrainingNeed(characterProfile),
    }))
    .sort((left, right) => right.score - left.score);
  const stateBuckets = Object.values(characterProfiles).reduce(
    (accumulator, characterProfile) => {
      accumulator[characterProfile.state].push(characterProfile.character);
      return accumulator;
    },
    {
      new: [] as string[],
      shaky: [] as string[],
      forgotten: [] as string[],
      stable: [] as string[],
      overtrained: [] as string[],
    },
  );
  const scheduledReviewCharacters = Object.values(characterProfiles)
    .filter(
      (characterProfile) =>
        characterProfile.dueScore >= 0.25 && characterProfile.state !== "overtrained",
    )
    .sort((left, right) => right.dueScore - left.dueScore)
    .map((characterProfile) => characterProfile.character);
  const hesitationCharacters = Object.values(characterProfiles)
    .filter((characterProfile) => characterProfile.recentHesitationCount > 0)
    .sort(
      (left, right) =>
        right.recentHesitationCount - left.recentHesitationCount ||
        right.recentResponseMs - left.recentResponseMs,
    )
    .map((characterProfile) => characterProfile.character);

  return {
    characterProfiles,
    topConfusionPairs,
    newCharacters: stateBuckets.new,
    shakyCharacters: stateBuckets.shaky,
    forgottenCharacters: stateBuckets.forgotten,
    stableCharacters: stateBuckets.stable,
    overtrainedCharacters: stateBuckets.overtrained,
    scheduledReviewCharacters,
    hesitationCharacters,
    rankedCharacters,
  } satisfies LearnerModelSummary;
}
