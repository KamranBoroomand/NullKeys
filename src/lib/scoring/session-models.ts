export type SessionKind = "adaptive" | "benchmark";
export type SessionFlavor = "plain" | "symbols" | "numbers" | "code" | "mixed";
export type InputMode = "hardware" | "touch";
export type ContentDifficultyBand =
  | "foundational"
  | "developing"
  | "fluent"
  | "advanced"
  | "expert-control";

export interface CharacterAttemptRecord {
  expectedCharacter: string;
  enteredCharacter: string;
  elapsedMs: number;
  occurredAt: string;
  correct: boolean;
  inputMode: InputMode;
  hesitant?: boolean;
}

export interface CharacterConfusionCount {
  character: string;
  count: number;
}

export interface CharacterPerformanceEntry {
  character: string;
  attemptCount: number;
  correctCount: number;
  mistakeCount: number;
  smoothedResponseMs: number;
  bestRecentResponseMs: number;
  masteryScore: number;
  lastSeenAt: string;
  hesitationCount?: number;
  hesitationRate?: number;
  repeatedFailureCount?: number;
  longestErrorRun?: number;
  confusionCounts?: Record<string, number>;
  dominantConfusions?: CharacterConfusionCount[];
}

export type ProgressionMilestoneKind =
  | "unlock"
  | "regression-hold"
  | "recovery-cycle"
  | "stability-check"
  | "resurface";

export type LearnerCharacterState =
  | "new"
  | "shaky"
  | "forgotten"
  | "stable"
  | "overtrained";

export interface LearnerConfusionPair {
  pairKey: string;
  expectedCharacter: string;
  enteredCharacter: string;
  count: number;
  recentCount: number;
}

export interface LearnerCharacterProfile {
  character: string;
  state: LearnerCharacterState;
  introducedAt: string;
  lastSeenAt: string | null;
  lastCorrectAt: string | null;
  lastMistakeAt: string | null;
  attemptCount: number;
  recentAttemptCount: number;
  accuracy: number;
  recentAccuracy: number;
  mistakeCount: number;
  recentMistakeCount: number;
  hesitationCount: number;
  recentHesitationCount: number;
  hesitationRate: number;
  repeatedFailureCount: number;
  masteryScore: number;
  meanResponseMs: number;
  recentResponseMs: number;
  memoryStrength: number;
  stabilityScore: number;
  dueScore: number;
  reviewIntervalHours: number;
  nextReviewAt: string;
  topConfusions: CharacterConfusionCount[];
}

export interface LearnerProgressMilestone {
  milestoneId: string;
  kind: ProgressionMilestoneKind;
  occurredAt: string;
  stageIndex: number;
  affectedCharacters: string[];
  readinessScore: number;
}

export interface LearnerProgressProfile {
  progressionId: string;
  languageId: string;
  keyboardLayoutId: string;
  inputMode: InputMode;
  programmerModeEnabled: boolean;
  currentStageIndex: number;
  activeCharacterSet: string[];
  unlockedCharacters: string[];
  newlyUnlockedCharacters: string[];
  newCharacters?: string[];
  shakyCharacters?: string[];
  forgottenCharacters?: string[];
  reinforcementCharacters: string[];
  stableCharacters: string[];
  overtrainedCharacters?: string[];
  recoveryCharacters: string[];
  scheduledReviewCharacters?: string[];
  hesitationCharacters?: string[];
  unlockPreviewCharacters: string[];
  topConfusionPairs?: LearnerConfusionPair[];
  characterProfiles?: Record<string, LearnerCharacterProfile>;
  regressionHold: boolean;
  recentReadinessScore: number;
  recentStabilityScore: number;
  completedAdaptiveSessions: number;
  milestoneHistory: LearnerProgressMilestone[];
  updatedAt: string;
  version: number;
}

export interface SessionMetrics {
  grossWpm: number;
  netWpm: number;
  accuracy: number;
  correctedErrorCount: number;
  uncorrectedErrorCount: number;
  durationMs: number;
}

export interface SessionContentMetrics {
  difficultyBand: ContentDifficultyBand;
  noveltyScore: number;
  repetitionScore: number;
  lexicalDiversity: number;
  contentVariantId?: string;
}

export interface SessionRecord extends SessionMetrics {
  sessionId: string;
  sessionKind: SessionKind;
  sessionFlavor: SessionFlavor;
  contentFamilyId?: string;
  languageId: string;
  keyboardFamilyId: string;
  keyboardLayoutId: string;
  inputMode: InputMode;
  promptText: string;
  typedText: string;
  startedAt: string;
  endedAt: string;
  completed: boolean;
  priorityCharacters: string[];
  activeCharacterSet: string[];
  unlockedCharacters: string[];
  progressionStageIndex?: number;
  attemptLog: CharacterAttemptRecord[];
  perCharacterPerformance: Record<string, CharacterPerformanceEntry>;
  benchmarkDurationSeconds?: number;
  programmerDrillPresetId?: string;
  contentMetrics?: SessionContentMetrics;
}

export interface AnalyticsSnapshot {
  snapshotId: string;
  sessionId: string;
  sessionKind: SessionKind;
  languageId: string;
  keyboardLayoutId: string;
  savedAt: string;
  perCharacterPerformance: Record<string, CharacterPerformanceEntry>;
}
