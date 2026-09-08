"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSessionDeadline,
  elapsedMonotonicMs,
  isInputEventEligible,
  normalizeEventTimestamp,
  readMonotonicSample,
  type MonotonicSample,
} from "@/lib/input/deadline-policy";
import { detectInputLanguageMismatch } from "@/lib/input/input-language-mismatch";
import {
  classifyTypingInput,
  type TypingInputMetadata,
} from "@/lib/input/input-event-classifier";
import { clampTypingValueToPromptLength } from "@/lib/input/typing-markers";
import {
  createEmptyTypingSessionSnapshot,
  type ActiveEntry,
  type CompositionTracker,
  type TypingCompletionPayload,
  type TypingSessionOptions,
  type TypingSessionSnapshot,
} from "@/lib/input/typing-session-models";
import {
  expandIncomingTypingValue,
  isTypingPromptComplete,
} from "@/lib/input/typing-session-text-policy";
import { useCompletionPersistence } from "@/lib/input/use-completion-persistence";
import { createSessionId } from "@/lib/persistence/session-id";
import { setTypingSessionActivity } from "@/lib/input/typing-session-activity";
import { scoreTypingSession } from "@/lib/scoring/session-scorer";
import type { CharacterAttemptRecord } from "@/lib/scoring/session-models";
import {
  addIntegrityInvalidReason,
  createSessionIntegrity,
  finalizeSessionEligibility,
  type CompletionReason,
  type SessionIntegrity,
} from "@/lib/scoring/session-validity";
import {
  countTextGraphemes,
  findSharedGraphemePrefixLength,
  splitTextIntoGraphemes,
} from "@/lib/text/language-text-normalization";

function eventWallClockMs(sample: MonotonicSample, eventMonotonicMs: number) {
  return sample.wallClockMs - (sample.monotonicMs - eventMonotonicMs);
}

export function resolveFocusLossPolicy(options: TypingSessionOptions) {
  return options.focusLossPolicy ??
    (options.sessionKind === "benchmark" ? "invalidate" : "pause");
}

export function useTypingSession(options: TypingSessionOptions) {
  const [snapshot, setSnapshot] = useState<TypingSessionSnapshot>(() => createEmptyTypingSessionSnapshot());
  const [isComposing, setIsComposing] = useState(false);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [renderSample, setRenderSample] = useState<MonotonicSample>(() => readMonotonicSample());
  const snapshotReference = useRef<TypingSessionSnapshot>(createEmptyTypingSessionSnapshot());
  const optionsReference = useRef(options);
  const activeEntriesReference = useRef<ActiveEntry[]>([]);
  const lastInputTimestampReference = useRef<number | null>(null);
  const completionTriggeredReference = useRef(false);
  const integrityReference = useRef<SessionIntegrity>(createSessionIntegrity());
  const hasAuthoritativeAttemptTimingReference = useRef(true);
  const pausedDurationReference = useRef(0);
  const pauseStartedMonotonicMsReference = useRef<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const compositionTrackerReference = useRef<CompositionTracker>({
    active: false,
    latestValue: "",
    startedMonotonicMs: null,
  });
  const mountTokenReference = useRef<symbol | null>(null);
  const {
    status: persistenceStatus,
    error: persistenceError,
    pendingCompletionsReference,
    persistCompletion,
    retrySave,
    markFinalizing,
  } = useCompletionPersistence(options.onComplete);

  useEffect(() => {
    optionsReference.current = options;
  }, [options]);

  const publishSnapshot = useCallback((nextSnapshot: TypingSessionSnapshot) => {
    snapshotReference.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  const completeSession = useCallback(
    (
      requestedReason: CompletionReason,
      promptCompleted: boolean,
      snapshotOverride?: TypingSessionSnapshot,
      finishedSample = readMonotonicSample(),
      finishedMonotonicMs = finishedSample.monotonicMs,
    ) => {
      const currentSnapshot = snapshotOverride ?? snapshotReference.current;

      if (
        completionTriggeredReference.current ||
        !currentSnapshot.sessionId ||
        !currentSnapshot.startedAt ||
        currentSnapshot.startedWallClockMs === null ||
        currentSnapshot.startedMonotonicMs === null ||
        currentSnapshot.endedAt
      ) {
        return;
      }

      completionTriggeredReference.current = true;
      markFinalizing();
      const openPauseDurationMs =
        pauseStartedMonotonicMsReference.current === null
          ? 0
          : Math.max(
              0,
              Math.round(
                finishedMonotonicMs - pauseStartedMonotonicMsReference.current,
              ),
            );
      const pausedDurationMs = pausedDurationReference.current + openPauseDurationMs;
      const totalElapsedMs = elapsedMonotonicMs(
        currentSnapshot.startedMonotonicMs,
        finishedMonotonicMs,
      );
      const activeElapsedMs = Math.max(0, totalElapsedMs - pausedDurationMs);
      const wallElapsedMs = finishedSample.wallClockMs - currentSnapshot.startedWallClockMs;
      let integrity = integrityReference.current;

      if (Math.abs(wallElapsedMs - (activeElapsedMs + pausedDurationMs)) > 5_000) {
        integrity = addIntegrityInvalidReason(integrity, "clock-anomaly");
        integrityReference.current = integrity;
      }

      const completionReason =
        requestedReason === "prompt-completed" && integrity.invalidReasons.length > 0
          ? "invalid-input"
          : requestedReason;
      const eligibility = finalizeSessionEligibility({
        sessionKind: optionsReference.current.sessionKind,
        completionReason,
        promptCompleted,
        integrity,
        hasAuthoritativeAttemptTiming: hasAuthoritativeAttemptTimingReference.current,
      });
      const finalizedIntegrity = {
        ...integrity,
        rankingEligible: eligibility.rankingEligible,
      };
      integrityReference.current = finalizedIntegrity;
      const endedAt = new Date(finishedSample.wallClockMs).toISOString();
      const finalizedSnapshot: TypingSessionSnapshot = {
        ...currentSnapshot,
        endedAt,
        activeElapsedMs,
      };

      publishSnapshot(finalizedSnapshot);
      const payload: TypingCompletionPayload = {
        sessionId: currentSnapshot.sessionId,
        promptText: optionsReference.current.promptText,
        typedText: finalizedSnapshot.typedText,
        attemptLog: finalizedSnapshot.attemptLog,
        correctedErrorCount: finalizedSnapshot.correctedErrorCount,
        startedAt: currentSnapshot.startedAt,
        endedAt,
        completed: promptCompleted,
        promptCompleted: eligibility.promptCompleted,
        completionReason,
        integrity: finalizedIntegrity,
        analyticsEligible: eligibility.analyticsEligible,
        rankingEligible: eligibility.rankingEligible,
        learnerModelEligible: eligibility.learnerModelEligible,
        activeElapsedMs,
        pausedDurationMs,
      };

      void persistCompletion(payload, false);
    },
    [markFinalizing, persistCompletion, publishSnapshot],
  );

  const resetSession = useCallback(
    (message?: string, completionReason: CompletionReason = "restarted") => {
      const currentSnapshot = snapshotReference.current;

      if (currentSnapshot.startedAt && !currentSnapshot.endedAt) {
        completeSession(completionReason, false, currentSnapshot);
      }

      const nextSnapshot = createEmptyTypingSessionSnapshot();
      activeEntriesReference.current = [];
      lastInputTimestampReference.current = null;
      completionTriggeredReference.current = false;
      integrityReference.current = createSessionIntegrity();
      hasAuthoritativeAttemptTimingReference.current = true;
      pausedDurationReference.current = 0;
      pauseStartedMonotonicMsReference.current = null;
      compositionTrackerReference.current = {
        active: false,
        latestValue: "",
        startedMonotonicMs: null,
      };
      publishSnapshot(nextSnapshot);
      setIsComposing(false);
      setIsPaused(false);
      setSessionRevision((revision) => revision + 1);
      setStatusMessage(message ?? null);
    },
    [completeSession, publishSnapshot],
  );

  const promptTextReference = useRef(options.promptText);

  useEffect(() => {
    if (promptTextReference.current === options.promptText) {
      return;
    }

    promptTextReference.current = options.promptText;
    resetSession(undefined, "abandoned");
  }, [options.promptText, resetSession]);

  useEffect(() => {
    const intervalHandle = window.setInterval(() => {
      setRenderSample(readMonotonicSample());
    }, 200);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, []);

  useEffect(() => {
    if (
      snapshot.startedMonotonicMs === null ||
      snapshot.endedAt ||
      pauseStartedMonotonicMsReference.current !== null ||
      !options.durationSeconds
    ) {
      return;
    }

    const deadline = buildSessionDeadline(
      snapshot.startedMonotonicMs,
      options.durationSeconds,
    ) + pausedDurationReference.current;

    if (renderSample.monotonicMs >= deadline) {
      completeSession("time-expired", false, snapshot, renderSample, deadline);
    }
  }, [completeSession, options.durationSeconds, renderSample, snapshot]);

  useEffect(() => {
    let windowHasFocus = true;
    let documentIsVisible = document.visibilityState !== "hidden";

    function hasActiveSession() {
      const currentSnapshot = snapshotReference.current;

      return Boolean(currentSnapshot.startedAt && !currentSnapshot.endedAt);
    }

    function pauseAdaptiveSession(interruption: "focus" | "visibility") {
      if (!hasActiveSession() || pauseStartedMonotonicMsReference.current !== null) return;

      const sample = readMonotonicSample();
      pauseStartedMonotonicMsReference.current = sample.monotonicMs;
      setRenderSample(sample);
      setIsPaused(true);
      setStatusMessage(
        interruption === "visibility"
          ? "Practice paused while the page is hidden. Your prompt and typed text are preserved."
          : "Practice paused while focus is elsewhere. Your prompt and typed text are preserved.",
      );
    }

    function interruptBenchmark(interruption: "focus" | "visibility") {
      const currentSnapshot = snapshotReference.current;

      if (!currentSnapshot.startedAt || currentSnapshot.endedAt) return;

      const invalidReason =
        interruption === "visibility"
          ? "visibility-interrupted"
          : "focus-interrupted";
      integrityReference.current = addIntegrityInvalidReason(
        integrityReference.current,
        invalidReason,
      );
      completeSession("interrupted", false, currentSnapshot);
      setStatusMessage(
        invalidReason === "visibility-interrupted"
          ? "The page was hidden, so this result is saved as interrupted and cannot rank."
          : "Focus changed, so this result is saved as interrupted and cannot rank.",
      );
    }

    function applyFocusLoss(interruption: "focus" | "visibility") {
      if (resolveFocusLossPolicy(optionsReference.current) === "pause") {
        pauseAdaptiveSession(interruption);
        return;
      }

      interruptBenchmark(interruption);
    }

    function resumeAdaptiveSession() {
      if (
        !hasActiveSession() ||
        resolveFocusLossPolicy(optionsReference.current) !== "pause" ||
        !windowHasFocus ||
        !documentIsVisible ||
        pauseStartedMonotonicMsReference.current === null
      ) {
        return;
      }

      const sample = readMonotonicSample();
      const pauseDurationMs = Math.round(
        sample.monotonicMs - pauseStartedMonotonicMsReference.current,
      );

      if (!Number.isFinite(pauseDurationMs) || pauseDurationMs < 0) {
        hasAuthoritativeAttemptTimingReference.current = false;
      } else {
        pausedDurationReference.current += pauseDurationMs;

        if (lastInputTimestampReference.current !== null) {
          lastInputTimestampReference.current += pauseDurationMs;
        }
      }

      pauseStartedMonotonicMsReference.current = null;
      setRenderSample(sample);
      setIsPaused(false);
      setStatusMessage("Practice resumed. Paused time is excluded from timing.");
    }

    function handleWindowBlur() {
      windowHasFocus = false;
      applyFocusLoss("focus");
    }

    function handleWindowFocus() {
      windowHasFocus = true;
      resumeAdaptiveSession();
    }

    function handleVisibilityChange() {
      documentIsVisible = document.visibilityState !== "hidden";

      if (!documentIsVisible) {
        applyFocusLoss("visibility");
      } else {
        resumeAdaptiveSession();
      }
    }

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [completeSession]);

  const activeSessionId = snapshot.startedAt && !snapshot.endedAt ? snapshot.sessionId : null;

  useEffect(() => {
    if (!activeSessionId) return;
    setTypingSessionActivity(activeSessionId, true);
    return () => setTypingSessionActivity(activeSessionId, false);
  }, [activeSessionId]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (pendingCompletionsReference.current.size === 0) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    function handleLinkNavigation(event: MouseEvent) {
      if (pendingCompletionsReference.current.size === 0 || event.defaultPrevented) {
        return;
      }

      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a[href]") : null;

      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);

      if (nextUrl.origin !== window.location.origin || nextUrl.href === window.location.href) {
        return;
      }

      if (!window.confirm("This result has not been saved yet. Leave this page anyway?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkNavigation, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkNavigation, true);
    };
  }, [pendingCompletionsReference]);

  useEffect(() => {
    const mountToken = Symbol("typing-session-mount");
    mountTokenReference.current = mountToken;

    return () => {
      queueMicrotask(() => {
        if (mountTokenReference.current !== mountToken) {
          return;
        }

        const currentSnapshot = snapshotReference.current;

        if (currentSnapshot.startedAt && !currentSnapshot.endedAt) {
          completeSession("route-changed", false, currentSnapshot);
        }
      });
    };
  }, [completeSession]);

  const commitTextChange = useCallback(
    (incomingValue: string, inputMetadata: TypingInputMetadata = { sourceHint: "typed-text" }) => {
      const currentSnapshot = snapshotReference.current;

      if (
        currentSnapshot.endedAt ||
        pauseStartedMonotonicMsReference.current !== null
      ) {
        return;
      }

      const sample = readMonotonicSample();
      const normalizedTimestamp = normalizeEventTimestamp(
        inputMetadata.eventTimestampMs,
        sample,
      );

      if (normalizedTimestamp.clockAnomalyDetected) {
        integrityReference.current = addIntegrityInvalidReason(
          integrityReference.current,
          "clock-anomaly",
        );
      }

      if (currentSnapshot.startedMonotonicMs !== null && optionsReference.current.durationSeconds) {
        const deadline = buildSessionDeadline(
          currentSnapshot.startedMonotonicMs,
          optionsReference.current.durationSeconds,
        ) + pausedDurationReference.current;

        if (!isInputEventEligible(normalizedTimestamp.monotonicMs, deadline)) {
          completeSession("time-expired", false, currentSnapshot, sample, deadline);
          return;
        }
      }

      const promptGraphemes = splitTextIntoGraphemes(optionsReference.current.promptText);
      const nextValue = clampTypingValueToPromptLength(
        incomingValue.replace(/\r/g, ""),
        promptGraphemes.length,
      );
      const currentGraphemes = splitTextIntoGraphemes(currentSnapshot.typedText);
      const nextGraphemes = splitTextIntoGraphemes(nextValue);
      const sharedPrefixLength = findSharedGraphemePrefixLength(
        currentGraphemes.join(""),
        nextGraphemes.join(""),
      );
      const appendedSegment = nextGraphemes.slice(sharedPrefixLength);
      const classifiedInput = classifyTypingInput(
        inputMetadata,
        appendedSegment.join(""),
      );

      for (const invalidReason of classifiedInput.invalidReasons) {
        integrityReference.current = addIntegrityInvalidReason(
          integrityReference.current,
          invalidReason,
        );
      }

      if (appendedSegment.length > 0 && !classifiedInput.timingAuthoritative) {
        hasAuthoritativeAttemptTimingReference.current = false;
      }

      const removalCount = currentGraphemes.length - sharedPrefixLength;
      const nextActiveEntries = activeEntriesReference.current.slice(0, sharedPrefixLength);
      let nextCorrectedErrorCount = currentSnapshot.correctedErrorCount;

      for (let index = 0; index < removalCount; index += 1) {
        const removedEntry = activeEntriesReference.current[sharedPrefixLength + index];

        if (removedEntry && !removedEntry.correct) {
          nextCorrectedErrorCount += 1;
        }
      }

      const previousInputTimestamp = lastInputTimestampReference.current;
      const eventTimestamp = normalizedTimestamp.monotonicMs;
      const occurredAt = new Date(eventWallClockMs(sample, eventTimestamp)).toISOString();
      const nextAttemptEntries: CharacterAttemptRecord[] = [];

      for (const [segmentIndex, enteredCharacter] of appendedSegment.entries()) {
        const promptIndex = sharedPrefixLength + segmentIndex;
        const expectedCharacter = promptGraphemes[promptIndex] ?? "";
        const correct = enteredCharacter === expectedCharacter;
        const timingValid =
          classifiedInput.timingAuthoritative &&
          previousInputTimestamp !== null &&
          appendedSegment.length === 1;
        const elapsedMs = timingValid
          ? Math.max(1, Math.round(eventTimestamp - previousInputTimestamp))
          : 0;

        nextAttemptEntries.push({
          graphemeIndex: promptIndex,
          expectedCharacter,
          enteredCharacter,
          elapsedMs,
          occurredAt,
          correct,
          inputMode: optionsReference.current.inputMode,
          inputSource: classifiedInput.source,
          timingValid,
          hesitant:
            timingValid &&
            elapsedMs >= (optionsReference.current.masterySpeedGoal ?? 220) * 1.35,
        });
        nextActiveEntries.push({ expectedCharacter, enteredCharacter, correct });
      }

      if (appendedSegment.length > 0) {
        lastInputTimestampReference.current = eventTimestamp;
      }

      activeEntriesReference.current = nextActiveEntries;
      const startsNow = nextGraphemes.length > 0 && !currentSnapshot.startedAt;
      const startedWallClockMs = startsNow
        ? eventWallClockMs(sample, eventTimestamp)
        : currentSnapshot.startedWallClockMs;
      const nextSnapshot: TypingSessionSnapshot = {
        sessionId: startsNow ? createSessionId() : currentSnapshot.sessionId,
        typedText: nextValue,
        inputValue: nextValue,
        attemptLog: [...currentSnapshot.attemptLog, ...nextAttemptEntries],
        correctedErrorCount: nextCorrectedErrorCount,
        startedAt: startsNow
          ? new Date(startedWallClockMs ?? sample.wallClockMs).toISOString()
          : currentSnapshot.startedAt,
        startedWallClockMs,
        startedMonotonicMs: startsNow
          ? eventTimestamp
          : currentSnapshot.startedMonotonicMs,
        endedAt: null,
        activeElapsedMs: null,
      };

      publishSnapshot(nextSnapshot);
      setStatusMessage(null);

      if (
        promptGraphemes.length > 0 &&
        isTypingPromptComplete(optionsReference.current.promptText, nextValue)
      ) {
        completeSession(
          "prompt-completed",
          true,
          nextSnapshot,
          sample,
          eventTimestamp,
        );
      }
    },
    [completeSession, publishSnapshot],
  );

  const handleTextChange = useCallback(
    (incomingValue: string, inputMetadata?: TypingInputMetadata) => {
      if (pauseStartedMonotonicMsReference.current !== null) {
        return;
      }

      const currentSnapshot = snapshotReference.current;
      const nextValue = expandIncomingTypingValue(
        incomingValue,
        currentSnapshot.typedText,
        optionsReference.current.promptText,
        optionsReference.current.spaceSkipsWords ?? false,
      );

      publishSnapshot({ ...currentSnapshot, inputValue: nextValue });

      if (compositionTrackerReference.current.active) {
        compositionTrackerReference.current.latestValue = nextValue;
        return;
      }

      commitTextChange(nextValue, inputMetadata);
    },
    [commitTextChange, publishSnapshot],
  );

  const handleCompositionStart = useCallback((inputMetadata?: TypingInputMetadata) => {
    if (pauseStartedMonotonicMsReference.current !== null) return;

    const sample = readMonotonicSample();
    const timestamp = normalizeEventTimestamp(inputMetadata?.eventTimestampMs, sample);
    const currentSnapshot = snapshotReference.current;

    if (currentSnapshot.startedMonotonicMs !== null && optionsReference.current.durationSeconds) {
      const deadline = buildSessionDeadline(
        currentSnapshot.startedMonotonicMs,
        optionsReference.current.durationSeconds,
      ) + pausedDurationReference.current;

      if (!isInputEventEligible(timestamp.monotonicMs, deadline)) {
        completeSession("time-expired", false, currentSnapshot, sample, deadline);
        return;
      }
    }

    compositionTrackerReference.current = {
      active: true,
      latestValue: currentSnapshot.inputValue,
      startedMonotonicMs: timestamp.monotonicMs,
    };
    setIsComposing(true);
    setStatusMessage(
      "Composition input is active. The committed event must still arrive before the deadline.",
    );
  }, [completeSession]);

  const handleCompositionUpdate = useCallback(
    (incomingValue: string) => {
      if (pauseStartedMonotonicMsReference.current !== null) return;

      const promptGraphemeCount = countTextGraphemes(optionsReference.current.promptText);
      const nextValue = clampTypingValueToPromptLength(
        incomingValue.replace(/\r/g, ""),
        promptGraphemeCount,
      );
      const currentSnapshot = snapshotReference.current;

      compositionTrackerReference.current.latestValue = nextValue;
      publishSnapshot({ ...currentSnapshot, inputValue: nextValue });
    },
    [publishSnapshot],
  );

  const handleCompositionEnd = useCallback(
    (incomingValue: string, inputMetadata?: TypingInputMetadata) => {
      if (pauseStartedMonotonicMsReference.current !== null) return;

      const promptGraphemeCount = countTextGraphemes(optionsReference.current.promptText);
      const nextValue = clampTypingValueToPromptLength(
        incomingValue.replace(/\r/g, ""),
        promptGraphemeCount,
      );
      const currentSnapshot = snapshotReference.current;

      compositionTrackerReference.current.active = false;
      compositionTrackerReference.current.latestValue = nextValue;
      setIsComposing(false);
      publishSnapshot({ ...currentSnapshot, inputValue: nextValue });
      setStatusMessage(null);
      commitTextChange(nextValue, {
        ...inputMetadata,
        inputType: inputMetadata?.inputType ?? "insertFromComposition",
        isComposing: false,
        sourceHint: "composition",
      });
    },
    [commitTextChange, publishSnapshot],
  );

  const currentOpenPauseDurationMs =
    pauseStartedMonotonicMsReference.current === null
      ? 0
      : Math.max(
          0,
          renderSample.monotonicMs - pauseStartedMonotonicMsReference.current,
        );
  const previewPausedDurationMs =
    pausedDurationReference.current + currentOpenPauseDurationMs;
  const previewElapsedMs =
    snapshot.startedMonotonicMs === null
      ? 0
      : snapshot.activeElapsedMs ??
        Math.max(
          0,
          elapsedMonotonicMs(snapshot.startedMonotonicMs, renderSample.monotonicMs) -
            previewPausedDurationMs,
        );
  const previewEndedAt =
    snapshot.startedWallClockMs === null
      ? new Date(renderSample.wallClockMs).toISOString()
      : new Date(snapshot.startedWallClockMs + previewElapsedMs).toISOString();
  const previewScore = useMemo(
    () =>
      scoreTypingSession({
        promptText: options.promptText,
        typedText: snapshot.typedText,
        attemptLog: snapshot.attemptLog,
        correctedErrorCount: snapshot.correctedErrorCount,
        startedAt: snapshot.startedAt ?? previewEndedAt,
        endedAt: previewEndedAt,
        durationMs: previewElapsedMs,
        masterySpeedGoal: options.masterySpeedGoal,
      }),
    [
      options.masterySpeedGoal,
      options.promptText,
      previewElapsedMs,
      previewEndedAt,
      snapshot.attemptLog,
      snapshot.correctedErrorCount,
      snapshot.startedAt,
      snapshot.typedText,
    ],
  );
  const remainingMs = options.durationSeconds
    ? Math.max(0, options.durationSeconds * 1000 - previewElapsedMs)
    : null;
  const inputLanguageMismatch = useMemo(
    () =>
      isComposing
        ? null
        : detectInputLanguageMismatch({
            value: snapshot.inputValue,
            expectedScriptFamily: options.expectedScriptFamily,
          }),
    [snapshot.inputValue, isComposing, options.expectedScriptFamily],
  );
  const effectiveStatusMessage =
    persistenceStatus === "save-failed"
      ? `Your result is still in memory but could not be saved. Retry the save before leaving. ${persistenceError ?? ""}`.trim()
      : persistenceStatus === "saving" || persistenceStatus === "retrying"
        ? "Saving this result on this device…"
        : statusMessage;

  return {
    typedText: snapshot.typedText,
    inputValue: snapshot.inputValue,
    isComposing,
    attemptLog: snapshot.attemptLog,
    correctedErrorCount: snapshot.correctedErrorCount,
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt,
    isPaused,
    pausedDurationMs: Math.round(previewPausedDurationMs),
    sessionRevision,
    statusMessage: effectiveStatusMessage,
    inputLanguageMismatch,
    remainingMs,
    previewScore,
    persistenceStatus,
    persistenceError,
    hasUnsavedResult: pendingCompletionsReference.current.size > 0,
    handleTextChange,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    retrySave,
    resetSession,
  };
}
