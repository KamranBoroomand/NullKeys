import type {
  PreferredContentFamilyId,
  PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import type {
  ContentDifficultyBand,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";

export interface ContentDifficultyProfile {
  overallBand: ContentDifficultyBand;
  familyBands: Record<PreferredContentFamilyId, ContentDifficultyBand>;
}

const difficultyBands = [
  "foundational",
  "developing",
  "fluent",
  "advanced",
  "expert-control",
] as const satisfies readonly ContentDifficultyBand[];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getDifficultyBandIndex(difficultyBand: ContentDifficultyBand) {
  return difficultyBands.indexOf(difficultyBand);
}

export function shiftDifficultyBand(
  difficultyBand: ContentDifficultyBand,
  delta: number,
): ContentDifficultyBand {
  const nextIndex = clamp(
    getDifficultyBandIndex(difficultyBand) + delta,
    0,
    difficultyBands.length - 1,
  );

  return difficultyBands[nextIndex];
}

export function resolveDifficultyBand(score: number): ContentDifficultyBand {
  if (score < 0.22) {
    return "foundational";
  }

  if (score < 0.42) {
    return "developing";
  }

  if (score < 0.62) {
    return "fluent";
  }

  if (score < 0.8) {
    return "advanced";
  }

  return "expert-control";
}

export function buildAdaptiveContentDifficultyProfile(options: {
  preferences: PracticePreferences;
  recentSessions: SessionRecord[];
  learnerProgressProfile: LearnerProgressProfile | null;
  progressionStageCount: number;
  forgottenCount: number;
  hesitationCount: number;
  confusionPairCount: number;
}) {
  const stageShare =
    options.progressionStageCount <= 1
      ? 0
      : (options.learnerProgressProfile?.currentStageIndex ?? 0) /
        (options.progressionStageCount - 1);
  const readinessShare = (options.learnerProgressProfile?.recentReadinessScore ?? 0) / 100;
  const stabilityShare = (options.learnerProgressProfile?.recentStabilityScore ?? 0) / 100;
  const experienceShare = Math.min(
    1,
    (options.learnerProgressProfile?.completedAdaptiveSessions ?? 0) / 24,
  );
  const regressionPenalty = options.learnerProgressProfile?.regressionHold ? 0.14 : 0;
  const pressurePenalty = clamp(
    options.forgottenCount * 0.045 +
      options.hesitationCount * 0.012 +
      options.confusionPairCount * 0.01 +
      regressionPenalty,
    0,
    0.42,
  );
  const paceAdjustment =
    options.preferences.progressionPace === "accelerated"
      ? 0.06
      : options.preferences.progressionPace === "measured"
        ? -0.04
        : 0;
  const baseScore = clamp(
    stageShare * 0.42 +
      readinessShare * 0.22 +
      stabilityShare * 0.2 +
      experienceShare * 0.16 +
      paceAdjustment -
      pressurePenalty,
    0,
    1,
  );
  const overallBand = resolveDifficultyBand(baseScore);
  const recentCodeSessions = options.recentSessions
    .slice(0, 10)
    .filter((sessionRecord) => sessionRecord.sessionFlavor === "code").length;
  const recentNumberSessions = options.recentSessions
    .slice(0, 10)
    .filter((sessionRecord) => sessionRecord.sessionFlavor === "numbers").length;
  const familyBands: Record<PreferredContentFamilyId, ContentDifficultyBand> = {
    "adaptive-blend":
      options.learnerProgressProfile?.regressionHold || options.forgottenCount > 0
        ? shiftDifficultyBand(overallBand, -1)
        : overallBand,
    "common-words": overallBand,
    "pseudo-words":
      overallBand === "foundational" ? "foundational" : shiftDifficultyBand(overallBand, 1),
    "phrase-drills":
      stageShare < 0.2 || !options.preferences.punctuationEnabled
        ? shiftDifficultyBand(overallBand, -1)
        : overallBand,
    "quote-drills":
      experienceShare < 0.18 ? shiftDifficultyBand(overallBand, -1) : overallBand,
    "symbol-drills":
      options.preferences.punctuationEnabled ? overallBand : shiftDifficultyBand(overallBand, -1),
    "number-drills":
      options.preferences.activeCharacterRange === "core" && recentNumberSessions === 0
        ? shiftDifficultyBand(overallBand, -1)
        : overallBand,
    "code-drills":
      options.preferences.programmerModeEnabled || recentCodeSessions >= 2
        ? overallBand
        : shiftDifficultyBand(overallBand, -1),
    "shell-drills":
      options.preferences.programmerModeEnabled || recentCodeSessions >= 2
        ? shiftDifficultyBand(overallBand, 1)
        : shiftDifficultyBand(overallBand, -1),
  };

  return {
    overallBand,
    familyBands,
  } satisfies ContentDifficultyProfile;
}

export function buildBenchmarkDifficultyBand(options: {
  contentFamilyId: PreferredContentFamilyId;
  durationSeconds: number;
  recentSessions: SessionRecord[];
}) {
  const recentComparableRuns = options.recentSessions
    .slice(0, 12)
    .filter(
      (sessionRecord) =>
        sessionRecord.sessionKind === "benchmark" &&
        sessionRecord.contentFamilyId === options.contentFamilyId,
    ).length;
  const baseScore =
    (options.durationSeconds >= 90 ? 0.68 : options.durationSeconds >= 60 ? 0.54 : 0.4) +
    Math.min(0.16, recentComparableRuns * 0.02) +
    (options.contentFamilyId === "quote-drills"
      ? 0.08
      : options.contentFamilyId === "pseudo-words" || options.contentFamilyId === "shell-drills"
        ? 0.06
        : 0);

  return resolveDifficultyBand(baseScore);
}
