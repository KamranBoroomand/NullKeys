import { generatePracticePassage } from "@/features/adaptive-practice/passage-generator";
import {
  buildProgressionStages,
  evaluateLearnerProgressProfile,
} from "@/features/adaptive-practice/learner-progression";
import { buildLanguageCharacterPool } from "@/features/language-support/language-registry";
import { programmerDrillPresets } from "@/features/programmer-practice/programmer-presets";
import type { PracticePreferences } from "@/features/user-preferences/preferences-schema";
import {
  clearStoredHistory,
  listSessionRecords,
  saveLearnerProgressProfile,
  saveSessionRecord,
} from "@/lib/persistence/session-repository";
import { scoreTypingSession } from "@/lib/scoring/session-scorer";
import type {
  CharacterAttemptRecord,
  InputMode,
  SessionFlavor,
  SessionKind,
  SessionRecord,
} from "@/lib/scoring/session-models";

interface SessionSimulationOutput {
  attemptLog: CharacterAttemptRecord[];
  correctedErrorCount: number;
  endedAt: string;
  typedText: string;
}

interface DemoSessionDraft {
  preferences: PracticePreferences;
  startedAt: string;
  sessionKind: SessionKind;
  sessionFlavor: SessionFlavor;
  promptText: string;
  priorityCharacters: string[];
  activeCharacterSet: string[];
  unlockedCharacters: string[];
  weakCharacters: string[];
  baseResponseMs: number;
  progressionStageIndex?: number;
  benchmarkDurationSeconds?: number;
  programmerDrillPresetId?: string;
}

export interface DemoSeedResult {
  savedSessionCount: number;
  currentStageIndex: number;
  progressionId: string;
}

function uniqueCharacters(characters: string[]) {
  return Array.from(new Set(characters.filter(Boolean)));
}

function buildMistypedCharacter(expectedCharacter: string, candidateCharacters: string[]) {
  const fallbackCharacter = candidateCharacters.find(
    (candidateCharacter) =>
      candidateCharacter !== expectedCharacter &&
      candidateCharacter !== " " &&
      candidateCharacter.toLowerCase() !== expectedCharacter.toLowerCase(),
  );

  return fallbackCharacter ?? (expectedCharacter === "/" ? "-" : "x");
}

function simulatePromptTyping(options: {
  promptText: string;
  startedAt: string;
  activeCharacterSet: string[];
  weakCharacters: string[];
  inputMode: InputMode;
  baseResponseMs: number;
}) {
  const startedAtMs = new Date(options.startedAt).getTime();
  const weakCharacterSet = new Set(options.weakCharacters.map((character) => character.toLowerCase()));
  const attemptLog: CharacterAttemptRecord[] = [];
  let correctedErrorCount = 0;
  let elapsedCursorMs = 0;
  let typedText = "";

  for (const [characterIndex, expectedCharacter] of Array.from(options.promptText).entries()) {
    const normalizedCharacter = expectedCharacter.toLowerCase();
    const shouldInjectCorrection =
      expectedCharacter !== " " &&
      (weakCharacterSet.has(normalizedCharacter)
        ? characterIndex % 3 === 1
        : characterIndex % 17 === 5);

    if (shouldInjectCorrection) {
      correctedErrorCount += 1;
      const mistakenCharacter = buildMistypedCharacter(expectedCharacter, options.activeCharacterSet);
      const mistakeElapsedMs = options.baseResponseMs + 95 + (characterIndex % 4) * 16;
      elapsedCursorMs += mistakeElapsedMs;
      attemptLog.push({
        expectedCharacter,
        enteredCharacter: mistakenCharacter,
        elapsedMs: mistakeElapsedMs,
        occurredAt: new Date(startedAtMs + elapsedCursorMs).toISOString(),
        correct: false,
        inputMode: options.inputMode,
      });
    }

    const correctElapsedMs =
      options.baseResponseMs +
      (weakCharacterSet.has(normalizedCharacter) ? 48 : 0) +
      (characterIndex % 5) * 12;
    elapsedCursorMs += correctElapsedMs;
    attemptLog.push({
      expectedCharacter,
      enteredCharacter: expectedCharacter,
      elapsedMs: correctElapsedMs,
      occurredAt: new Date(startedAtMs + elapsedCursorMs).toISOString(),
      correct: true,
      inputMode: options.inputMode,
    });
    typedText += expectedCharacter;
  }

  return {
    attemptLog,
    correctedErrorCount,
    endedAt: new Date(startedAtMs + elapsedCursorMs).toISOString(),
    typedText,
  } satisfies SessionSimulationOutput;
}

function buildSeedSessionRecord(draft: DemoSessionDraft) {
  const sessionSimulation = simulatePromptTyping({
    promptText: draft.promptText,
    startedAt: draft.startedAt,
    activeCharacterSet: draft.activeCharacterSet,
    weakCharacters: draft.weakCharacters,
    inputMode: draft.preferences.selectedInputMode,
    baseResponseMs: draft.baseResponseMs,
  });
  const scoringOutput = scoreTypingSession({
    promptText: draft.promptText,
    typedText: sessionSimulation.typedText,
    attemptLog: sessionSimulation.attemptLog,
    correctedErrorCount: sessionSimulation.correctedErrorCount,
    startedAt: draft.startedAt,
    endedAt: sessionSimulation.endedAt,
    masterySpeedGoal: draft.preferences.masterySpeedGoal,
  });

  return {
    sessionId: `${draft.sessionKind}-seed-${draft.preferences.selectedLanguageId}-${new Date(draft.startedAt).getTime()}`,
    sessionKind: draft.sessionKind,
    sessionFlavor: draft.sessionFlavor,
    languageId: draft.preferences.selectedLanguageId,
    keyboardFamilyId: draft.preferences.selectedKeyboardFamilyId,
    keyboardLayoutId: draft.preferences.selectedKeyboardLayoutId,
    inputMode: draft.preferences.selectedInputMode,
    promptText: draft.promptText,
    typedText: sessionSimulation.typedText,
    startedAt: draft.startedAt,
    endedAt: sessionSimulation.endedAt,
    completed: true,
    priorityCharacters: draft.priorityCharacters,
    activeCharacterSet: draft.activeCharacterSet,
    unlockedCharacters: draft.unlockedCharacters,
    progressionStageIndex: draft.progressionStageIndex,
    attemptLog: sessionSimulation.attemptLog,
    perCharacterPerformance: scoringOutput.perCharacterPerformance,
    benchmarkDurationSeconds: draft.benchmarkDurationSeconds,
    programmerDrillPresetId: draft.programmerDrillPresetId,
    ...scoringOutput.metrics,
  } satisfies SessionRecord;
}

function createRelativeStart(daysAgo: number, hourOffset = 0) {
  const relativeDate = new Date();
  relativeDate.setDate(relativeDate.getDate() - daysAgo);
  relativeDate.setHours(9 + hourOffset, 0, 0, 0);

  return relativeDate.toISOString();
}

function createPassage(options: {
  preferences: PracticePreferences;
  sessionFlavor: SessionFlavor;
  targetWordCount: number;
  priorityCharacters: string[];
  recoveryCharacters?: string[];
  reinforcementCharacters?: string[];
  bridgeCharacters?: string[];
  explorationCharacters?: string[];
  stableReviewCharacters?: string[];
  unlockPreviewCharacters?: string[];
  activeCharacterSet: string[];
  programmerDrillPresetId?: string;
}) {
  return generatePracticePassage({
    languageId: options.preferences.selectedLanguageId,
    targetWordCount: options.targetWordCount,
    sessionFlavor: options.sessionFlavor,
    priorityCharacters: options.priorityCharacters,
    recoveryCharacters: options.recoveryCharacters,
    reinforcementCharacters: options.reinforcementCharacters,
    bridgeCharacters: options.bridgeCharacters,
    explorationCharacters: options.explorationCharacters,
    stableReviewCharacters: options.stableReviewCharacters,
    unlockPreviewCharacters: options.unlockPreviewCharacters,
    activeCharacterSet: options.activeCharacterSet,
    contentSourceBias: "mixed",
    punctuationEnabled: true,
    capitalizationEnabled: options.preferences.capitalizationEnabled,
    keyboardLayoutId: options.preferences.selectedKeyboardLayoutId,
    numpadPracticeEnabled: options.preferences.numpadEnabled,
    programmerDrillPresetId: options.programmerDrillPresetId,
  }).text;
}

function createCurrentProfileSessions(preferences: PracticePreferences) {
  const progressionStages = buildProgressionStages({ preferences });
  const foundationCharacters = progressionStages[0]?.characters ?? [];
  const expansionCharacters = progressionStages[1]?.characters ?? foundationCharacters.slice(0, 2);
  const previewCharacters = progressionStages[2]?.characters.slice(0, 2) ?? [];
  const digitCharacters =
    progressionStages.find((stageDefinition) => stageDefinition.stageKind === "digits")?.characters ?? [];
  const activeCharacterSet = uniqueCharacters([
    ...foundationCharacters,
    ...expansionCharacters,
    ...digitCharacters.slice(0, 3),
  ]);
  const programmerPresetId = programmerDrillPresets[0]?.id;

  return [
    buildSeedSessionRecord({
      preferences,
      startedAt: createRelativeStart(5, 0),
      sessionKind: "adaptive",
      sessionFlavor: "plain",
      promptText: createPassage({
        preferences,
        sessionFlavor: "plain",
        targetWordCount: 18,
        priorityCharacters: foundationCharacters,
        reinforcementCharacters: foundationCharacters,
        activeCharacterSet: foundationCharacters,
      }),
      priorityCharacters: foundationCharacters,
      activeCharacterSet: foundationCharacters,
      unlockedCharacters: foundationCharacters,
      weakCharacters: foundationCharacters.slice(-2),
      baseResponseMs: 198,
      progressionStageIndex: 0,
    }),
    buildSeedSessionRecord({
      preferences,
      startedAt: createRelativeStart(4, 1),
      sessionKind: "adaptive",
      sessionFlavor: "mixed",
      promptText: createPassage({
        preferences,
        sessionFlavor: "mixed",
        targetWordCount: 20,
        priorityCharacters: foundationCharacters,
        recoveryCharacters: foundationCharacters.slice(-2),
        bridgeCharacters: expansionCharacters.slice(0, 2),
        explorationCharacters: expansionCharacters.slice(0, 2),
        unlockPreviewCharacters: expansionCharacters.slice(0, 2),
        activeCharacterSet: uniqueCharacters([...foundationCharacters, ...expansionCharacters.slice(0, 2)]),
      }),
      priorityCharacters: uniqueCharacters([...foundationCharacters, ...expansionCharacters.slice(0, 2)]),
      activeCharacterSet: uniqueCharacters([...foundationCharacters, ...expansionCharacters.slice(0, 2)]),
      unlockedCharacters: foundationCharacters,
      weakCharacters: foundationCharacters.slice(-2),
      baseResponseMs: 176,
      progressionStageIndex: 0,
    }),
    buildSeedSessionRecord({
      preferences,
      startedAt: createRelativeStart(3, 2),
      sessionKind: "adaptive",
      sessionFlavor: "mixed",
      promptText: createPassage({
        preferences,
        sessionFlavor: "mixed",
        targetWordCount: 22,
        priorityCharacters: expansionCharacters,
        recoveryCharacters: expansionCharacters.slice(0, 2),
        reinforcementCharacters: foundationCharacters.slice(0, 3),
        bridgeCharacters: foundationCharacters.slice(0, 2),
        explorationCharacters: previewCharacters,
        unlockPreviewCharacters: previewCharacters,
        activeCharacterSet,
      }),
      priorityCharacters: uniqueCharacters([...expansionCharacters, ...previewCharacters]),
      activeCharacterSet,
      unlockedCharacters: uniqueCharacters([...foundationCharacters, ...expansionCharacters]),
      weakCharacters: expansionCharacters.slice(0, 2),
      baseResponseMs: 164,
      progressionStageIndex: 1,
    }),
    buildSeedSessionRecord({
      preferences,
      startedAt: createRelativeStart(2, 0),
      sessionKind: "adaptive",
      sessionFlavor: preferences.programmerModeEnabled ? "code" : "mixed",
      promptText: createPassage({
        preferences,
        sessionFlavor: preferences.programmerModeEnabled ? "code" : "mixed",
        targetWordCount: 20,
        priorityCharacters: uniqueCharacters([...expansionCharacters, ...digitCharacters.slice(0, 2)]),
        recoveryCharacters: expansionCharacters.slice(0, 1),
        reinforcementCharacters: foundationCharacters.slice(0, 3),
        bridgeCharacters: foundationCharacters.slice(0, 2),
        stableReviewCharacters: foundationCharacters.slice(0, 4),
        activeCharacterSet,
        programmerDrillPresetId: programmerPresetId,
      }),
      priorityCharacters: uniqueCharacters([...expansionCharacters, ...digitCharacters.slice(0, 2)]),
      activeCharacterSet,
      unlockedCharacters: activeCharacterSet,
      weakCharacters: expansionCharacters.slice(0, 1),
      baseResponseMs: 154,
      progressionStageIndex: 1,
      programmerDrillPresetId: preferences.programmerModeEnabled ? programmerPresetId : undefined,
    }),
    buildSeedSessionRecord({
      preferences,
      startedAt: createRelativeStart(1, 1),
      sessionKind: "benchmark",
      sessionFlavor: "plain",
      promptText: createPassage({
        preferences,
        sessionFlavor: "plain",
        targetWordCount: 30,
        priorityCharacters: foundationCharacters,
        stableReviewCharacters: foundationCharacters,
        activeCharacterSet,
      }),
      priorityCharacters: foundationCharacters,
      activeCharacterSet,
      unlockedCharacters: activeCharacterSet,
      weakCharacters: foundationCharacters.slice(-1),
      baseResponseMs: 148,
      benchmarkDurationSeconds: 30,
    }),
    buildSeedSessionRecord({
      preferences,
      startedAt: createRelativeStart(0, -2),
      sessionKind: "benchmark",
      sessionFlavor: "code",
      promptText: createPassage({
        preferences,
        sessionFlavor: "code",
        targetWordCount: 28,
        priorityCharacters: uniqueCharacters(["[", "]", "{", "}", "(", ")", "/", "=", ...digitCharacters.slice(0, 2)]),
        reinforcementCharacters: expansionCharacters.slice(0, 2),
        bridgeCharacters: foundationCharacters.slice(0, 2),
        activeCharacterSet: uniqueCharacters([...activeCharacterSet, "[", "]", "{", "}", "(", ")", "/", "="]),
        programmerDrillPresetId: programmerPresetId,
      }),
      priorityCharacters: uniqueCharacters(["[", "]", "{", "}", "(", ")", "/", "="]),
      activeCharacterSet: uniqueCharacters([...activeCharacterSet, "[", "]", "{", "}", "(", ")", "/", "="]),
      unlockedCharacters: activeCharacterSet,
      weakCharacters: ["[", "]", "/"],
      baseResponseMs: 172,
      benchmarkDurationSeconds: 45,
      programmerDrillPresetId: programmerPresetId,
    }),
  ];
}

function createComparisonPreferences(
  basePreferences: PracticePreferences,
  overrides: Partial<PracticePreferences>,
) {
  return {
    ...basePreferences,
    ...overrides,
  } satisfies PracticePreferences;
}

function createComparisonSessions(preferences: PracticePreferences) {
  const russianPreferences = createComparisonPreferences(preferences, {
    selectedLanguageId: "russian",
    selectedKeyboardFamilyId: "iso-compact",
    selectedKeyboardLayoutId: "iso-intl-compact",
    selectedInputMode: "hardware",
    punctuationEnabled: true,
    capitalizationEnabled: false,
    programmerModeEnabled: false,
  });
  const persianPreferences = createComparisonPreferences(preferences, {
    selectedLanguageId: "persian",
    selectedKeyboardFamilyId: "touch-android",
    selectedKeyboardLayoutId: "touch-android-standard",
    selectedInputMode: "touch",
    devicePreference: "mobile",
    punctuationEnabled: true,
    capitalizationEnabled: false,
    programmerModeEnabled: false,
    numpadEnabled: false,
    touchOptimizationEnabled: true,
  });
  const russianCharacterPool = buildLanguageCharacterPool({
    languageId: russianPreferences.selectedLanguageId,
    punctuationEnabled: true,
    capitalizationEnabled: false,
    activeCharacterRange: "extended",
  });
  const persianCharacterPool = buildLanguageCharacterPool({
    languageId: persianPreferences.selectedLanguageId,
    punctuationEnabled: true,
    capitalizationEnabled: false,
    activeCharacterRange: "extended",
  });

  return [
    buildSeedSessionRecord({
      preferences: russianPreferences,
      startedAt: createRelativeStart(1, 3),
      sessionKind: "benchmark",
      sessionFlavor: "plain",
      promptText: createPassage({
        preferences: russianPreferences,
        sessionFlavor: "plain",
        targetWordCount: 26,
        priorityCharacters: russianCharacterPool.slice(0, 8),
        activeCharacterSet: russianCharacterPool.slice(0, 20),
      }),
      priorityCharacters: russianCharacterPool.slice(0, 8),
      activeCharacterSet: russianCharacterPool.slice(0, 20),
      unlockedCharacters: russianCharacterPool.slice(0, 20),
      weakCharacters: russianCharacterPool.slice(5, 8),
      baseResponseMs: 188,
      benchmarkDurationSeconds: 30,
    }),
    buildSeedSessionRecord({
      preferences: persianPreferences,
      startedAt: createRelativeStart(0, -1),
      sessionKind: "adaptive",
      sessionFlavor: "mixed",
      promptText: createPassage({
        preferences: persianPreferences,
        sessionFlavor: "mixed",
        targetWordCount: 18,
        priorityCharacters: persianCharacterPool.slice(0, 8),
        recoveryCharacters: persianCharacterPool.slice(6, 8),
        bridgeCharacters: persianCharacterPool.slice(0, 4),
        activeCharacterSet: persianCharacterPool.slice(0, 24),
      }),
      priorityCharacters: persianCharacterPool.slice(0, 8),
      activeCharacterSet: persianCharacterPool.slice(0, 24),
      unlockedCharacters: persianCharacterPool.slice(0, 24),
      weakCharacters: persianCharacterPool.slice(6, 8),
      baseResponseMs: 204,
      progressionStageIndex: 0,
    }),
  ];
}

export async function seedDeveloperPreviewData(preferences: PracticePreferences) {
  await clearStoredHistory();

  const sessionRecords = [
    ...createCurrentProfileSessions(preferences),
    ...createComparisonSessions(preferences),
  ];

  for (const sessionRecord of sessionRecords) {
    await saveSessionRecord(sessionRecord);
  }

  const storedSessions = await listSessionRecords();
  const nextLearnerProgressProfile = evaluateLearnerProgressProfile({
    existingProfile: null,
    preferences,
    recentSessions: storedSessions,
  });

  await saveLearnerProgressProfile(nextLearnerProgressProfile);

  return {
    savedSessionCount: sessionRecords.length,
    currentStageIndex: nextLearnerProgressProfile.currentStageIndex,
    progressionId: nextLearnerProgressProfile.progressionId,
  } satisfies DemoSeedResult;
}
