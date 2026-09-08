import {
  CURRENT_PREFERENCES_SCHEMA_VERSION,
  defaultPracticePreferences,
  type PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import { normalizePracticePreferences } from "@/features/user-preferences/preferences-store";
import type {
  CharacterAttemptRecord,
  CharacterPerformanceEntry,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";
import {
  CURRENT_ANALYTICS_VERSION,
  CURRENT_SCORING_VERSION,
  type CompletionReason,
  type SessionIntegrity,
  type SessionInvalidReason,
} from "@/lib/scoring/session-validity";
import { splitTextIntoGraphemes } from "@/lib/text/language-text-normalization";

export const MAX_ARCHIVE_SESSIONS = 50_000;
export const MAX_ARCHIVE_PROFILES = 512;
const MAX_JSON_NODES = 750_000;
const MAX_JSON_DEPTH = 40;
const MAX_PROMPT_GRAPHEMES = 50_000;
const MAX_TEXT_CODE_UNITS = 200_000;
const MAX_ATTEMPTS_PER_SESSION = 100_000;
const MAX_PROFILE_CHARACTERS = 4_096;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const sessionKeys = [
  "sessionId", "sessionKind", "sessionFlavor", "contentFamilyId", "languageId",
  "keyboardFamilyId", "keyboardLayoutId", "inputMode", "promptText", "typedText",
  "startedAt", "endedAt", "completed", "completionReason", "integrity",
  "promptCompleted", "analyticsEligible", "rankingEligible", "learnerModelEligible",
  "activeElapsedMs", "pausedDurationMs", "scoringVersion", "analyticsVersion",
  "priorityCharacters", "activeCharacterSet", "unlockedCharacters",
  "progressionStageIndex", "attemptLog", "perCharacterPerformance",
  "benchmarkDurationSeconds", "programmerDrillPresetId", "contentMetrics", "grossWpm",
  "netWpm", "accuracy", "correctedErrorCount", "uncorrectedErrorCount", "durationMs",
] as const;

const attemptKeys = [
  "graphemeIndex", "expectedCharacter", "enteredCharacter", "elapsedMs", "occurredAt",
  "correct", "inputMode", "inputSource", "timingValid", "hesitant",
] as const;

const performanceKeys = [
  "character", "attemptCount", "correctCount", "mistakeCount", "smoothedResponseMs",
  "bestRecentResponseMs", "masteryScore", "lastSeenAt", "hesitationCount",
  "hesitationRate", "repeatedFailureCount", "longestErrorRun", "confusionCounts",
  "dominantConfusions",
] as const;

const profileKeys = [
  "progressionId", "languageId", "keyboardLayoutId", "inputMode",
  "programmerModeEnabled", "currentStageIndex", "activeCharacterSet",
  "unlockedCharacters", "newlyUnlockedCharacters", "newCharacters", "shakyCharacters",
  "forgottenCharacters", "reinforcementCharacters", "stableCharacters",
  "overtrainedCharacters", "recoveryCharacters", "scheduledReviewCharacters",
  "hesitationCharacters", "unlockPreviewCharacters", "topConfusionPairs",
  "characterProfiles", "regressionHold", "recentReadinessScore", "recentStabilityScore",
  "completedAdaptiveSessions", "milestoneHistory", "updatedAt", "version",
] as const;

function fail(message: string): never {
  throw new Error(`Invalid NullKeys archive: ${message}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) fail(`${label} contains the unsupported field "${key}".`);
  }
}

function assertString(value: unknown, label: string, maxLength = 4_096, allowEmpty = false) {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    (!allowEmpty && value.trim().length === 0)
  ) fail(`${label} is not a valid string.`);
  return value;
}

function assertNumber(value: unknown, label: string, min: number, max: number) {
  if (!Number.isFinite(value) || Number(value) < min || Number(value) > max) {
    fail(`${label} is outside its allowed range.`);
  }
  return Number(value);
}

function assertInteger(value: unknown, label: string, min: number, max: number) {
  if (!Number.isInteger(value)) fail(`${label} must be an integer.`);
  return assertNumber(value, label, min, max);
}

function assertBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") fail(`${label} must be a boolean.`);
  return value;
}

function assertIsoTimestamp(value: unknown, label: string) {
  const timestamp = assertString(value, label, 80);
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) {
    fail(`${label} must be an exact ISO timestamp.`);
  }
  return parsed;
}

function assertStringArray(value: unknown, label: string, maxEntries: number) {
  if (!Array.isArray(value) || value.length > maxEntries) fail(`${label} is too large or malformed.`);
  return value.map((entry, index) => assertString(entry, `${label}[${index}]`, 32, true));
}

function assertOptionalStringArray(value: unknown, label: string, maxEntries: number) {
  if (value === undefined) return;
  assertStringArray(value, label, maxEntries);
}

export function assertSafeJsonGraph(value: unknown) {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodeCount = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    nodeCount += 1;
    if (nodeCount > MAX_JSON_NODES) fail("the decoded payload is too complex.");
    if (current.depth > MAX_JSON_DEPTH) fail("the decoded payload is nested too deeply.");

    if (Array.isArray(current.value)) {
      for (const entry of current.value) pending.push({ value: entry, depth: current.depth + 1 });
      continue;
    }

    if (isRecord(current.value)) {
      for (const [key, entry] of Object.entries(current.value)) {
        if (DANGEROUS_KEYS.has(key)) fail(`the field name "${key}" is not allowed.`);
        pending.push({ value: entry, depth: current.depth + 1 });
      }
    }
  }
}

function validateAttempt(
  value: unknown,
  index: number,
  promptGraphemes: string[],
  startedAtMs: number,
  endedAtMs: number,
  requireGraphemeIndex: boolean,
): asserts value is CharacterAttemptRecord {
  if (!isRecord(value)) fail(`session attempt ${index} is malformed.`);
  assertExactKeys(value, attemptKeys, `session attempt ${index}`);
  const expected = assertString(value.expectedCharacter, `session attempt ${index} expected character`, 32, true);
  assertString(value.enteredCharacter, `session attempt ${index} entered character`, 32, true);
  assertNumber(value.elapsedMs, `session attempt ${index} elapsed time`, 0, 24 * 60 * 60 * 1_000);
  const occurredAtMs = assertIsoTimestamp(value.occurredAt, `session attempt ${index} timestamp`);
  if (occurredAtMs < startedAtMs - 1_000 || occurredAtMs > endedAtMs + 1_000) {
    fail(`session attempt ${index} falls outside the session timestamps.`);
  }
  assertBoolean(value.correct, `session attempt ${index} correctness`);
  if (value.inputMode !== "hardware" && value.inputMode !== "touch") fail(`session attempt ${index} has an invalid input mode.`);
  if (value.timingValid !== undefined) assertBoolean(value.timingValid, `session attempt ${index} timing flag`);
  if (value.hesitant !== undefined) assertBoolean(value.hesitant, `session attempt ${index} hesitation flag`);

  if (value.graphemeIndex === undefined) {
    if (requireGraphemeIndex) fail(`session attempt ${index} has no grapheme position.`);
  } else {
    const graphemeIndex = assertInteger(
      value.graphemeIndex,
      `session attempt ${index} grapheme position`,
      0,
      Math.max(0, promptGraphemes.length - 1),
    );
    if (promptGraphemes[graphemeIndex] !== expected) {
      fail(`session attempt ${index} does not match the prompt grapheme at its position.`);
    }
  }
}

function validatePerformanceEntry(value: unknown, character: string, label: string): asserts value is CharacterPerformanceEntry {
  if (!isRecord(value)) fail(`${label} is malformed.`);
  assertExactKeys(value, performanceKeys, label);
  if (assertString(value.character, `${label} character`, 32, true) !== character) fail(`${label} does not match its map key.`);
  const attemptCount = assertInteger(value.attemptCount, `${label} attempt count`, 0, MAX_ATTEMPTS_PER_SESSION);
  const correctCount = assertInteger(value.correctCount, `${label} correct count`, 0, attemptCount);
  const mistakeCount = assertInteger(value.mistakeCount, `${label} mistake count`, 0, attemptCount);
  if (correctCount + mistakeCount !== attemptCount) fail(`${label} counts are inconsistent.`);
  assertNumber(value.smoothedResponseMs, `${label} response time`, 0, 24 * 60 * 60 * 1_000);
  assertNumber(value.bestRecentResponseMs, `${label} best response time`, 0, 24 * 60 * 60 * 1_000);
  assertNumber(value.masteryScore, `${label} mastery`, 0, 100);
  assertIsoTimestamp(value.lastSeenAt, `${label} last-seen timestamp`);
  if (value.hesitationCount !== undefined) assertInteger(value.hesitationCount, `${label} hesitation count`, 0, attemptCount);
  if (value.hesitationRate !== undefined) assertNumber(value.hesitationRate, `${label} hesitation rate`, 0, 100);
  if (value.repeatedFailureCount !== undefined) assertInteger(value.repeatedFailureCount, `${label} repeated failures`, 0, attemptCount);
  if (value.longestErrorRun !== undefined) assertInteger(value.longestErrorRun, `${label} longest error run`, 0, attemptCount);
  if (value.confusionCounts !== undefined) {
    if (!isRecord(value.confusionCounts) || Object.keys(value.confusionCounts).length > 256) fail(`${label} confusion counts are malformed.`);
    for (const [confusion, count] of Object.entries(value.confusionCounts)) {
      assertString(confusion, `${label} confusion character`, 32, true);
      assertInteger(count, `${label} confusion count`, 0, attemptCount);
    }
  }
  if (value.dominantConfusions !== undefined) {
    if (!Array.isArray(value.dominantConfusions) || value.dominantConfusions.length > 64) fail(`${label} dominant confusions are malformed.`);
    for (const [index, confusion] of value.dominantConfusions.entries()) {
      if (!isRecord(confusion)) fail(`${label} dominant confusion ${index} is malformed.`);
      assertExactKeys(confusion, ["character", "count"], `${label} dominant confusion ${index}`);
      assertString(confusion.character, `${label} dominant confusion character`, 32, true);
      assertInteger(confusion.count, `${label} dominant confusion count`, 0, attemptCount);
    }
  }
}

function validateIntegrity(value: unknown, label: string): asserts value is SessionIntegrity {
  if (!isRecord(value)) fail(`${label} is malformed.`);
  assertExactKeys(value, [
    "rankingEligible", "pasteDetected", "dropDetected", "autofillDetected",
    "replacementDetected", "undoRedoDetected", "suspiciousInsertionDetected",
    "visibilityInterrupted", "focusInterrupted", "clockAnomalyDetected", "invalidReasons",
  ], label);
  for (const key of [
    "rankingEligible", "pasteDetected", "dropDetected", "autofillDetected",
    "replacementDetected", "undoRedoDetected", "suspiciousInsertionDetected",
    "visibilityInterrupted", "focusInterrupted", "clockAnomalyDetected",
  ] as const) assertBoolean(value[key], `${label}.${key}`);
  const validReasons = new Set<SessionInvalidReason>([
    "pasted-text", "dropped-text", "autofill", "replacement-input", "undo-redo",
    "suspicious-multi-grapheme-input", "focus-interrupted", "visibility-interrupted",
    "clock-anomaly", "unknown-input",
  ]);
  if (!Array.isArray(value.invalidReasons) || value.invalidReasons.length > validReasons.size) fail(`${label} invalid reasons are malformed.`);
  if (!value.invalidReasons.every((reason) => validReasons.has(reason as SessionInvalidReason))) fail(`${label} contains an unknown invalid reason.`);
  if (new Set(value.invalidReasons).size !== value.invalidReasons.length) fail(`${label} repeats an invalid reason.`);
}

export function validateSessionRecord(value: unknown, requireCurrentFields: boolean): asserts value is SessionRecord {
  if (!isRecord(value)) fail("a session record is malformed.");
  assertExactKeys(value, sessionKeys, "session record");
  assertString(value.sessionId, "session ID", 160);
  if (value.sessionKind !== "adaptive" && value.sessionKind !== "benchmark") fail("a session kind is invalid.");
  if (!["plain", "symbols", "numbers", "code", "mixed"].includes(String(value.sessionFlavor))) fail("a session flavor is invalid.");
  assertString(value.languageId, "session language ID", 80);
  assertString(value.keyboardFamilyId, "session keyboard family ID", 80);
  assertString(value.keyboardLayoutId, "session keyboard layout ID", 80);
  if (value.inputMode !== "hardware" && value.inputMode !== "touch") fail("a session input mode is invalid.");
  const promptText = assertString(value.promptText, "session prompt", MAX_TEXT_CODE_UNITS, true);
  assertString(value.typedText, "session typed text", MAX_TEXT_CODE_UNITS, true);
  const promptGraphemes = splitTextIntoGraphemes(promptText);
  if (promptGraphemes.length > MAX_PROMPT_GRAPHEMES) fail("a session prompt has too many graphemes.");
  const startedAtMs = assertIsoTimestamp(value.startedAt, "session start timestamp");
  const endedAtMs = assertIsoTimestamp(value.endedAt, "session end timestamp");
  if (endedAtMs < startedAtMs) fail("a session ends before it starts.");
  assertBoolean(value.completed, "session completed flag");
  assertStringArray(value.priorityCharacters, "session priority characters", 4_096);
  assertStringArray(value.activeCharacterSet, "session active characters", 4_096);
  assertStringArray(value.unlockedCharacters, "session unlocked characters", 4_096);
  if (!Array.isArray(value.attemptLog) || value.attemptLog.length > MAX_ATTEMPTS_PER_SESSION) fail("a session attempt log is too large or malformed.");
  const requireGraphemeIndex =
    requireCurrentFields && value.scoringVersion === CURRENT_SCORING_VERSION;
  value.attemptLog.forEach((attempt, index) =>
    validateAttempt(
      attempt,
      index,
      promptGraphemes,
      startedAtMs,
      endedAtMs,
      requireGraphemeIndex,
    ),
  );
  if (!isRecord(value.perCharacterPerformance) || Object.keys(value.perCharacterPerformance).length > 4_096) fail("session character performance is malformed.");
  for (const [character, performance] of Object.entries(value.perCharacterPerformance)) {
    assertString(character, "session performance character", 32, true);
    validatePerformanceEntry(performance, character, `performance for ${JSON.stringify(character)}`);
  }
  assertNumber(value.grossWpm, "gross WPM", 0, 2_000);
  assertNumber(value.netWpm, "net WPM", 0, 2_000);
  assertNumber(value.accuracy, "accuracy", 0, 100);
  assertInteger(value.correctedErrorCount, "corrected error count", 0, MAX_ATTEMPTS_PER_SESSION);
  assertInteger(value.uncorrectedErrorCount, "uncorrected error count", 0, MAX_ATTEMPTS_PER_SESSION);
  assertInteger(value.durationMs, "session duration", 0, 24 * 60 * 60 * 1_000);
  if (value.benchmarkDurationSeconds !== undefined) assertInteger(value.benchmarkDurationSeconds, "benchmark duration", 1, 3_600);

  if (requireCurrentFields) {
    const reasons = new Set<CompletionReason>([
      "prompt-completed", "time-expired", "abandoned", "restarted", "route-changed",
      "interrupted", "storage-failed", "invalid-input",
    ]);
    if (!reasons.has(value.completionReason as CompletionReason)) fail("a session completion reason is invalid.");
    validateIntegrity(value.integrity, "session integrity");
    for (const key of ["promptCompleted", "analyticsEligible", "rankingEligible", "learnerModelEligible"] as const) assertBoolean(value[key], `session ${key}`);
    assertInteger(value.activeElapsedMs, "active elapsed time", 0, 24 * 60 * 60 * 1_000);
    assertInteger(value.pausedDurationMs, "paused duration", 0, 24 * 60 * 60 * 1_000);
    assertInteger(value.scoringVersion, "scoring version", 1, CURRENT_SCORING_VERSION);
    assertInteger(value.analyticsVersion, "analytics version", 1, CURRENT_ANALYTICS_VERSION);
    if (value.promptCompleted !== value.completed) fail("session completion flags disagree.");
    if (value.rankingEligible && value.sessionKind !== "benchmark") fail("a non-benchmark session is ranking eligible.");
    if ((value.analyticsEligible || value.rankingEligible || value.learnerModelEligible) && value.integrity.invalidReasons.length > 0) fail("an invalid session is marked eligible.");
  }
}

function validateProfileCharacterMap(value: unknown, label: string) {
  if (value === undefined) return;
  if (!isRecord(value) || Object.keys(value).length > MAX_PROFILE_CHARACTERS) fail(`${label} is malformed.`);
  for (const [character, profile] of Object.entries(value)) {
    assertString(character, `${label} key`, 32, true);
    if (!isRecord(profile)) fail(`${label} entry is malformed.`);
    if (profile.character !== character) fail(`${label} entry does not match its key.`);
    for (const entryValue of Object.values(profile)) {
      if (typeof entryValue === "number" && !Number.isFinite(entryValue)) fail(`${label} contains a non-finite metric.`);
    }
    for (const timestampKey of ["introducedAt", "nextReviewAt"] as const) assertIsoTimestamp(profile[timestampKey], `${label}.${timestampKey}`);
    for (const nullableTimestampKey of ["lastSeenAt", "lastCorrectAt", "lastMistakeAt"] as const) {
      if (profile[nullableTimestampKey] !== null) assertIsoTimestamp(profile[nullableTimestampKey], `${label}.${nullableTimestampKey}`);
    }
  }
}

export function validateLearnerProgressProfile(value: unknown): asserts value is LearnerProgressProfile {
  if (!isRecord(value)) fail("a learner profile is malformed.");
  assertExactKeys(value, profileKeys, "learner profile");
  assertString(value.progressionId, "learner profile ID", 160);
  assertString(value.languageId, "learner profile language ID", 80);
  assertString(value.keyboardLayoutId, "learner profile keyboard layout ID", 80);
  if (value.inputMode !== "hardware" && value.inputMode !== "touch") fail("a learner profile input mode is invalid.");
  assertBoolean(value.programmerModeEnabled, "learner profile programmer flag");
  assertInteger(value.currentStageIndex, "learner stage", 0, 10_000);
  for (const key of ["activeCharacterSet", "unlockedCharacters", "newlyUnlockedCharacters", "reinforcementCharacters", "stableCharacters", "recoveryCharacters", "unlockPreviewCharacters"] as const) {
    assertStringArray(value[key], `learner profile ${key}`, MAX_PROFILE_CHARACTERS);
  }
  for (const key of ["newCharacters", "shakyCharacters", "forgottenCharacters", "overtrainedCharacters", "scheduledReviewCharacters", "hesitationCharacters"] as const) {
    assertOptionalStringArray(value[key], `learner profile ${key}`, MAX_PROFILE_CHARACTERS);
  }
  assertBoolean(value.regressionHold, "learner regression hold");
  assertNumber(value.recentReadinessScore, "learner readiness", 0, 100);
  assertNumber(value.recentStabilityScore, "learner stability", 0, 100);
  assertInteger(value.completedAdaptiveSessions, "completed adaptive sessions", 0, MAX_ARCHIVE_SESSIONS);
  if (!Array.isArray(value.milestoneHistory) || value.milestoneHistory.length > 20_000) fail("learner milestone history is malformed.");
  for (const [index, milestone] of value.milestoneHistory.entries()) {
    if (!isRecord(milestone)) fail(`learner milestone ${index} is malformed.`);
    assertExactKeys(milestone, ["milestoneId", "kind", "occurredAt", "stageIndex", "affectedCharacters", "readinessScore"], `learner milestone ${index}`);
    assertString(milestone.milestoneId, `learner milestone ${index} ID`, 160);
    if (!["unlock", "regression-hold", "recovery-cycle", "stability-check", "resurface"].includes(String(milestone.kind))) fail(`learner milestone ${index} kind is invalid.`);
    assertIsoTimestamp(milestone.occurredAt, `learner milestone ${index} timestamp`);
    assertInteger(milestone.stageIndex, `learner milestone ${index} stage`, 0, 10_000);
    assertStringArray(milestone.affectedCharacters, `learner milestone ${index} characters`, MAX_PROFILE_CHARACTERS);
    assertNumber(milestone.readinessScore, `learner milestone ${index} readiness`, 0, 100);
  }
  validateProfileCharacterMap(value.characterProfiles, "learner character profiles");
  assertIsoTimestamp(value.updatedAt, "learner profile update timestamp");
  assertInteger(value.version, "learner profile version", 1, 100);
}

export function validatePreferences(value: unknown) {
  if (!isRecord(value)) fail("preferences are malformed.");
  assertExactKeys(value, Object.keys(defaultPracticePreferences), "preferences");
  const normalized = normalizePracticePreferences(value as Partial<PracticePreferences>);
  if (normalized.schemaVersion !== CURRENT_PREFERENCES_SCHEMA_VERSION) fail("preferences could not be migrated.");
  return normalized;
}

export function assertUniqueIds(values: string[], label: string) {
  if (new Set(values).size !== values.length) fail(`${label} contain duplicate IDs.`);
}
