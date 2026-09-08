import type { SessionKind, SessionRecord } from "@/lib/scoring/session-models";
import { splitTextIntoGraphemes } from "@/lib/text/language-text-normalization";

export const CURRENT_SCORING_VERSION = 2;
export const CURRENT_ANALYTICS_VERSION = 2;
const ACCEPTED_BENCHMARK_DURATIONS_SECONDS = new Set([30, 45, 60, 120]);
const MINIMUM_RANKING_DURATION_MS = 10_000;
const MINIMUM_RANKING_PROMPT_CHARACTERS = 80;

export type CompletionReason =
  | "prompt-completed"
  | "time-expired"
  | "abandoned"
  | "restarted"
  | "route-changed"
  | "interrupted"
  | "storage-failed"
  | "invalid-input";

export type SessionInvalidReason =
  | "pasted-text"
  | "dropped-text"
  | "autofill"
  | "replacement-input"
  | "undo-redo"
  | "suspicious-multi-grapheme-input"
  | "focus-interrupted"
  | "visibility-interrupted"
  | "clock-anomaly"
  | "unknown-input";

export interface SessionIntegrity {
  rankingEligible: boolean;
  pasteDetected: boolean;
  dropDetected: boolean;
  autofillDetected: boolean;
  replacementDetected: boolean;
  undoRedoDetected: boolean;
  suspiciousInsertionDetected: boolean;
  visibilityInterrupted: boolean;
  focusInterrupted: boolean;
  clockAnomalyDetected: boolean;
  invalidReasons: SessionInvalidReason[];
}

export interface SessionEligibility {
  promptCompleted: boolean;
  analyticsEligible: boolean;
  rankingEligible: boolean;
  learnerModelEligible: boolean;
}

export function createSessionIntegrity(): SessionIntegrity {
  return {
    rankingEligible: false,
    pasteDetected: false,
    dropDetected: false,
    autofillDetected: false,
    replacementDetected: false,
    undoRedoDetected: false,
    suspiciousInsertionDetected: false,
    visibilityInterrupted: false,
    focusInterrupted: false,
    clockAnomalyDetected: false,
    invalidReasons: [],
  };
}

export function addIntegrityInvalidReason(
  integrity: SessionIntegrity,
  reason: SessionInvalidReason,
): SessionIntegrity {
  const invalidReasons = integrity.invalidReasons.includes(reason)
    ? integrity.invalidReasons
    : [...integrity.invalidReasons, reason];

  return {
    ...integrity,
    rankingEligible: false,
    pasteDetected: integrity.pasteDetected || reason === "pasted-text",
    dropDetected: integrity.dropDetected || reason === "dropped-text",
    autofillDetected: integrity.autofillDetected || reason === "autofill",
    replacementDetected: integrity.replacementDetected || reason === "replacement-input",
    undoRedoDetected: integrity.undoRedoDetected || reason === "undo-redo",
    suspiciousInsertionDetected:
      integrity.suspiciousInsertionDetected || reason === "suspicious-multi-grapheme-input",
    visibilityInterrupted:
      integrity.visibilityInterrupted || reason === "visibility-interrupted",
    focusInterrupted: integrity.focusInterrupted || reason === "focus-interrupted",
    clockAnomalyDetected: integrity.clockAnomalyDetected || reason === "clock-anomaly",
    invalidReasons,
  };
}

export function finalizeSessionEligibility(options: {
  sessionKind: SessionKind;
  completionReason: CompletionReason;
  promptCompleted: boolean;
  integrity: SessionIntegrity;
  hasAuthoritativeAttemptTiming: boolean;
}): SessionEligibility {
  const integrityValid = options.integrity.invalidReasons.length === 0;
  const completedNormally =
    options.completionReason === "prompt-completed" && options.promptCompleted;
  const analyticsEligible = completedNormally && integrityValid;
  const rankingEligible =
    options.sessionKind === "benchmark" && analyticsEligible;
  const learnerModelEligible =
    options.sessionKind === "adaptive" &&
    analyticsEligible &&
    options.hasAuthoritativeAttemptTiming;

  return {
    promptCompleted: options.promptCompleted,
    analyticsEligible,
    rankingEligible,
    learnerModelEligible,
  };
}

export function isRankingEligibleSession(sessionRecord: SessionRecord) {
  return (
    hasUsableAuthoritativeMetrics(sessionRecord) &&
    hasAcceptedBenchmarkConfiguration(sessionRecord) &&
    sessionRecord.sessionKind === "benchmark" &&
    sessionRecord.completionReason === "prompt-completed" &&
    sessionRecord.promptCompleted === true &&
    sessionRecord.rankingEligible === true &&
    sessionRecord.integrity?.invalidReasons.length === 0 &&
    sessionRecord.scoringVersion === CURRENT_SCORING_VERSION
  );
}

function hasAcceptedBenchmarkConfiguration(sessionRecord: SessionRecord) {
  const promptCharacterCount = splitTextIntoGraphemes(sessionRecord.promptText).filter(
    (grapheme) => !/^\s+$/u.test(grapheme),
  ).length;

  return (
    sessionRecord.benchmarkDurationSeconds !== undefined &&
    ACCEPTED_BENCHMARK_DURATIONS_SECONDS.has(sessionRecord.benchmarkDurationSeconds) &&
    (sessionRecord.durationMs >= MINIMUM_RANKING_DURATION_MS ||
      promptCharacterCount >= MINIMUM_RANKING_PROMPT_CHARACTERS)
  );
}

export function isPracticeAnalyticsEligibleSession(sessionRecord: SessionRecord) {
  return (
    hasUsableAuthoritativeMetrics(sessionRecord) &&
    (sessionRecord.sessionKind !== "benchmark" || hasAcceptedBenchmarkConfiguration(sessionRecord)) &&
    sessionRecord.analyticsEligible === true &&
    sessionRecord.completionReason === "prompt-completed" &&
    sessionRecord.promptCompleted === true &&
    sessionRecord.integrity?.invalidReasons.length === 0 &&
    sessionRecord.analyticsVersion === CURRENT_ANALYTICS_VERSION
    && sessionRecord.scoringVersion === CURRENT_SCORING_VERSION
  );
}

function hasUsableAuthoritativeMetrics(sessionRecord: SessionRecord) {
  return (
    Number.isFinite(sessionRecord.grossWpm) &&
    Number.isFinite(sessionRecord.netWpm) &&
    Number.isFinite(sessionRecord.accuracy) &&
    sessionRecord.grossWpm >= 0 &&
    sessionRecord.netWpm >= 0 &&
    sessionRecord.accuracy >= 0 &&
    sessionRecord.accuracy <= 100 &&
    Number.isInteger(sessionRecord.durationMs) &&
    sessionRecord.durationMs > 0 &&
    Number.isFinite(Date.parse(sessionRecord.startedAt)) &&
    Number.isFinite(Date.parse(sessionRecord.endedAt)) &&
    Date.parse(sessionRecord.endedAt) >= Date.parse(sessionRecord.startedAt)
  );
}

export function isLearnerModelEligibleSession(sessionRecord: SessionRecord) {
  return (
    sessionRecord.sessionKind === "adaptive" &&
    sessionRecord.learnerModelEligible === true &&
    isPracticeAnalyticsEligibleSession(sessionRecord)
  );
}

export function migrateSessionRecord(sessionRecord: SessionRecord): SessionRecord {
  if (
    sessionRecord.completionReason !== undefined &&
    sessionRecord.integrity !== undefined &&
    sessionRecord.promptCompleted !== undefined &&
    sessionRecord.analyticsEligible !== undefined &&
    sessionRecord.rankingEligible !== undefined &&
    sessionRecord.learnerModelEligible !== undefined &&
    sessionRecord.scoringVersion !== undefined &&
    sessionRecord.analyticsVersion !== undefined
  ) {
    return sessionRecord;
  }

  const legacyIntegrity = addIntegrityInvalidReason(
    createSessionIntegrity(),
    "unknown-input",
  );

  return {
    ...sessionRecord,
    completionReason: sessionRecord.completed ? "prompt-completed" : "interrupted",
    integrity: legacyIntegrity,
    promptCompleted: sessionRecord.completed,
    analyticsEligible: false,
    rankingEligible: false,
    learnerModelEligible: false,
    activeElapsedMs: sessionRecord.durationMs,
    pausedDurationMs: 0,
    scoringVersion: 1,
    analyticsVersion: 1,
  };
}

export function buildSessionDatasets(sessionRecords: SessionRecord[]) {
  const migratedRecords = sessionRecords.map(migrateSessionRecord);

  return {
    diagnosticHistory: migratedRecords,
    ranking: migratedRecords.filter(isRankingEligibleSession),
    practiceAnalytics: migratedRecords.filter(isPracticeAnalyticsEligibleSession),
    learnerModel: migratedRecords.filter(isLearnerModelEligibleSession),
  };
}

export function describeIntegrityInvalidReason(reason: SessionInvalidReason) {
  switch (reason) {
    case "pasted-text":
      return "Pasted text was detected.";
    case "dropped-text":
      return "Dropped text was detected.";
    case "autofill":
      return "Browser autofill was detected.";
    case "replacement-input":
      return "Browser or spell-check replacement input was detected.";
    case "undo-redo":
      return "Undo or redo changed the typed text.";
    case "suspicious-multi-grapheme-input":
      return "Multiple graphemes arrived in one non-composition input event.";
    case "focus-interrupted":
      return "The window lost focus during the run.";
    case "visibility-interrupted":
      return "The page was hidden during the run.";
    case "clock-anomaly":
      return "The browser supplied an unusable input timestamp.";
    case "unknown-input":
      return "The browser could not identify the input source.";
  }
}
