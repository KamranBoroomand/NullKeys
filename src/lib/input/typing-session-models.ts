import type { ScriptFamily } from "@/content/languages/language-text-metadata";
import type { CharacterAttemptRecord, InputMode, SessionFlavor, SessionKind } from "@/lib/scoring/session-models";
import type { CompletionReason, SessionIntegrity } from "@/lib/scoring/session-validity";

export interface ActiveEntry {
  expectedCharacter: string;
  enteredCharacter: string;
  correct: boolean;
}

export interface CompositionTracker {
  active: boolean;
  latestValue: string;
  startedMonotonicMs: number | null;
}

export type FocusLossPolicy = "invalidate" | "pause";

export type CompletionPersistenceStatus =
  | "idle"
  | "finalizing"
  | "saving"
  | "saved"
  | "save-failed"
  | "retrying";

export interface TypingCompletionPayload {
  sessionId: string;
  promptText: string;
  typedText: string;
  attemptLog: CharacterAttemptRecord[];
  correctedErrorCount: number;
  startedAt: string;
  endedAt: string;
  completed: boolean;
  promptCompleted: boolean;
  completionReason: CompletionReason;
  integrity: SessionIntegrity;
  analyticsEligible: boolean;
  rankingEligible: boolean;
  learnerModelEligible: boolean;
  activeElapsedMs: number;
  pausedDurationMs: number;
}

export interface TypingSessionOptions {
  promptText: string;
  sessionKind: SessionKind;
  sessionFlavor: SessionFlavor;
  inputMode: InputMode;
  expectedScriptFamily?: ScriptFamily;
  spaceSkipsWords?: boolean;
  durationSeconds?: number;
  masterySpeedGoal?: number;
  focusLossPolicy?: FocusLossPolicy;
  onComplete?: (payload: TypingCompletionPayload) => void | Promise<void>;
}

export interface TypingSessionSnapshot {
  sessionId: string | null;
  typedText: string;
  inputValue: string;
  attemptLog: CharacterAttemptRecord[];
  correctedErrorCount: number;
  startedAt: string | null;
  startedWallClockMs: number | null;
  startedMonotonicMs: number | null;
  endedAt: string | null;
  activeElapsedMs: number | null;
}

export function createEmptyTypingSessionSnapshot(): TypingSessionSnapshot {
  return {
    sessionId: null,
    typedText: "",
    inputValue: "",
    attemptLog: [],
    correctedErrorCount: 0,
    startedAt: null,
    startedWallClockMs: null,
    startedMonotonicMs: null,
    endedAt: null,
    activeElapsedMs: null,
  };
}
