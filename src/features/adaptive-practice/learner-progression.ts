import { buildKeyboardTrainingProfile } from "@/features/keyboard-visualizer/keyboard-layout-registry";
import { buildLearnerModelSummary } from "@/features/adaptive-practice/learner-intelligence";
import {
  buildLanguageCharacterPool,
  getLanguageDefinition,
} from "@/features/language-support/language-registry";
import type { PracticePreferences } from "@/features/user-preferences/preferences-schema";
import type {
  CharacterPerformanceEntry,
  LearnerProgressMilestone,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";

export interface ProgressionStageDefinition {
  stageIndex: number;
  label: string;
  stageKind:
    | "foundation"
    | "expansion"
    | "digits"
    | "punctuation"
    | "programmer"
    | "capitals";
  characters: string[];
}

function uniqueCharacters(characters: string[]) {
  return Array.from(new Set(characters.filter(Boolean)));
}

function buildLanguageFrequencyMap(languageId: string) {
  const languageDefinition = getLanguageDefinition(languageId);
  const frequencyMap = new Map<string, number>();
  const feedText = `${languageDefinition.sampleSentence} ${languageDefinition.realWordBank.join(" ")}`;

  for (const character of Array.from(feedText.toLowerCase())) {
    frequencyMap.set(character, (frequencyMap.get(character) ?? 0) + 1);
  }

  return frequencyMap;
}

function sortLettersForProgression(languageId: string, keyboardLayoutId: string, letters: string[]) {
  const keyboardTrainingProfile = buildKeyboardTrainingProfile(keyboardLayoutId, languageId);
  const frequencyMap = buildLanguageFrequencyMap(languageId);
  const homeRowSet = new Set(keyboardTrainingProfile.homeRowCharacters);
  const numberRowSet = new Set(keyboardTrainingProfile.numberRowCharacters);
  const symbolPrioritySet = new Set(keyboardTrainingProfile.programmerSymbolCharacters);

  return letters
    .slice()
    .sort((leftCharacter, rightCharacter) => {
      const leftLower = leftCharacter.toLowerCase();
      const rightLower = rightCharacter.toLowerCase();
      const leftScore =
        (frequencyMap.get(leftLower) ?? 0) * 5 +
        (homeRowSet.has(leftLower) ? 80 : 0) +
        (numberRowSet.has(leftLower) ? 10 : 0) +
        (symbolPrioritySet.has(leftLower) ? 14 : 0);
      const rightScore =
        (frequencyMap.get(rightLower) ?? 0) * 5 +
        (homeRowSet.has(rightLower) ? 80 : 0) +
        (numberRowSet.has(rightLower) ? 10 : 0) +
        (symbolPrioritySet.has(rightLower) ? 14 : 0);

      return rightScore - leftScore;
    });
}

function chunkCharacters(characters: string[], chunkSizes: number[]) {
  const result: string[][] = [];
  let offset = 0;

  for (const chunkSize of chunkSizes) {
    if (offset >= characters.length) {
      break;
    }

    result.push(characters.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }

  if (offset < characters.length) {
    result.push(characters.slice(offset));
  }

  return result.filter((group) => group.length > 0);
}

export function buildProgressionProfileId(options: {
  languageId: string;
  keyboardLayoutId: string;
  inputMode: "hardware" | "touch";
  programmerModeEnabled: boolean;
}) {
  return [
    options.languageId,
    options.keyboardLayoutId,
    options.inputMode,
    options.programmerModeEnabled ? "programmer" : "general",
  ].join(":");
}

export function buildProgressionStages(options: {
  preferences: PracticePreferences;
}) {
  const languageDefinition = getLanguageDefinition(options.preferences.selectedLanguageId);
  const keyboardTrainingProfile = buildKeyboardTrainingProfile(
    options.preferences.selectedKeyboardLayoutId,
    options.preferences.selectedLanguageId,
  );
  const baseCharacterPool = buildLanguageCharacterPool({
    languageId: options.preferences.selectedLanguageId,
    punctuationEnabled: options.preferences.punctuationEnabled,
    capitalizationEnabled: options.preferences.capitalizationEnabled,
    activeCharacterRange: options.preferences.activeCharacterRange,
  });
  const sortedLetters = sortLettersForProgression(
    options.preferences.selectedLanguageId,
    options.preferences.selectedKeyboardLayoutId,
    languageDefinition.letters.filter((character) => baseCharacterPool.includes(character)),
  );
  const stages: ProgressionStageDefinition[] = [];
  const letterGroups = chunkCharacters(sortedLetters, [6, 4, 4, 4, 4, 4]);

  for (const [groupIndex, groupCharacters] of letterGroups.entries()) {
    stages.push({
      stageIndex: stages.length,
      label: groupIndex === 0 ? "Foundation letters" : `Letter expansion ${groupIndex}`,
      stageKind: groupIndex === 0 ? "foundation" : "expansion",
      characters: groupCharacters,
    });
  }

  if (options.preferences.activeCharacterRange !== "core") {
    const digitStages = chunkCharacters(languageDefinition.digits, [5, 5]);

    for (const digitGroup of digitStages) {
      stages.push({
        stageIndex: stages.length,
        label: keyboardTrainingProfile.supportsNumpad
          ? "Digits and numpad reach"
          : "Digits and number row",
        stageKind: "digits",
        characters: digitGroup,
      });
    }
  }

  if (options.preferences.programmerModeEnabled) {
    const programmerCharacters = uniqueCharacters(
      keyboardTrainingProfile.programmerSymbolCharacters
        .filter((character: string) => baseCharacterPool.includes(character))
        .slice(0, 14),
    );

    if (programmerCharacters.length > 0) {
      stages.push({
        stageIndex: stages.length,
        label: "Programmer symbols",
        stageKind: "programmer",
        characters: programmerCharacters,
      });
    }
  }

  if (options.preferences.punctuationEnabled || options.preferences.activeCharacterRange === "full") {
    const punctuationCharacters = uniqueCharacters(
      [...languageDefinition.punctuation, ...languageDefinition.quotes].filter((character) =>
        baseCharacterPool.includes(character),
      ),
    );

    for (const punctuationGroup of chunkCharacters(punctuationCharacters, [6, 6])) {
      stages.push({
        stageIndex: stages.length,
        label: "Punctuation control",
        stageKind: "punctuation",
        characters: punctuationGroup,
      });
    }
  }

  if (options.preferences.capitalizationEnabled && languageDefinition.uppercaseLetters.length > 0) {
    const uppercaseCharacters = languageDefinition.uppercaseLetters.filter((character) =>
      baseCharacterPool.includes(character),
    );

    if (uppercaseCharacters.length > 0) {
      stages.push({
        stageIndex: stages.length,
        label: "Capital transitions",
        stageKind: "capitals",
        characters: uppercaseCharacters,
      });
    }
  }

  return stages.map((stageDefinition, stageIndex) => ({
    ...stageDefinition,
    stageIndex,
  }));
}

function mergeConfusionCounts(
  leftCounts: Record<string, number> | undefined,
  rightCounts: Record<string, number> | undefined,
) {
  const mergedCounts = {
    ...(leftCounts ?? {}),
  };

  for (const [character, count] of Object.entries(rightCounts ?? {})) {
    mergedCounts[character] = (mergedCounts[character] ?? 0) + count;
  }

  return mergedCounts;
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

function aggregateCharacterPerformanceMap(sessionRecords: SessionRecord[]) {
  return sessionRecords.reduce<Record<string, CharacterPerformanceEntry>>((accumulator, sessionRecord) => {
    for (const [character, nextEntry] of Object.entries(sessionRecord.perCharacterPerformance)) {
      const existingEntry = accumulator[character];

      if (!existingEntry) {
        accumulator[character] = { ...nextEntry };
        continue;
      }

      const confusionCounts = mergeConfusionCounts(
        existingEntry.confusionCounts,
        nextEntry.confusionCounts,
      );

      accumulator[character] = {
        ...existingEntry,
        attemptCount: existingEntry.attemptCount + nextEntry.attemptCount,
        correctCount: existingEntry.correctCount + nextEntry.correctCount,
        mistakeCount: existingEntry.mistakeCount + nextEntry.mistakeCount,
        smoothedResponseMs: Math.round(
          (existingEntry.smoothedResponseMs + nextEntry.smoothedResponseMs) / 2,
        ),
        bestRecentResponseMs:
          existingEntry.bestRecentResponseMs === 0
            ? nextEntry.bestRecentResponseMs
            : Math.min(existingEntry.bestRecentResponseMs, nextEntry.bestRecentResponseMs),
        masteryScore: Math.round((existingEntry.masteryScore + nextEntry.masteryScore) / 2),
        lastSeenAt:
          new Date(existingEntry.lastSeenAt).getTime() >
          new Date(nextEntry.lastSeenAt).getTime()
            ? existingEntry.lastSeenAt
            : nextEntry.lastSeenAt,
        hesitationCount: (existingEntry.hesitationCount ?? 0) + (nextEntry.hesitationCount ?? 0),
        hesitationRate: Number(
          (
            ((existingEntry.hesitationCount ?? 0) + (nextEntry.hesitationCount ?? 0)) /
            Math.max(1, existingEntry.attemptCount + nextEntry.attemptCount)
          ).toFixed(3),
        ),
        repeatedFailureCount:
          (existingEntry.repeatedFailureCount ?? 0) + (nextEntry.repeatedFailureCount ?? 0),
        longestErrorRun: Math.max(
          existingEntry.longestErrorRun ?? 0,
          nextEntry.longestErrorRun ?? 0,
        ),
        confusionCounts,
        dominantConfusions: buildDominantConfusions(confusionCounts),
      };
    }

    return accumulator;
  }, {});
}

function getPaceThresholds(progressionPace: PracticePreferences["progressionPace"]) {
  switch (progressionPace) {
    case "measured":
      return {
        readyScore: 79,
        previewScore: 69,
        stabilityScore: 73,
        regressionFloor: 56,
        readyRatio: 0.84,
        minAttempts: 8,
      };
    case "accelerated":
      return {
        readyScore: 67,
        previewScore: 58,
        stabilityScore: 60,
        regressionFloor: 44,
        readyRatio: 0.64,
        minAttempts: 4,
      };
    case "balanced":
    default:
      return {
        readyScore: 73,
        previewScore: 64,
        stabilityScore: 67,
        regressionFloor: 50,
        readyRatio: 0.74,
        minAttempts: 6,
      };
  }
}

function buildOrderedProgressionCharacters(progressionStages: ProgressionStageDefinition[]) {
  return uniqueCharacters(
    progressionStages.flatMap((stageDefinition) => stageDefinition.characters),
  );
}

function getUnlockBatchSize(progressionPace: PracticePreferences["progressionPace"]) {
  switch (progressionPace) {
    case "measured":
      return 1;
    case "accelerated":
      return 3;
    case "balanced":
    default:
      return 2;
  }
}

function getUnlockPreviewCount(progressionPace: PracticePreferences["progressionPace"]) {
  switch (progressionPace) {
    case "accelerated":
      return 2;
    case "measured":
    case "balanced":
    default:
      return 1;
  }
}

function findCurrentStageIndexFromUnlockedCharacters(
  progressionStages: ProgressionStageDefinition[],
  unlockedCharacters: string[],
) {
  let currentStageIndex = 0;

  for (const stageDefinition of progressionStages) {
    if (stageDefinition.characters.some((character) => unlockedCharacters.includes(character))) {
      currentStageIndex = stageDefinition.stageIndex;
      continue;
    }

    break;
  }

  return currentStageIndex;
}

function computeReadinessScore(characterProfile: NonNullable<LearnerProgressProfile["characterProfiles"]>[string]) {
  return Math.round(
    Math.max(
      0,
      Math.min(
        100,
        characterProfile.masteryScore * 0.44 +
          characterProfile.recentAccuracy * 100 * 0.34 +
          Math.min(characterProfile.attemptCount / 8, 1) * 14 -
          characterProfile.hesitationRate * 18 -
          characterProfile.repeatedFailureCount * 4 -
          Math.max(0, characterProfile.recentResponseMs - 220) / 12 -
          characterProfile.dueScore * 5,
      ),
    ),
  );
}

function mergeMilestones(
  existingMilestones: LearnerProgressMilestone[],
  nextMilestone?: LearnerProgressMilestone,
) {
  return nextMilestone
    ? [nextMilestone, ...existingMilestones].slice(0, 24)
    : existingMilestones.slice(0, 24);
}

function buildMilestone(input: {
  kind: LearnerProgressMilestone["kind"];
  stageIndex: number;
  affectedCharacters: string[];
  readinessScore: number;
}) {
  const occurredAt = new Date().toISOString();

  return {
    milestoneId: `${input.kind}-${input.stageIndex}-${occurredAt}`,
    kind: input.kind,
    occurredAt,
    stageIndex: input.stageIndex,
    affectedCharacters: input.affectedCharacters,
    readinessScore: input.readinessScore,
  } satisfies LearnerProgressMilestone;
}

export function createInitialLearnerProgressProfile(options: {
  preferences: PracticePreferences;
}) {
  const progressionStages = buildProgressionStages({
    preferences: options.preferences,
  });
  const firstStage = progressionStages[0]?.characters ?? [];
  const progressionId = buildProgressionProfileId({
    languageId: options.preferences.selectedLanguageId,
    keyboardLayoutId: options.preferences.selectedKeyboardLayoutId,
    inputMode: options.preferences.selectedInputMode,
    programmerModeEnabled: options.preferences.programmerModeEnabled,
  });
  const updatedAt = new Date().toISOString();
  const learnerModel = buildLearnerModelSummary({
    characters: firstStage,
    characterPerformanceMap: {},
    sessionRecords: [],
    preferences: options.preferences,
    now: new Date(updatedAt),
  });

  return {
    progressionId,
    languageId: options.preferences.selectedLanguageId,
    keyboardLayoutId: options.preferences.selectedKeyboardLayoutId,
    inputMode: options.preferences.selectedInputMode,
    programmerModeEnabled: options.preferences.programmerModeEnabled,
    currentStageIndex: 0,
    activeCharacterSet: firstStage,
    unlockedCharacters: firstStage,
    newlyUnlockedCharacters: firstStage,
    newCharacters: learnerModel.newCharacters,
    shakyCharacters: [],
    forgottenCharacters: [],
    reinforcementCharacters: firstStage,
    stableCharacters: [],
    overtrainedCharacters: [],
    recoveryCharacters: [],
    scheduledReviewCharacters: [],
    hesitationCharacters: [],
    unlockPreviewCharacters:
      progressionStages[1]?.characters.slice(0, getUnlockBatchSize(options.preferences.progressionPace)) ?? [],
    topConfusionPairs: [],
    characterProfiles: learnerModel.characterProfiles,
    regressionHold: false,
    recentReadinessScore: 0,
    recentStabilityScore: 0,
    completedAdaptiveSessions: 0,
    milestoneHistory: [],
    updatedAt,
    version: 2,
  } satisfies LearnerProgressProfile;
}

export function evaluateLearnerProgressProfile(options: {
  existingProfile: LearnerProgressProfile | null;
  preferences: PracticePreferences;
  recentSessions: SessionRecord[];
}) {
  const progressionStages = buildProgressionStages({
    preferences: options.preferences,
  });
  const thresholds = getPaceThresholds(options.preferences.progressionPace);
  const existingProfile =
    options.existingProfile ?? createInitialLearnerProgressProfile({ preferences: options.preferences });
  const progressionSessions = options.recentSessions
    .filter(
      (sessionRecord) =>
        sessionRecord.sessionKind === "adaptive" &&
        sessionRecord.languageId === options.preferences.selectedLanguageId &&
        sessionRecord.keyboardLayoutId === options.preferences.selectedKeyboardLayoutId,
    )
    .slice(0, 48);
  const aggregatedCharacterPerformance = aggregateCharacterPerformanceMap(progressionSessions);
  const orderedCharacters = buildOrderedProgressionCharacters(progressionStages);
  const unlockBatchSize = getUnlockBatchSize(options.preferences.progressionPace);
  let unlockedCharacters = uniqueCharacters(
    (existingProfile.unlockedCharacters.length
      ? existingProfile.unlockedCharacters
      : progressionStages[0]?.characters ?? []
    ).filter((character) => orderedCharacters.includes(character)),
  );

  if (unlockedCharacters.length === 0) {
    unlockedCharacters = progressionStages[0]?.characters ?? [];
  }

  const preUnlockModel = buildLearnerModelSummary({
    characters: unlockedCharacters,
    characterPerformanceMap: aggregatedCharacterPerformance,
    sessionRecords: progressionSessions,
    preferences: options.preferences,
    learnerProgressProfile: existingProfile,
  });
  const frontierCharacters = unlockedCharacters.slice(-Math.max(4, unlockBatchSize + 2));
  const frontierProfiles = frontierCharacters
    .map((character) => preUnlockModel.characterProfiles[character])
    .filter(Boolean);
  const readyFrontierProfiles = frontierProfiles.filter(
    (characterProfile) =>
      computeReadinessScore(characterProfile) >= thresholds.readyScore &&
      characterProfile.stabilityScore >= thresholds.stabilityScore &&
      characterProfile.attemptCount >= thresholds.minAttempts,
  );
  const recentReadinessScore =
    frontierProfiles.length === 0
      ? 0
      : Math.round(
          frontierProfiles.reduce(
            (sum, characterProfile) => sum + computeReadinessScore(characterProfile),
            0,
          ) / frontierProfiles.length,
        );
  const recentStabilityScore =
    frontierProfiles.length === 0
      ? 0
      : Math.round(
          frontierProfiles.reduce((sum, characterProfile) => sum + characterProfile.stabilityScore, 0) /
            frontierProfiles.length,
        );
  const frontierReadinessRatio =
    frontierProfiles.length === 0 ? 0 : readyFrontierProfiles.length / frontierProfiles.length;
  const currentStageIndexBeforeUnlock = findCurrentStageIndexFromUnlockedCharacters(
    progressionStages,
    unlockedCharacters,
  );
  const reviewBacklog =
    preUnlockModel.forgottenCharacters.length +
    preUnlockModel.shakyCharacters.filter(
      (character) =>
        (preUnlockModel.characterProfiles[character]?.dueScore ?? 0) >= 0.35,
    ).length;
  const lockedCharacters = orderedCharacters.filter(
    (character) => !unlockedCharacters.includes(character),
  );
  const effectiveUnlockBatchSize =
    unlockBatchSize <= 1
      ? 1
      : currentStageIndexBeforeUnlock <= 1 ||
          recentReadinessScore < thresholds.readyScore + 4 ||
          recentStabilityScore < thresholds.stabilityScore + 4 ||
          frontierReadinessRatio < Math.min(0.92, thresholds.readyRatio + 0.12) ||
          reviewBacklog > 0
        ? 1
        : Math.min(
            unlockBatchSize,
            currentStageIndexBeforeUnlock >= 4 &&
              recentReadinessScore >= thresholds.readyScore + 9 &&
              recentStabilityScore >= thresholds.stabilityScore + 8
              ? unlockBatchSize
              : 2,
          );
  const strongRecentMomentum =
    lockedCharacters.length > 0 &&
    progressionSessions.length >= 2 &&
    frontierProfiles.length > 0 &&
    reviewBacklog <= Math.max(1, effectiveUnlockBatchSize) &&
    frontierProfiles.every(
      (characterProfile) =>
        characterProfile.recentAccuracy >= 0.97 &&
        characterProfile.masteryScore >= thresholds.readyScore + 8 &&
        characterProfile.stabilityScore >= thresholds.stabilityScore + 6 &&
        characterProfile.attemptCount >= thresholds.minAttempts + 2 &&
        characterProfile.dueScore <= 1,
    );
  const eligibleForUnlock =
    lockedCharacters.length > 0 &&
    progressionSessions.length >= 2 &&
    reviewBacklog <= Math.max(1, effectiveUnlockBatchSize) &&
    ((frontierReadinessRatio >= thresholds.readyRatio &&
      recentReadinessScore >= thresholds.readyScore &&
      recentStabilityScore >=
        thresholds.stabilityScore + (effectiveUnlockBatchSize > 1 ? 4 : 0)) ||
      strongRecentMomentum);
  let newlyUnlockedCharacters: string[] = [];

  if (eligibleForUnlock) {
    newlyUnlockedCharacters = lockedCharacters.slice(0, effectiveUnlockBatchSize);
    unlockedCharacters = uniqueCharacters([...unlockedCharacters, ...newlyUnlockedCharacters]);
  }

  const learnerModel = buildLearnerModelSummary({
    characters: unlockedCharacters,
    characterPerformanceMap: aggregatedCharacterPerformance,
    sessionRecords: progressionSessions,
    preferences: options.preferences,
    learnerProgressProfile: existingProfile,
  });
  const currentStageIndex = findCurrentStageIndexFromUnlockedCharacters(
    progressionStages,
    unlockedCharacters,
  );
  const finalFrontierCharacters = unlockedCharacters.slice(-Math.max(4, unlockBatchSize + 2));
  const finalFrontierProfiles = finalFrontierCharacters
    .map((character) => learnerModel.characterProfiles[character])
    .filter(Boolean);
  const regressionHold =
    learnerModel.forgottenCharacters.length > 0 ||
    finalFrontierProfiles.some(
      (characterProfile) =>
        characterProfile.state !== "new" &&
        computeReadinessScore(characterProfile) < thresholds.regressionFloor,
    ) ||
    reviewBacklog > Math.max(2, unlockBatchSize + 1);
  const remainingCharacters = orderedCharacters.filter(
    (character) => !unlockedCharacters.includes(character),
  );
  const newlyIntroducedCharacters = uniqueCharacters([
    ...newlyUnlockedCharacters,
    ...(existingProfile.newlyUnlockedCharacters ?? []).filter((character) =>
      unlockedCharacters.includes(character),
    ),
    ...learnerModel.newCharacters.filter((character) => unlockedCharacters.includes(character)),
  ]).slice(0, Math.max(4, unlockBatchSize + 1));
  const forgottenCharacters = learnerModel.forgottenCharacters.slice(0, 8);
  const shakyCharacters = learnerModel.shakyCharacters.slice(0, 8);
  const newCharacters = learnerModel.newCharacters.slice(0, 8);
  const stableCharacters = learnerModel.stableCharacters.slice(0, 10);
  const overtrainedCharacters = learnerModel.overtrainedCharacters.slice(0, 10);
  const scheduledReviewCharacters = learnerModel.scheduledReviewCharacters.slice(0, 10);
  const hesitationCharacters = learnerModel.hesitationCharacters.slice(0, 8);
  const recoveryCharacters = uniqueCharacters([
    ...forgottenCharacters,
    ...shakyCharacters.filter(
      (character) => (learnerModel.characterProfiles[character]?.dueScore ?? 0) >= 0.35,
    ),
    ...hesitationCharacters.filter(
      (character) => (learnerModel.characterProfiles[character]?.state ?? "stable") !== "stable",
    ),
  ]).slice(0, 8);
  const reinforcementCharacters = uniqueCharacters([
    ...newlyIntroducedCharacters,
    ...newCharacters,
    ...shakyCharacters.filter(
      (character) =>
        (learnerModel.characterProfiles[character]?.attemptCount ?? 0) <
        thresholds.minAttempts + 2,
    ),
  ]).slice(0, 8);
  const unlockPreviewCharacters =
    regressionHold || remainingCharacters.length === 0 || recentReadinessScore < thresholds.previewScore
      ? []
      : remainingCharacters.slice(
          0,
          Math.min(
            getUnlockPreviewCount(options.preferences.progressionPace),
            Math.max(1, effectiveUnlockBatchSize),
          ),
        );
  const frontierWindow = unlockedCharacters.slice(-Math.max(6, unlockBatchSize * 2 + 2));
  const activeCharacterSet = uniqueCharacters([
    ...recoveryCharacters.slice(0, regressionHold ? 6 : 4),
    ...reinforcementCharacters,
    ...frontierWindow,
    ...scheduledReviewCharacters.slice(0, regressionHold ? 2 : 4),
    ...stableCharacters.filter((character) => !overtrainedCharacters.includes(character)).slice(
      0,
      regressionHold ? 1 : 3,
    ),
    ...unlockPreviewCharacters,
  ]).slice(
    0,
    Math.max(14, Math.min(28, unlockedCharacters.length + unlockPreviewCharacters.length + 6)),
  );
  let nextMilestone: LearnerProgressMilestone | undefined;

  if (newlyUnlockedCharacters.length > 0) {
    nextMilestone = buildMilestone({
      kind: "unlock",
      stageIndex: currentStageIndex,
      affectedCharacters: newlyUnlockedCharacters,
      readinessScore: recentReadinessScore,
    });
  } else if (
    finalFrontierProfiles.some(
      (characterProfile) =>
        characterProfile.state !== "new" &&
        computeReadinessScore(characterProfile) < thresholds.regressionFloor,
    )
  ) {
    nextMilestone = buildMilestone({
      kind: "regression-hold",
      stageIndex: currentStageIndex,
      affectedCharacters: finalFrontierProfiles
        .filter(
          (characterProfile) =>
            characterProfile.state !== "new" &&
            computeReadinessScore(characterProfile) < thresholds.regressionFloor,
        )
        .map((characterProfile) => characterProfile.character)
        .slice(0, 4),
      readinessScore: recentReadinessScore,
    });
  } else if (forgottenCharacters.length > 0) {
    nextMilestone = buildMilestone({
      kind: "resurface",
      stageIndex: currentStageIndex,
      affectedCharacters: forgottenCharacters.slice(0, 4),
      readinessScore: recentReadinessScore,
    });
  } else if (recoveryCharacters.length > 0 && recentReadinessScore >= thresholds.previewScore) {
    nextMilestone = buildMilestone({
      kind: "recovery-cycle",
      stageIndex: currentStageIndex,
      affectedCharacters: recoveryCharacters.slice(0, 4),
      readinessScore: recentReadinessScore,
    });
  } else if (scheduledReviewCharacters.length > 0 && !regressionHold) {
    nextMilestone = buildMilestone({
      kind: "stability-check",
      stageIndex: currentStageIndex,
      affectedCharacters: scheduledReviewCharacters.slice(0, 4),
      readinessScore: recentReadinessScore,
    });
  }

  return {
    ...existingProfile,
    progressionId: buildProgressionProfileId({
      languageId: options.preferences.selectedLanguageId,
      keyboardLayoutId: options.preferences.selectedKeyboardLayoutId,
      inputMode: options.preferences.selectedInputMode,
      programmerModeEnabled: options.preferences.programmerModeEnabled,
    }),
    languageId: options.preferences.selectedLanguageId,
    keyboardLayoutId: options.preferences.selectedKeyboardLayoutId,
    inputMode: options.preferences.selectedInputMode,
    programmerModeEnabled: options.preferences.programmerModeEnabled,
    currentStageIndex,
    activeCharacterSet,
    unlockedCharacters,
    newlyUnlockedCharacters: newlyIntroducedCharacters,
    newCharacters,
    shakyCharacters,
    forgottenCharacters,
    reinforcementCharacters,
    stableCharacters,
    overtrainedCharacters,
    recoveryCharacters,
    scheduledReviewCharacters,
    hesitationCharacters,
    unlockPreviewCharacters,
    topConfusionPairs: learnerModel.topConfusionPairs.slice(0, 8),
    characterProfiles: learnerModel.characterProfiles,
    regressionHold,
    recentReadinessScore,
    recentStabilityScore,
    completedAdaptiveSessions: progressionSessions.length,
    milestoneHistory: mergeMilestones(existingProfile.milestoneHistory, nextMilestone),
    updatedAt: new Date().toISOString(),
    version: 2,
  } satisfies LearnerProgressProfile;
}
