import { buildLearnerModelSummary, scoreCharacterTrainingNeed } from "@/features/adaptive-practice/learner-intelligence";
import { buildAdaptiveContentDifficultyProfile } from "@/features/adaptive-practice/content-difficulty";
import {
  buildKeyboardCompanionMap,
  buildKeyboardTrainingProfile,
} from "@/features/keyboard-visualizer/keyboard-layout-registry";
import {
  buildProgressionStages,
  type ProgressionStageDefinition,
} from "@/features/adaptive-practice/learner-progression";
import {
  buildLanguageCharacterPool,
  getLanguageDefinition,
} from "@/features/language-support/language-registry";
import type {
  CharacterPerformanceEntry,
  LearnerConfusionPair,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";
import type { PracticePreferences } from "@/features/user-preferences/preferences-schema";

export interface AdaptiveSessionPlan {
  activeCharacterSet: string[];
  unlockedCharacters: string[];
  focusCharacter: string | null;
  priorityCharacters: string[];
  rebalanceCharacters: string[];
  weakCharacters: string[];
  newCharacters: string[];
  shakyCharacters: string[];
  forgottenCharacters: string[];
  recoveryCharacters: string[];
  reinforcementCharacters: string[];
  bridgeCharacters: string[];
  hesitationCharacters: string[];
  confusionPairs: LearnerConfusionPair[];
  explorationCharacters: string[];
  fluencyCharacters: string[];
  stableReviewCharacters: string[];
  overtrainedCharacters: string[];
  unlockPreviewCharacters: string[];
  lessonBalance: {
    recoveryShare: number;
    reinforcementShare: number;
    bridgeShare: number;
    explorationShare: number;
    fluencyShare: number;
    symbolShare: number;
    confusionShare: number;
    transitionShare: number;
  };
  suggestedFlavor: "plain" | "mixed" | "symbols" | "code" | "numbers";
  adaptiveLessonPreference: "common-words" | "phrase-drills" | "quote-drills";
  adaptiveLessonReason: string;
  contentDifficultyBand: import("@/lib/scoring/session-models").ContentDifficultyBand;
  contentDifficultyBandsByFamily: Record<
    import("@/features/user-preferences/preferences-schema").PreferredContentFamilyId,
    import("@/lib/scoring/session-models").ContentDifficultyBand
  >;
  progressionSummary: {
    currentStageIndex: number;
    totalStages: number;
    readinessScore: number;
    stabilityScore: number;
    regressionHold: boolean;
    nextStageCharacters: string[];
    unlockedCharacterCount: number;
    scheduledReviewCount: number;
    forgottenCount: number;
    confusionPairCount: number;
  };
}

function uniqueCharacterList(characters: string[]) {
  return Array.from(new Set(characters.filter(Boolean)));
}

function buildAllowedCharacterSet(options: {
  unlockedCharacters: string[];
  activeCharacterSet: string[];
  unlockPreviewCharacters: string[];
}) {
  return new Set([
    ...options.unlockedCharacters,
    ...options.activeCharacterSet,
    ...options.unlockPreviewCharacters,
  ]);
}

function findNextStageCharacters(
  progressionStages: ProgressionStageDefinition[],
  progressionProfile: LearnerProgressProfile | null,
) {
  if (!progressionProfile) {
    return progressionStages[1]?.characters ?? [];
  }

  return progressionStages[progressionProfile.currentStageIndex + 1]?.characters ?? [];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function countCharactersInSet(characters: string[], targetCharacters: Set<string>) {
  return characters.filter((character) => targetCharacters.has(character)).length;
}

function normalizeLessonBalance(input: {
  recoveryWeight: number;
  reinforcementWeight: number;
  bridgeWeight: number;
  explorationWeight: number;
  fluencyWeight: number;
  symbolWeight: number;
  confusionWeight: number;
  transitionWeight: number;
}) {
  const totalWeight = Object.values(input).reduce((sum, value) => sum + value, 0);

  if (totalWeight === 0) {
    return {
      recoveryShare: 0.28,
      reinforcementShare: 0.2,
      bridgeShare: 0.16,
      explorationShare: 0.08,
      fluencyShare: 0.16,
      symbolShare: 0.04,
      confusionShare: 0.04,
      transitionShare: 0.04,
    };
  }

  return {
    recoveryShare: Number((input.recoveryWeight / totalWeight).toFixed(3)),
    reinforcementShare: Number((input.reinforcementWeight / totalWeight).toFixed(3)),
    bridgeShare: Number((input.bridgeWeight / totalWeight).toFixed(3)),
    explorationShare: Number((input.explorationWeight / totalWeight).toFixed(3)),
    fluencyShare: Number((input.fluencyWeight / totalWeight).toFixed(3)),
    symbolShare: Number((input.symbolWeight / totalWeight).toFixed(3)),
    confusionShare: Number((input.confusionWeight / totalWeight).toFixed(3)),
    transitionShare: Number((input.transitionWeight / totalWeight).toFixed(3)),
  };
}

const difficultyBandOrder = [
  "foundational",
  "developing",
  "fluent",
  "advanced",
  "expert-control",
] as const satisfies readonly import("@/lib/scoring/session-models").ContentDifficultyBand[];

function getDifficultyBandIndex(
  difficultyBand: import("@/lib/scoring/session-models").ContentDifficultyBand,
) {
  return Math.max(0, difficultyBandOrder.indexOf(difficultyBand));
}

export function planAdaptiveSession(options: {
  characterPerformanceMap: Record<string, CharacterPerformanceEntry>;
  preferences: PracticePreferences;
  recentSessions: SessionRecord[];
  learnerProgressProfile: LearnerProgressProfile | null;
}) {
  const fallbackCharacterSet = buildLanguageCharacterPool({
    languageId: options.preferences.selectedLanguageId,
    punctuationEnabled: options.preferences.punctuationEnabled,
    capitalizationEnabled: options.preferences.capitalizationEnabled,
    activeCharacterRange: options.preferences.activeCharacterRange,
  });
  const progressionStages = buildProgressionStages({
    preferences: options.preferences,
  });
  const activeCharacterSet =
    options.learnerProgressProfile?.activeCharacterSet.length
      ? options.learnerProgressProfile.activeCharacterSet
      : fallbackCharacterSet;
  const unlockedCharacters =
    options.learnerProgressProfile?.unlockedCharacters.length
      ? options.learnerProgressProfile.unlockedCharacters
      : activeCharacterSet;
  const unlockPreviewCharacters =
    options.learnerProgressProfile?.unlockPreviewCharacters ?? findNextStageCharacters(
      progressionStages,
      options.learnerProgressProfile,
    ).slice(0, 2);
  const companionMap = buildKeyboardCompanionMap(
    options.preferences.selectedKeyboardLayoutId,
    options.preferences.selectedLanguageId,
  );
  const keyboardTrainingProfile = buildKeyboardTrainingProfile(
    options.preferences.selectedKeyboardLayoutId,
    options.preferences.selectedLanguageId,
  );
  const languageDefinition = getLanguageDefinition(options.preferences.selectedLanguageId);
  const learnerModel = buildLearnerModelSummary({
    characters: uniqueCharacterList([
      ...unlockedCharacters,
      ...activeCharacterSet,
      ...unlockPreviewCharacters,
    ]),
    characterPerformanceMap: options.characterPerformanceMap,
    sessionRecords: options.recentSessions,
    preferences: options.preferences,
    learnerProgressProfile: options.learnerProgressProfile,
  });
  const newCharacters =
    options.learnerProgressProfile?.newCharacters?.length
      ? options.learnerProgressProfile.newCharacters
      : learnerModel.newCharacters;
  const shakyCharacters =
    options.learnerProgressProfile?.shakyCharacters?.length
      ? options.learnerProgressProfile.shakyCharacters
      : learnerModel.shakyCharacters;
  const forgottenCharacters =
    options.learnerProgressProfile?.forgottenCharacters?.length
      ? options.learnerProgressProfile.forgottenCharacters
      : learnerModel.forgottenCharacters;
  const stableCharacters =
    options.learnerProgressProfile?.stableCharacters?.length
      ? options.learnerProgressProfile.stableCharacters
      : learnerModel.stableCharacters;
  const overtrainedCharacters =
    options.learnerProgressProfile?.overtrainedCharacters?.length
      ? options.learnerProgressProfile.overtrainedCharacters
      : learnerModel.overtrainedCharacters;
  const hesitationCharacters =
    options.learnerProgressProfile?.hesitationCharacters?.length
      ? options.learnerProgressProfile.hesitationCharacters
      : learnerModel.hesitationCharacters;
  const scheduledReviewCharacters =
    options.learnerProgressProfile?.scheduledReviewCharacters?.length
      ? options.learnerProgressProfile.scheduledReviewCharacters
      : learnerModel.scheduledReviewCharacters;
  const confusionPairs =
    options.learnerProgressProfile?.topConfusionPairs?.length
      ? options.learnerProgressProfile.topConfusionPairs
      : learnerModel.topConfusionPairs;
  const characterProfiles = learnerModel.characterProfiles;
  const allowedCharacters = buildAllowedCharacterSet({
    unlockedCharacters,
    activeCharacterSet,
    unlockPreviewCharacters,
  });
  const rankedCharacters = Object.values(characterProfiles)
    .map((characterProfile) => ({
      character: characterProfile.character,
      score: scoreCharacterTrainingNeed(characterProfile),
    }))
    .sort((left, right) => right.score - left.score);
  const weakCharacters = rankedCharacters
    .filter((entry) => unlockedCharacters.includes(entry.character))
    .slice(0, 12)
    .map((entry) => entry.character);
  const recoveryCharacters = uniqueCharacterList([
    ...forgottenCharacters,
    ...shakyCharacters.filter(
      (character) =>
        (characterProfiles[character]?.dueScore ?? 0) >= 0.35 ||
        (characterProfiles[character]?.masteryScore ?? 0) < 55 ||
        rankedCharacters.slice(0, 6).some((entry) => entry.character === character),
    ),
    ...hesitationCharacters.filter(
      (character) => (characterProfiles[character]?.state ?? "stable") !== "stable",
    ),
  ]).slice(0, 8);
  const reinforcementCharacters = uniqueCharacterList([
    ...(options.learnerProgressProfile?.reinforcementCharacters ?? []),
    ...newCharacters,
    ...shakyCharacters.filter(
      (character) =>
        (characterProfiles[character]?.attemptCount ?? 0) < 8,
    ),
  ]).slice(0, 8);
  const bridgeCharacters = uniqueCharacterList([
    ...recoveryCharacters.flatMap((character) => companionMap[character.toLowerCase()] ?? []),
    ...shakyCharacters.flatMap((character) => companionMap[character.toLowerCase()] ?? []),
    ...confusionPairs.slice(0, 4).flatMap((pair) => [
      pair.expectedCharacter,
      pair.enteredCharacter,
    ]),
    ...scheduledReviewCharacters.filter((character) => stableCharacters.includes(character)),
  ])
    .filter((character) => allowedCharacters.has(character))
    .slice(0, 10);
  const stableReviewCharacters = uniqueCharacterList([
    ...scheduledReviewCharacters.filter((character) => stableCharacters.includes(character)),
    ...stableCharacters,
  ]).slice(0, 10);
  const explorationCharacters = uniqueCharacterList([
    ...unlockPreviewCharacters,
    ...newCharacters,
  ]).slice(0, 6);
  const confusionCharacters = uniqueCharacterList(
    confusionPairs.slice(0, 5).flatMap((pair) => [pair.expectedCharacter, pair.enteredCharacter]),
  ).filter((character) => allowedCharacters.has(character));
  const fluencyCharacters = stableReviewCharacters
    .filter((character) => !overtrainedCharacters.includes(character))
    .slice(0, 8);
  const focusCharacter =
    forgottenCharacters[0] ??
    shakyCharacters[0] ??
    newCharacters[0] ??
    weakCharacters[0] ??
    activeCharacterSet[0] ??
    null;
  const focusConfusionPair =
    confusionPairs.find((pair) => pair.expectedCharacter === focusCharacter) ?? null;
  const priorityCharacters = uniqueCharacterList([
    ...(focusCharacter ? [focusCharacter] : []),
    ...(focusCharacter ? companionMap[focusCharacter.toLowerCase()] ?? [] : []).slice(0, 2),
    ...(focusConfusionPair
      ? [focusConfusionPair.expectedCharacter, focusConfusionPair.enteredCharacter]
      : []),
    ...recoveryCharacters.slice(0, 3),
    ...reinforcementCharacters.slice(0, 3),
    ...bridgeCharacters.slice(0, 2),
    ...explorationCharacters.slice(0, 2),
  ]).slice(0, 10);
  const punctuationCharacters = new Set([
    ...languageDefinition.punctuation,
    ...languageDefinition.quotes,
  ]);
  const digitCharacters = new Set([
    ...languageDefinition.digits,
    ...languageDefinition.nativeDigits,
  ]);
  const rebalanceCharacters = uniqueCharacterList([
    ...bridgeCharacters,
    ...stableReviewCharacters.slice(0, 4),
    ...confusionCharacters,
    ...(options.preferences.preferredContentFamilyId === "adaptive-blend"
      ? []
      : options.preferences.numpadEnabled && keyboardTrainingProfile.supportsNumpad
        ? keyboardTrainingProfile.numpadCharacters
        : languageDefinition.digits.slice(0, 5)),
  ]).slice(0, 12);
  const symbolPressure =
    priorityCharacters.filter((character) =>
      [...languageDefinition.punctuation, ...languageDefinition.quotes].includes(character),
    ).length / Math.max(priorityCharacters.length, 1);
  const digitPressure =
    priorityCharacters.filter((character) => languageDefinition.digits.includes(character)).length /
    Math.max(priorityCharacters.length, 1);
  const programmerPressure = options.recentSessions
    .slice(0, 8)
    .filter((sessionRecord) => sessionRecord.programmerDrillPresetId !== undefined).length;
  const confusionPressure = confusionPairs.slice(0, 3).reduce(
    (sum, pair) => sum + pair.recentCount,
    0,
  );
  const regressionHold = options.learnerProgressProfile?.regressionHold ?? false;
  const contentDifficultyProfile = buildAdaptiveContentDifficultyProfile({
    preferences: options.preferences,
    recentSessions: options.recentSessions,
    learnerProgressProfile: options.learnerProgressProfile,
    progressionStageCount: progressionStages.length,
    forgottenCount: forgottenCharacters.length,
    hesitationCount: hesitationCharacters.length,
    confusionPairCount: confusionPairs.length,
  });
  const adaptiveDifficultyBand = contentDifficultyProfile.familyBands["adaptive-blend"];
  const adaptiveDifficultyBandIndex = getDifficultyBandIndex(adaptiveDifficultyBand);
  const currentStageIndex = options.learnerProgressProfile?.currentStageIndex ?? 0;
  const recentReadinessScore = options.learnerProgressProfile?.recentReadinessScore ?? 0;
  const recentStabilityScore = options.learnerProgressProfile?.recentStabilityScore ?? 0;
  const completedAdaptiveSessions =
    options.learnerProgressProfile?.completedAdaptiveSessions ??
    options.recentSessions.filter((sessionRecord) => sessionRecord.sessionKind === "adaptive").length;
  const adaptiveNonLetterPriorityCount =
    countCharactersInSet(priorityCharacters, punctuationCharacters) +
    countCharactersInSet(priorityCharacters, digitCharacters);
  const adaptiveNonLetterRecoveryCount =
    countCharactersInSet(
      uniqueCharacterList([
        ...recoveryCharacters,
        ...reinforcementCharacters,
      ]),
      punctuationCharacters,
    ) +
    countCharactersInSet(
      uniqueCharacterList([
        ...recoveryCharacters,
        ...reinforcementCharacters,
      ]),
      digitCharacters,
    );
  const adaptiveConfusionTailCount =
    countCharactersInSet(confusionCharacters, punctuationCharacters) +
    countCharactersInSet(confusionCharacters, digitCharacters);
  const adaptiveFocusNeedsMixed =
    focusCharacter !== null &&
    (punctuationCharacters.has(focusCharacter) || digitCharacters.has(focusCharacter)) &&
    (priorityCharacters.includes(focusCharacter) ||
      recoveryCharacters.includes(focusCharacter) ||
      reinforcementCharacters.includes(focusCharacter) ||
      hesitationCharacters.includes(focusCharacter));
  const unlockedLetterCount = unlockedCharacters.filter(
    (character) => !punctuationCharacters.has(character) && !digitCharacters.has(character),
  ).length;
  const explicitNonLetterRecoveryPressure =
    adaptiveNonLetterPriorityCount >= 3 || adaptiveNonLetterRecoveryCount >= 2;
  const explicitLaterNonLetterLesson =
    currentStageIndex >= 4 &&
    recentReadinessScore >= 72 &&
    recentStabilityScore >= 74 &&
    forgottenCharacters.length === 0 &&
    adaptiveNonLetterRecoveryCount >= 2 &&
    (
      adaptiveFocusNeedsMixed ||
      adaptiveNonLetterPriorityCount >= 2 ||
      adaptiveNonLetterRecoveryCount >= 3 ||
      adaptiveConfusionTailCount >= 2
    );
  const foundationalAdaptiveRestraint =
    (adaptiveDifficultyBandIndex <= 1 && !explicitLaterNonLetterLesson) ||
    currentStageIndex <= 2 ||
    unlockedLetterCount < 18 ||
    recentReadinessScore < 68 ||
    recentStabilityScore < 70 ||
    completedAdaptiveSessions < 6 ||
    forgottenCharacters.length > 0 ||
    (recoveryCharacters.length >= 3 && !explicitLaterNonLetterLesson) ||
    (reinforcementCharacters.length >= 4 && !explicitLaterNonLetterLesson) ||
    (newCharacters.length >= 2 && recentStabilityScore < 76) ||
    (newCharacters.length > 0 && !explicitNonLetterRecoveryPressure);
  const shouldUseAdaptiveMixedFlavor =
    !foundationalAdaptiveRestraint &&
    recentStabilityScore >= 72 &&
    (explicitLaterNonLetterLesson ||
      (adaptiveFocusNeedsMixed
        ? adaptiveNonLetterPriorityCount >= 2 ||
          adaptiveNonLetterRecoveryCount >= 1 ||
          adaptiveConfusionTailCount >= 1
        : adaptiveNonLetterPriorityCount >= 4 &&
          (adaptiveNonLetterRecoveryCount >= 2 ||
            adaptiveConfusionTailCount >= 2 ||
            symbolPressure >= 0.32 ||
            (options.preferences.numpadEnabled && digitPressure >= 0.36))));
  const suggestedFlavor =
    options.preferences.preferredContentFamilyId === "adaptive-blend"
      ? shouldUseAdaptiveMixedFlavor
        ? "mixed"
        : "plain"
      : options.preferences.programmerModeEnabled
        ? "code"
        : digitPressure > 0.34 && options.preferences.numpadEnabled
          ? "numbers"
          : symbolPressure > 0.28
            ? "symbols"
            : confusionPressure > 0 || hesitationCharacters.length > 0 || programmerPressure < 2
              ? "mixed"
              : "plain";
  const lessonBalance = normalizeLessonBalance({
    recoveryWeight: regressionHold
      ? 3.6 + forgottenCharacters.length * 0.6 + recoveryCharacters.length * 0.35
      : 2.6 + forgottenCharacters.length * 0.5 + recoveryCharacters.length * 0.28,
    reinforcementWeight: 2 + reinforcementCharacters.length * 0.28 + newCharacters.length * 0.2,
    bridgeWeight: 1.6 + bridgeCharacters.length * 0.18 + confusionCharacters.length * 0.14,
    explorationWeight:
      unlockPreviewCharacters.length > 0 ? 0.9 + explorationCharacters.length * 0.2 : 0.45,
    fluencyWeight:
      regressionHold
        ? 0.7 + fluencyCharacters.length * 0.1
        : 1.35 + fluencyCharacters.length * 0.16,
    symbolWeight:
      suggestedFlavor === "symbols" || suggestedFlavor === "mixed" || suggestedFlavor === "code"
        ? 0.65 + symbolPressure
        : 0.28,
    confusionWeight: 0.55 + confusionCharacters.length * 0.2,
    transitionWeight: 0.55 + explorationCharacters.length * 0.18 + newCharacters.length * 0.14,
  });
  const shouldKeepAdaptiveGrounded =
    regressionHold ||
    foundationalAdaptiveRestraint ||
    forgottenCharacters.length > 0 ||
    recoveryCharacters.length >= 3 ||
    recentReadinessScore < 68 ||
    recentStabilityScore < 70 ||
    (newCharacters.length > 0 && stableReviewCharacters.length < 4);
  const shouldPreferPassages =
    !shouldKeepAdaptiveGrounded &&
    !regressionHold &&
    forgottenCharacters.length === 0 &&
    newCharacters.length === 0 &&
    hesitationCharacters.length <= 1 &&
    confusionPairs.length <= 1 &&
    adaptiveDifficultyBandIndex >= 3 &&
    currentStageIndex >= 3 &&
    recentReadinessScore >= 82 &&
    recentStabilityScore >= 79 &&
    completedAdaptiveSessions >= 10 &&
    stableReviewCharacters.length >= 5 &&
    unlockedLetterCount >= 18;
  const shouldPreferPhrases =
    !shouldPreferPassages &&
    !shouldKeepAdaptiveGrounded &&
    !regressionHold &&
    forgottenCharacters.length === 0 &&
    recentReadinessScore >= 68 &&
    recentStabilityScore >= 68 &&
    ((newCharacters.length === 1 &&
      stableReviewCharacters.length >= 4 &&
      unlockedLetterCount >= 12) ||
      (unlockPreviewCharacters.length === 1 &&
        stableReviewCharacters.length >= 4 &&
        currentStageIndex >= 2) ||
      (adaptiveDifficultyBandIndex >= 2 &&
        stableReviewCharacters.length >= 4 &&
        unlockedLetterCount >= 14) ||
      (adaptiveDifficultyBandIndex >= 1 &&
        bridgeCharacters.length >= 3 &&
        stableReviewCharacters.length >= 4));
  const adaptiveLessonPreference = shouldPreferPassages
    ? "quote-drills"
    : shouldPreferPhrases
      ? "phrase-drills"
      : "common-words";
  const adaptiveLessonReason =
    adaptiveLessonPreference === "quote-drills"
      ? "Stability is strong enough for connected passages, so review can stay inside calm prose instead of shorter recovery lines."
      : adaptiveLessonPreference === "phrase-drills"
        ? newCharacters.length > 0 || unlockPreviewCharacters.length > 0
          ? "Short readable phrases can widen the lesson gently, so the next character group arrives inside steady language instead of a jump."
          : "Readable phrases fit here because the lesson can widen a little while staying calm and confidence-building."
        : forgottenCharacters.length > 0 || regressionHold || shouldKeepAdaptiveGrounded
          ? "Recovery pressure is still high enough that the next step should stay on cleaner words until the current layer feels settled."
          : "Short familiar words are still the right next step while this character set settles.";

  return {
    activeCharacterSet,
    unlockedCharacters,
    focusCharacter,
    priorityCharacters,
    rebalanceCharacters,
    weakCharacters: options.preferences.retrainWeakCharacters
      ? weakCharacters
      : priorityCharacters.slice(0, 4),
    newCharacters,
    shakyCharacters,
    forgottenCharacters,
    recoveryCharacters,
    reinforcementCharacters,
    bridgeCharacters,
    hesitationCharacters,
    confusionPairs,
    explorationCharacters,
    fluencyCharacters,
    stableReviewCharacters,
    overtrainedCharacters,
    unlockPreviewCharacters,
    lessonBalance,
    suggestedFlavor,
    adaptiveLessonPreference,
    adaptiveLessonReason,
    contentDifficultyBand:
      contentDifficultyProfile.familyBands[options.preferences.preferredContentFamilyId],
    contentDifficultyBandsByFamily: contentDifficultyProfile.familyBands,
    progressionSummary: {
      currentStageIndex,
      totalStages: progressionStages.length,
      readinessScore: options.learnerProgressProfile?.recentReadinessScore ?? 0,
      stabilityScore: options.learnerProgressProfile?.recentStabilityScore ?? 0,
      regressionHold,
      nextStageCharacters: findNextStageCharacters(
        progressionStages,
        options.learnerProgressProfile,
      ),
      unlockedCharacterCount: unlockedCharacters.length,
      scheduledReviewCount: scheduledReviewCharacters.length,
      forgottenCount: forgottenCharacters.length,
      confusionPairCount: confusionPairs.length,
    },
  } satisfies AdaptiveSessionPlan;
}
