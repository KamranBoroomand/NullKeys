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

function preferProfileList<T>(profileValues: T[] | undefined, fallbackValues: T[]) {
  return profileValues?.length ? profileValues : fallbackValues;
}

function resolveUnlockPreviewCharacters(
  progressionStages: ProgressionStageDefinition[],
  progressionProfile: LearnerProgressProfile | null,
) {
  return progressionProfile?.unlockPreviewCharacters ??
    findNextStageCharacters(progressionStages, progressionProfile).slice(0, 2);
}

function findFocusCharacter(characterGroups: readonly string[][]) {
  for (const characters of characterGroups) {
    if (characters[0]) return characters[0];
  }
  return null;
}

function buildRebalanceTail(options: {
  preferences: PracticePreferences;
  supportsNumpad: boolean;
  numpadCharacters: string[];
  languageDigits: string[];
}) {
  if (options.preferences.preferredContentFamilyId === "adaptive-blend") return [];
  if (options.preferences.numpadEnabled && options.supportsNumpad) {
    return options.numpadCharacters;
  }
  return options.languageDigits.slice(0, 5);
}

interface SuggestedFlavorOptions {
  preferences: PracticePreferences;
  priorityCharacters: string[];
  recoveryCharacters: string[];
  reinforcementCharacters: string[];
  hesitationCharacters: string[];
  confusionCharacters: string[];
  forgottenCharacters: string[];
  newCharacters: string[];
  unlockedCharacters: string[];
  punctuationCharacters: Set<string>;
  digitCharacters: Set<string>;
  focusCharacter: string | null;
  confusionPressure: number;
  programmerPressure: number;
  adaptiveDifficultyBandIndex: number;
  currentStageIndex: number;
  recentReadinessScore: number;
  recentStabilityScore: number;
  completedAdaptiveSessions: number;
}

function chooseSuggestedFlavor(options: SuggestedFlavorOptions) {
  const countNonLetters = (characters: string[]) =>
    countCharactersInSet(characters, options.punctuationCharacters) +
    countCharactersInSet(characters, options.digitCharacters);
  const adaptiveNonLetterPriorityCount = countNonLetters(options.priorityCharacters);
  const priorityCount = Math.max(options.priorityCharacters.length, 1);
  const symbolPressure =
    countCharactersInSet(options.priorityCharacters, options.punctuationCharacters) / priorityCount;
  const digitPressure =
    countCharactersInSet(options.priorityCharacters, options.digitCharacters) / priorityCount;
  const recoveryAndReinforcement = uniqueCharacterList([
    ...options.recoveryCharacters,
    ...options.reinforcementCharacters,
  ]);
  const adaptiveNonLetterRecoveryCount = countNonLetters(recoveryAndReinforcement);
  const adaptiveConfusionTailCount = countNonLetters(options.confusionCharacters);
  const adaptiveFocusNeedsMixed = Boolean(
    options.focusCharacter &&
    (options.punctuationCharacters.has(options.focusCharacter) ||
      options.digitCharacters.has(options.focusCharacter)) &&
    (options.priorityCharacters.includes(options.focusCharacter) ||
      options.recoveryCharacters.includes(options.focusCharacter) ||
      options.reinforcementCharacters.includes(options.focusCharacter) ||
      options.hesitationCharacters.includes(options.focusCharacter)),
  );
  const unlockedLetterCount = options.unlockedCharacters.filter(
    (character) =>
      !options.punctuationCharacters.has(character) && !options.digitCharacters.has(character),
  ).length;
  const explicitNonLetterRecoveryPressure =
    adaptiveNonLetterPriorityCount >= 3 || adaptiveNonLetterRecoveryCount >= 2;
  const explicitLaterNonLetterLesson =
    options.currentStageIndex >= 4 &&
    options.recentReadinessScore >= 72 &&
    options.recentStabilityScore >= 74 &&
    options.forgottenCharacters.length === 0 &&
    adaptiveNonLetterRecoveryCount >= 2 &&
    (adaptiveFocusNeedsMixed ||
      adaptiveNonLetterPriorityCount >= 2 ||
      adaptiveNonLetterRecoveryCount >= 3 ||
      adaptiveConfusionTailCount >= 2);
  const foundationalAdaptiveRestraint =
    (options.adaptiveDifficultyBandIndex <= 1 && !explicitLaterNonLetterLesson) ||
    options.currentStageIndex <= 2 ||
    unlockedLetterCount < 18 ||
    options.recentReadinessScore < 68 ||
    options.recentStabilityScore < 70 ||
    options.completedAdaptiveSessions < 6 ||
    options.forgottenCharacters.length > 0 ||
    (options.recoveryCharacters.length >= 3 && !explicitLaterNonLetterLesson) ||
    (options.reinforcementCharacters.length >= 4 && !explicitLaterNonLetterLesson) ||
    (options.newCharacters.length >= 2 && options.recentStabilityScore < 76) ||
    (options.newCharacters.length > 0 && !explicitNonLetterRecoveryPressure);
  const shouldUseAdaptiveMixedFlavor =
    !foundationalAdaptiveRestraint &&
    options.recentStabilityScore >= 72 &&
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

  if (options.preferences.preferredContentFamilyId === "adaptive-blend") {
    return shouldUseAdaptiveMixedFlavor ? "mixed" : "plain";
  }
  if (options.preferences.programmerModeEnabled) return "code";
  if (
    digitPressure > 0.34 &&
    options.preferences.numpadEnabled
  ) {
    return "numbers";
  }
  if (
    symbolPressure > 0.28
  ) {
    return "symbols";
  }
  return options.confusionPressure > 0 ||
    options.hesitationCharacters.length > 0 ||
    options.programmerPressure < 2
    ? "mixed"
    : "plain";
}

function buildLessonBalance(options: {
  regressionHold: boolean;
  forgottenCount: number;
  recoveryCount: number;
  reinforcementCount: number;
  newCount: number;
  bridgeCount: number;
  confusionCount: number;
  unlockPreviewCount: number;
  explorationCount: number;
  fluencyCount: number;
  suggestedFlavor: AdaptiveSessionPlan["suggestedFlavor"];
  symbolPressure: number;
}) {
  return normalizeLessonBalance({
    recoveryWeight: options.regressionHold
      ? 3.6 + options.forgottenCount * 0.6 + options.recoveryCount * 0.35
      : 2.6 + options.forgottenCount * 0.5 + options.recoveryCount * 0.28,
    reinforcementWeight: 2 + options.reinforcementCount * 0.28 + options.newCount * 0.2,
    bridgeWeight: 1.6 + options.bridgeCount * 0.18 + options.confusionCount * 0.14,
    explorationWeight:
      options.unlockPreviewCount > 0 ? 0.9 + options.explorationCount * 0.2 : 0.45,
    fluencyWeight: options.regressionHold
      ? 0.7 + options.fluencyCount * 0.1
      : 1.35 + options.fluencyCount * 0.16,
    symbolWeight: ["symbols", "mixed", "code"].includes(options.suggestedFlavor)
      ? 0.65 + options.symbolPressure
      : 0.28,
    confusionWeight: 0.55 + options.confusionCount * 0.2,
    transitionWeight: 0.55 + options.explorationCount * 0.18 + options.newCount * 0.14,
  });
}

function chooseAdaptiveLesson(options: {
  regressionHold: boolean;
  forgottenCount: number;
  recoveryCount: number;
  readinessScore: number;
  stabilityScore: number;
  newCount: number;
  stableReviewCount: number;
  hesitationCount: number;
  confusionPairCount: number;
  difficultyBandIndex: number;
  currentStageIndex: number;
  completedAdaptiveSessions: number;
  unlockedLetterCount: number;
  unlockPreviewCount: number;
  bridgeCount: number;
}): {
  preference: AdaptiveSessionPlan["adaptiveLessonPreference"];
  reason: string;
} {
  const shouldKeepGrounded =
    options.regressionHold ||
    options.forgottenCount > 0 ||
    options.recoveryCount >= 3 ||
    options.readinessScore < 68 ||
    options.stabilityScore < 70 ||
    (options.newCount > 0 && options.stableReviewCount < 4);
  const shouldPreferPassages =
    !shouldKeepGrounded &&
    options.newCount === 0 &&
    options.hesitationCount <= 1 &&
    options.confusionPairCount <= 1 &&
    options.difficultyBandIndex >= 3 &&
    options.currentStageIndex >= 3 &&
    options.readinessScore >= 82 &&
    options.stabilityScore >= 79 &&
    options.completedAdaptiveSessions >= 10 &&
    options.stableReviewCount >= 5 &&
    options.unlockedLetterCount >= 18;
  const shouldPreferPhrases =
    !shouldPreferPassages &&
    !shouldKeepGrounded &&
    options.forgottenCount === 0 &&
    options.readinessScore >= 68 &&
    options.stabilityScore >= 68 &&
    ((options.newCount === 1 &&
      options.stableReviewCount >= 4 &&
      options.unlockedLetterCount >= 12) ||
      (options.unlockPreviewCount === 1 &&
        options.stableReviewCount >= 4 &&
        options.currentStageIndex >= 2) ||
      (options.difficultyBandIndex >= 2 &&
        options.stableReviewCount >= 4 &&
        options.unlockedLetterCount >= 14) ||
      (options.difficultyBandIndex >= 1 &&
        options.bridgeCount >= 3 &&
        options.stableReviewCount >= 4));
  const preference = shouldPreferPassages
    ? "quote-drills"
    : shouldPreferPhrases
      ? "phrase-drills"
      : "common-words";

  if (preference === "quote-drills") {
    return {
      preference,
      reason: "Stability is strong enough for connected passages, so review can stay inside calm prose instead of shorter recovery lines.",
    };
  }
  if (preference === "phrase-drills") {
    return {
      preference,
      reason:
        options.newCount > 0 || options.unlockPreviewCount > 0
          ? "Short readable phrases can widen the lesson gently, so the next character group arrives inside steady language instead of a jump."
          : "Readable phrases fit here because the lesson can widen a little while staying calm and confidence-building.",
    };
  }
  return {
    preference,
    reason:
      options.forgottenCount > 0 || options.regressionHold || shouldKeepGrounded
        ? "Recovery pressure is still high enough that the next step should stay on cleaner words until the current layer feels settled."
        : "Short familiar words are still the right next step while this character set settles.",
  };
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
  const activeCharacterSet = preferProfileList(
    options.learnerProgressProfile?.activeCharacterSet,
    fallbackCharacterSet,
  );
  const unlockedCharacters = preferProfileList(
    options.learnerProgressProfile?.unlockedCharacters,
    activeCharacterSet,
  );
  const unlockPreviewCharacters = resolveUnlockPreviewCharacters(
    progressionStages,
    options.learnerProgressProfile,
  );
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
  const newCharacters = preferProfileList(
    options.learnerProgressProfile?.newCharacters,
    learnerModel.newCharacters,
  );
  const shakyCharacters = preferProfileList(
    options.learnerProgressProfile?.shakyCharacters,
    learnerModel.shakyCharacters,
  );
  const forgottenCharacters = preferProfileList(
    options.learnerProgressProfile?.forgottenCharacters,
    learnerModel.forgottenCharacters,
  );
  const stableCharacters = preferProfileList(
    options.learnerProgressProfile?.stableCharacters,
    learnerModel.stableCharacters,
  );
  const overtrainedCharacters = preferProfileList(
    options.learnerProgressProfile?.overtrainedCharacters,
    learnerModel.overtrainedCharacters,
  );
  const hesitationCharacters = preferProfileList(
    options.learnerProgressProfile?.hesitationCharacters,
    learnerModel.hesitationCharacters,
  );
  const scheduledReviewCharacters = preferProfileList(
    options.learnerProgressProfile?.scheduledReviewCharacters,
    learnerModel.scheduledReviewCharacters,
  );
  const confusionPairs = preferProfileList(
    options.learnerProgressProfile?.topConfusionPairs,
    learnerModel.topConfusionPairs,
  );
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
  const focusCharacter = findFocusCharacter([
    forgottenCharacters,
    shakyCharacters,
    newCharacters,
    weakCharacters,
    activeCharacterSet,
  ]);
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
    ...buildRebalanceTail({
      preferences: options.preferences,
      supportsNumpad: keyboardTrainingProfile.supportsNumpad,
      numpadCharacters: keyboardTrainingProfile.numpadCharacters,
      languageDigits: languageDefinition.digits,
    }),
  ]).slice(0, 12);
  const symbolPressure =
    priorityCharacters.filter((character) =>
      [...languageDefinition.punctuation, ...languageDefinition.quotes].includes(character),
    ).length / Math.max(priorityCharacters.length, 1);
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
  const unlockedLetterCount = unlockedCharacters.filter(
    (character) => !punctuationCharacters.has(character) && !digitCharacters.has(character),
  ).length;
  const suggestedFlavor = chooseSuggestedFlavor({
    preferences: options.preferences,
    priorityCharacters,
    recoveryCharacters,
    reinforcementCharacters,
    hesitationCharacters,
    confusionCharacters,
    forgottenCharacters,
    newCharacters,
    unlockedCharacters,
    punctuationCharacters,
    digitCharacters,
    focusCharacter,
    confusionPressure,
    programmerPressure,
    adaptiveDifficultyBandIndex,
    currentStageIndex,
    recentReadinessScore,
    recentStabilityScore,
    completedAdaptiveSessions,
  });
  const lessonBalance = buildLessonBalance({
    regressionHold,
    forgottenCount: forgottenCharacters.length,
    recoveryCount: recoveryCharacters.length,
    reinforcementCount: reinforcementCharacters.length,
    newCount: newCharacters.length,
    bridgeCount: bridgeCharacters.length,
    confusionCount: confusionCharacters.length,
    unlockPreviewCount: unlockPreviewCharacters.length,
    explorationCount: explorationCharacters.length,
    fluencyCount: fluencyCharacters.length,
    suggestedFlavor,
    symbolPressure,
  });
  const adaptiveLesson = chooseAdaptiveLesson({
    regressionHold,
    forgottenCount: forgottenCharacters.length,
    recoveryCount: recoveryCharacters.length,
    readinessScore: recentReadinessScore,
    stabilityScore: recentStabilityScore,
    newCount: newCharacters.length,
    stableReviewCount: stableReviewCharacters.length,
    hesitationCount: hesitationCharacters.length,
    confusionPairCount: confusionPairs.length,
    difficultyBandIndex: adaptiveDifficultyBandIndex,
    currentStageIndex,
    completedAdaptiveSessions,
    unlockedLetterCount,
    unlockPreviewCount: unlockPreviewCharacters.length,
    bridgeCount: bridgeCharacters.length,
  });

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
    adaptiveLessonPreference: adaptiveLesson.preference,
    adaptiveLessonReason: adaptiveLesson.reason,
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
