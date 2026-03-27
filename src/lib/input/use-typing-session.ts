"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScriptFamily } from "@/content/languages/language-text-metadata";
import { detectInputLanguageMismatch } from "@/lib/input/input-language-mismatch";
import {
  clampTypingValueToPromptLength,
  SPACE_SKIP_MARKER,
} from "@/lib/input/typing-markers";
import { scoreTypingSession } from "@/lib/scoring/session-scorer";
import type {
  CharacterAttemptRecord,
  InputMode,
  SessionFlavor,
  SessionKind,
} from "@/lib/scoring/session-models";

interface ActiveEntry {
  expectedCharacter: string;
  enteredCharacter: string;
  correct: boolean;
}

interface CompositionTracker {
  active: boolean;
  latestValue: string;
}

export interface TypingCompletionPayload {
  promptText: string;
  typedText: string;
  attemptLog: CharacterAttemptRecord[];
  correctedErrorCount: number;
  startedAt: string;
  endedAt: string;
  completed: boolean;
}

interface TypingSessionOptions {
  promptText: string;
  sessionKind: SessionKind;
  sessionFlavor: SessionFlavor;
  inputMode: InputMode;
  expectedScriptFamily?: ScriptFamily;
  spaceSkipsWords?: boolean;
  durationSeconds?: number;
  masterySpeedGoal?: number;
  onComplete?: (payload: TypingCompletionPayload) => void;
}

function findSharedPrefixLength(leftText: string, rightText: string) {
  const maxLength = Math.min(leftText.length, rightText.length);
  let index = 0;

  while (index < maxLength && leftText[index] === rightText[index]) {
    index += 1;
  }

  return index;
}

function findCurrentWordBoundary(promptText: string, fromIndex: number) {
  let currentIndex = fromIndex;

  while (currentIndex < promptText.length && promptText[currentIndex] !== " ") {
    currentIndex += 1;
  }

  return currentIndex;
}

function expandIncomingValue(
  incomingValue: string,
  typedText: string,
  promptText: string,
  spaceSkipsWords: boolean,
) {
  const normalizedIncomingValue = clampTypingValueToPromptLength(
    incomingValue.replace(/\r/g, ""),
    promptText.length,
  );
  const sharedPrefixLength = findSharedPrefixLength(typedText, normalizedIncomingValue);
  const appendedSegment = Array.from(normalizedIncomingValue.slice(sharedPrefixLength));

  let rebuiltValue = normalizedIncomingValue.slice(0, sharedPrefixLength);

  for (const enteredCharacter of appendedSegment) {
    const promptIndex = rebuiltValue.length;
    const expectedCharacter = promptText[promptIndex];

    if (
      spaceSkipsWords &&
      enteredCharacter === " " &&
      expectedCharacter !== undefined &&
      expectedCharacter !== " "
    ) {
      const wordBoundaryIndex = findCurrentWordBoundary(promptText, promptIndex);
      const skippedCharacterCount = Math.max(0, wordBoundaryIndex - promptIndex);

      rebuiltValue += SPACE_SKIP_MARKER.repeat(skippedCharacterCount);

      if (wordBoundaryIndex < promptText.length) {
        rebuiltValue += promptText[wordBoundaryIndex];
      }

      continue;
    }

    rebuiltValue += enteredCharacter;
  }

  return clampTypingValueToPromptLength(rebuiltValue, promptText.length);
}

export function useTypingSession(options: TypingSessionOptions) {
  const [typedText, setTypedText] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [attemptLog, setAttemptLog] = useState<CharacterAttemptRecord[]>([]);
  const [correctedErrorCount, setCorrectedErrorCount] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const activeEntriesReference = useRef<ActiveEntry[]>([]);
  const lastInputTimestampReference = useRef<number | null>(null);
  const completionTriggeredReference = useRef(false);
  const compositionTrackerReference = useRef<CompositionTracker>({
    active: false,
    latestValue: "",
  });
  const [renderClock, setRenderClock] = useState(Date.now());

  const resetSession = useCallback(
    (message?: string) => {
      activeEntriesReference.current = [];
      lastInputTimestampReference.current = null;
      completionTriggeredReference.current = false;
      compositionTrackerReference.current = {
        active: false,
        latestValue: "",
      };
      setTypedText("");
      setInputValue("");
      setIsComposing(false);
      setAttemptLog([]);
      setCorrectedErrorCount(0);
      setStartedAt(null);
      setEndedAt(null);
      setSessionRevision((revision) => revision + 1);
      setStatusMessage(message ?? null);
    },
    [],
  );

  useEffect(() => {
    resetSession();
  }, [options.promptText, resetSession]);

  useEffect(() => {
    const intervalHandle = window.setInterval(() => {
      setRenderClock(Date.now());
    }, 200);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, []);

  const completeSession = useCallback(
    (completed: boolean) => {
      if (completionTriggeredReference.current || !startedAt) {
        return;
      }

      completionTriggeredReference.current = true;
      const finishedAt = new Date().toISOString();
      setEndedAt(finishedAt);
      options.onComplete?.({
        promptText: options.promptText,
        typedText,
        attemptLog,
        correctedErrorCount,
        startedAt,
        endedAt: finishedAt,
        completed,
      });
    },
    [attemptLog, correctedErrorCount, options, startedAt, typedText],
  );

  useEffect(() => {
    if (!startedAt || endedAt || !options.durationSeconds) {
      return;
    }

    const countdownRemaining =
      new Date(startedAt).getTime() + options.durationSeconds * 1000 - renderClock;

    if (countdownRemaining <= 0) {
      completeSession(true);
    }
  }, [completeSession, endedAt, options.durationSeconds, renderClock, startedAt]);

  useEffect(() => {
    function invalidateOnFocusLoss() {
      if (startedAt && !endedAt && typedText.length > 0) {
        resetSession("Focus changed, so the session was restarted to protect timing quality.");
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        invalidateOnFocusLoss();
      }
    }

    window.addEventListener("blur", invalidateOnFocusLoss);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", invalidateOnFocusLoss);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [endedAt, resetSession, startedAt, typedText.length]);

  const commitTextChange = useCallback(
    (incomingValue: string) => {
      if (endedAt) {
        return;
      }

      const nextValue = clampTypingValueToPromptLength(
        incomingValue.replace(/\r/g, ""),
        options.promptText.length,
      );
      const now = Date.now();
      const sharedPrefixLength = findSharedPrefixLength(typedText, nextValue);
      const removalCount = typedText.length - sharedPrefixLength;

      if (!startedAt && nextValue.length > 0) {
        const sessionStart = new Date(now).toISOString();
        setStartedAt(sessionStart);
        lastInputTimestampReference.current = now;
      }

      if (removalCount > 0) {
        for (let index = 0; index < removalCount; index += 1) {
          const removedEntry = activeEntriesReference.current.pop();

          if (removedEntry && !removedEntry.correct) {
            setCorrectedErrorCount((existingCount) => existingCount + 1);
          }
        }
      }

      const appendedSegment = nextValue.slice(sharedPrefixLength);
      const nextAttemptEntries: CharacterAttemptRecord[] = [];
      const existingActiveEntries = activeEntriesReference.current.slice(0, sharedPrefixLength);

      if (appendedSegment.length > 0) {
        const referenceTimestamp = lastInputTimestampReference.current ?? now;
        const segmentElapsed = Math.max(
          40,
          Math.round((now - referenceTimestamp) / appendedSegment.length) || 80,
        );

        for (const [segmentIndex, enteredCharacter] of Array.from(appendedSegment).entries()) {
          const promptIndex = sharedPrefixLength + segmentIndex;
          const expectedCharacter = options.promptText[promptIndex] ?? "";
          const attemptEntry: CharacterAttemptRecord = {
            expectedCharacter,
            enteredCharacter,
            elapsedMs: segmentElapsed,
            occurredAt: new Date(now + segmentIndex).toISOString(),
            correct: enteredCharacter === expectedCharacter,
            inputMode: options.inputMode,
            hesitant:
              segmentElapsed >= (options.masterySpeedGoal ?? 220) * 1.35,
          };

          nextAttemptEntries.push(attemptEntry);
          existingActiveEntries.push({
            expectedCharacter,
            enteredCharacter,
            correct: enteredCharacter === expectedCharacter,
          });
        }

        lastInputTimestampReference.current = now;
      }

      activeEntriesReference.current = existingActiveEntries;
      setTypedText(nextValue);
      setInputValue(nextValue);
      setAttemptLog((existingAttempts) => [...existingAttempts, ...nextAttemptEntries]);
      setStatusMessage(null);

      if (nextValue.length === options.promptText.length) {
        window.setTimeout(() => {
          completeSession(true);
        }, 0);
      }
    },
    [
      completeSession,
      endedAt,
      options.inputMode,
      options.masterySpeedGoal,
      options.promptText,
      startedAt,
      typedText,
    ],
  );

  const handleTextChange = useCallback(
    (incomingValue: string) => {
      const nextValue = expandIncomingValue(
        incomingValue,
        typedText,
        options.promptText,
        options.spaceSkipsWords ?? false,
      );
      setInputValue(nextValue);

      if (compositionTrackerReference.current.active) {
        compositionTrackerReference.current.latestValue = nextValue;
        return;
      }

      commitTextChange(nextValue);
    },
    [commitTextChange, options.promptText, options.spaceSkipsWords, typedText],
  );

  const handleCompositionStart = useCallback(() => {
    compositionTrackerReference.current.active = true;
    compositionTrackerReference.current.latestValue = inputValue;
    setIsComposing(true);
    setStatusMessage(
      "Composition input is active. Timing advances after the composed text is committed.",
    );
  }, [inputValue]);

  const handleCompositionUpdate = useCallback(
    (incomingValue: string) => {
      const nextValue = clampTypingValueToPromptLength(
        incomingValue.replace(/\r/g, ""),
        options.promptText.length,
      );
      compositionTrackerReference.current.latestValue = nextValue;
      setInputValue(nextValue);
    },
    [options.promptText.length],
  );

  const handleCompositionEnd = useCallback(
    (incomingValue: string) => {
      const nextValue = clampTypingValueToPromptLength(
        incomingValue.replace(/\r/g, ""),
        options.promptText.length,
      );

      compositionTrackerReference.current.active = false;
      compositionTrackerReference.current.latestValue = nextValue;
      setIsComposing(false);
      setInputValue(nextValue);
      setStatusMessage(null);
      commitTextChange(nextValue);
    },
    [commitTextChange, options.promptText.length],
  );

  const previewScore = useMemo(
    () =>
      scoreTypingSession({
        promptText: options.promptText,
        typedText,
        attemptLog,
        correctedErrorCount,
        startedAt: startedAt ?? new Date(renderClock).toISOString(),
        endedAt:
          endedAt ??
          new Date(
            startedAt ? renderClock : Date.now(),
          ).toISOString(),
        masterySpeedGoal: options.masterySpeedGoal,
      }),
    [
      attemptLog,
      correctedErrorCount,
      endedAt,
      options.masterySpeedGoal,
      options.promptText,
      renderClock,
      startedAt,
      typedText,
    ],
  );

  const remainingMs =
    startedAt && options.durationSeconds
      ? Math.max(
          0,
          new Date(startedAt).getTime() + options.durationSeconds * 1000 - renderClock,
        )
      : options.durationSeconds
        ? options.durationSeconds * 1000
        : null;
  const inputLanguageMismatch = useMemo(
    () =>
      isComposing
        ? null
        : detectInputLanguageMismatch({
            value: inputValue,
            expectedScriptFamily: options.expectedScriptFamily,
          }),
    [inputValue, isComposing, options.expectedScriptFamily],
  );

  return {
    typedText,
    inputValue,
    isComposing,
    attemptLog,
    correctedErrorCount,
    startedAt,
    endedAt,
    sessionRevision,
    statusMessage,
    inputLanguageMismatch,
    remainingMs,
    previewScore,
    handleTextChange,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    resetSession,
  };
}
