"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CompletionPersistenceStatus,
  TypingCompletionPayload,
} from "@/lib/input/typing-session-models";

interface PendingCompletion {
  payload: TypingCompletionPayload;
  status: "saving" | "save-failed" | "retrying";
  error: string | null;
}

function persistenceErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The browser rejected the save.";
}

export function useCompletionPersistence(
  onComplete: ((payload: TypingCompletionPayload) => void | Promise<void>) | undefined,
) {
  const [status, setStatus] = useState<CompletionPersistenceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const callbackReference = useRef(onComplete);
  const pendingCompletionsReference = useRef(new Map<string, PendingCompletion>());
  const latestFailedSessionIdReference = useRef<string | null>(null);

  useEffect(() => {
    callbackReference.current = onComplete;
  }, [onComplete]);

  const persistCompletion = useCallback(async (payload: TypingCompletionPayload, retry = false) => {
    const existingEntry = pendingCompletionsReference.current.get(payload.sessionId);
    if (existingEntry?.status === "saving" || existingEntry?.status === "retrying") return;

    const nextStatus = retry ? "retrying" : "saving";
    pendingCompletionsReference.current.set(payload.sessionId, {
      payload,
      status: nextStatus,
      error: null,
    });
    setStatus(nextStatus);
    setError(null);

    try {
      const completionResult = callbackReference.current?.(payload);
      if (completionResult instanceof Promise) {
        await completionResult;
      }
      pendingCompletionsReference.current.delete(payload.sessionId);
      if (latestFailedSessionIdReference.current === payload.sessionId) {
        latestFailedSessionIdReference.current = null;
      }
      setStatus("saved");
      setError(null);
    } catch (saveError) {
      const detail = persistenceErrorMessage(saveError);
      pendingCompletionsReference.current.set(payload.sessionId, {
        payload,
        status: "save-failed",
        error: detail,
      });
      latestFailedSessionIdReference.current = payload.sessionId;
      setStatus("save-failed");
      setError(detail);
    }
  }, []);

  const retrySave = useCallback((sessionId?: string) => {
    const targetSessionId = sessionId ?? latestFailedSessionIdReference.current;
    if (!targetSessionId) return;
    const pending = pendingCompletionsReference.current.get(targetSessionId);
    if (!pending || pending.status !== "save-failed") return;
    void persistCompletion(pending.payload, true);
  }, [persistCompletion]);
  const markFinalizing = useCallback(() => setStatus("finalizing"), []);

  return {
    status,
    error,
    pendingCompletionsReference,
    persistCompletion,
    retrySave,
    markFinalizing,
  };
}
