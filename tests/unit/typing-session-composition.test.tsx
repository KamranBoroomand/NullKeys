import { StrictMode, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { SPACE_SKIP_MARKER } from "@/lib/input/typing-markers";
import { useTypingSession } from "@/lib/input/use-typing-session";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("typing session composition flow", () => {
  it("includes the normal final character and attempt in the completion payload", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abc",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("a", { eventTimestampMs: 10, inputType: "insertText" });
      result.current.handleTextChange("ab", { eventTimestampMs: 20, inputType: "insertText" });
      result.current.handleTextChange("abc", { eventTimestampMs: 30, inputType: "insertText" });
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      typedText: "abc",
      completed: true,
      completionReason: "prompt-completed",
    });
    expect(onComplete.mock.calls[0]?.[0].attemptLog).toHaveLength(3);
    expect(onComplete.mock.calls[0]?.[0].attemptLog[2]).toMatchObject({
      expectedCharacter: "c",
      enteredCharacter: "c",
      correct: true,
    });
  });

  it("persists an incorrect final character attempt", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abc",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("abx");
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0].typedText).toBe("abx");
    expect(onComplete.mock.calls[0]?.[0].attemptLog[2]).toMatchObject({
      expectedCharacter: "c",
      enteredCharacter: "x",
      correct: false,
    });
  });

  it("counts a corrected final-character mistake before completion", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abcd",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("abx");
      result.current.handleTextChange("ab");
      result.current.handleTextChange("abcd");
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0].typedText).toBe("abcd");
    expect(onComplete.mock.calls[0]?.[0].correctedErrorCount).toBe(1);
    expect(
      onComplete.mock.calls[0]?.[0].attemptLog.map(
        (attempt: { enteredCharacter: string }) => attempt.enteredCharacter,
      ),
    ).toEqual(["a", "b", "x", "c", "d"]);
  });

  it("records pasted completion as diagnostic-only attempts without fabricated timing", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "paste",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("paste", {
        eventTimestampMs: 10,
        inputType: "insertFromPaste",
        sourceHint: "paste",
      });
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0].attemptLog).toHaveLength(5);
    expect(onComplete.mock.calls[0]?.[0].typedText).toBe("paste");
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      completionReason: "invalid-input",
      rankingEligible: false,
      analyticsEligible: false,
      learnerModelEligible: false,
    });
    expect(onComplete.mock.calls[0]?.[0].integrity.invalidReasons).toContain("pasted-text");
    expect(
      onComplete.mock.calls[0]?.[0].attemptLog.every(
        (attempt: { elapsedMs: number; timingValid?: boolean }) =>
          attempt.elapsedMs === 0 && attempt.timingValid === false,
      ),
    ).toBe(true);
  });

  it("keeps IME draft text visible and commits attempts on composition end", () => {
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "ábc",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
      }),
    );

    act(() => {
      result.current.handleCompositionStart();
    });

    act(() => {
      result.current.handleTextChange("´");
      result.current.handleCompositionUpdate("á");
    });

    expect(result.current.typedText).toBe("");
    expect(result.current.inputValue).toBe("á");
    expect(result.current.statusMessage).toMatch(/composition input is active/i);

    act(() => {
      result.current.handleCompositionEnd("á");
    });

    expect(result.current.typedText).toBe("á");
    expect(result.current.attemptLog).toHaveLength(1);
    expect(result.current.attemptLog[0]?.expectedCharacter).toBe("á");

    act(() => {
      result.current.handleTextChange("áb");
    });

    expect(result.current.typedText).toBe("áb");
    expect(result.current.attemptLog).toHaveLength(2);
  });

  it("can complete from an IME composition end event", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "語",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleCompositionStart();
      result.current.handleCompositionUpdate("ご");
      result.current.handleCompositionEnd("語");
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      typedText: "語",
      completed: true,
      completionReason: "prompt-completed",
    });
    expect(onComplete.mock.calls[0]?.[0].attemptLog).toHaveLength(1);
  });

  it("handles rapid consecutive key events without dropping the final attempt", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abcdef",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      for (const value of ["a", "ab", "abc", "abcd", "abcde", "abcdef"]) {
        result.current.handleTextChange(value);
      }
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0].typedText).toBe("abcdef");
    expect(onComplete.mock.calls[0]?.[0].attemptLog).toHaveLength(6);
  });

  it("rejects a final input exactly at the exclusive deadline", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "ab",
        sessionKind: "benchmark",
        sessionFlavor: "plain",
        inputMode: "hardware",
        durationSeconds: 1,
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("a", { eventTimestampMs: 100, inputType: "insertText" });
      result.current.handleTextChange("ab", { eventTimestampMs: 1_100, inputType: "insertText" });
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      typedText: "a",
      completed: false,
      completionReason: "time-expired",
    });
  });

  it("accepts a final input immediately before the deadline", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "ab",
        sessionKind: "benchmark",
        sessionFlavor: "plain",
        inputMode: "hardware",
        durationSeconds: 1,
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("a", { eventTimestampMs: 100, inputType: "insertText" });
      result.current.handleTextChange("ab", { eventTimestampMs: 1_099, inputType: "insertText" });
    });

    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      typedText: "ab",
      completed: true,
      completionReason: "prompt-completed",
      rankingEligible: true,
    });
  });

  it("records timed-out sessions separately from completed prompts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T10:00:00.000Z"));
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abc",
        sessionKind: "benchmark",
        sessionFlavor: "plain",
        inputMode: "hardware",
        durationSeconds: 1,
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("a");
    });
    act(() => {
      vi.advanceTimersByTime(1_200);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      typedText: "a",
      completed: false,
      completionReason: "time-expired",
    });
  });

  it("invalidates and finalizes a benchmark when focus is lost", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abc",
        sessionKind: "benchmark",
        sessionFlavor: "plain",
        inputMode: "hardware",
        durationSeconds: 30,
        focusLossPolicy: "invalidate",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("a");
    });
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      typedText: "a",
      completed: false,
      completionReason: "interrupted",
      analyticsEligible: false,
      rankingEligible: false,
      learnerModelEligible: false,
      pausedDurationMs: 0,
    });
    expect(onComplete.mock.calls[0]?.[0].integrity.invalidReasons).toContain(
      "focus-interrupted",
    );
  });

  it("invalidates and finalizes a benchmark when the page is hidden", () => {
    let visibilityState: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibilityState,
    );
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abc",
        sessionKind: "benchmark",
        sessionFlavor: "plain",
        inputMode: "hardware",
        durationSeconds: 30,
        focusLossPolicy: "invalidate",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("a");
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      typedText: "a",
      completionReason: "interrupted",
      rankingEligible: false,
    });
    expect(onComplete.mock.calls[0]?.[0].integrity.invalidReasons).toContain(
      "visibility-interrupted",
    );
  });

  it("pauses adaptive timing while preserving the prompt and typed text", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T10:00:00.000Z"));
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "ab",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        focusLossPolicy: "pause",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("a");
      window.dispatchEvent(new Event("blur"));
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.typedText).toBe("a");
    expect(result.current.inputValue).toBe("a");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5_000);
      result.current.handleTextChange("ab");
    });

    expect(result.current.typedText).toBe("a");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event("focus"));
      result.current.handleTextChange("ab");
    });

    expect(result.current.isPaused).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      typedText: "ab",
      completionReason: "prompt-completed",
      learnerModelEligible: true,
      pausedDurationMs: 5_000,
    });
    expect(onComplete.mock.calls[0]?.[0].activeElapsedMs).toBeLessThan(1_000);
  });

  it("pauses and resumes adaptive practice across page visibility changes", () => {
    let visibilityState: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibilityState,
    );
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abc",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        focusLossPolicy: "pause",
      }),
    );

    act(() => {
      result.current.handleTextChange("a");
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.typedText).toBe("a");

    act(() => {
      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.isPaused).toBe(false);
    expect(result.current.typedText).toBe("a");
    expect(result.current.statusMessage).toMatch(/paused time is excluded/i);
  });

  it("does not finalize twice after repeated completion input", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "abc",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("abc");
      result.current.handleTextChange("abc");
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("can restart immediately after completion and save the next session once", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "ab",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("ab");
    });
    act(() => {
      result.current.resetSession();
      result.current.handleTextChange("ab");
    });

    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete.mock.calls.map((call) => call[0].typedText)).toEqual(["ab", "ab"]);
  });

  it("does not duplicate completion under React Strict Mode", () => {
    const onComplete = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result } = renderHook(
      () =>
        useTypingSession({
          promptText: "abc",
          sessionKind: "adaptive",
          sessionFlavor: "plain",
          inputMode: "hardware",
          onComplete,
        }),
      { wrapper },
    );

    act(() => {
      result.current.handleTextChange("abc");
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("treats multi-code-point graphemes as one prompt position", () => {
    const onComplete = vi.fn();
    const promptText = "👩🏽‍💻a";
    const { result } = renderHook(() =>
      useTypingSession({
        promptText,
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => {
      result.current.handleTextChange("👩🏽‍💻");
    });

    expect(result.current.attemptLog).toHaveLength(1);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      result.current.handleTextChange(promptText);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0].attemptLog).toHaveLength(2);
  });

  it("can skip the rest of a word when space-skips-words is enabled", () => {
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "slow glow",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        spaceSkipsWords: true,
      }),
    );

    act(() => {
      result.current.handleTextChange("sl");
    });

    act(() => {
      result.current.handleTextChange("sl ");
    });

    expect(result.current.typedText).toBe(`sl${SPACE_SKIP_MARKER.repeat(2)} `);
    expect(result.current.attemptLog).toHaveLength(5);
    expect(result.current.attemptLog[2]?.correct).toBe(false);
    expect(result.current.attemptLog[3]?.correct).toBe(false);
    expect(result.current.attemptLog[4]?.expectedCharacter).toBe(" ");
  });

  it("raises and clears script-mismatch warnings as the recent input sample changes", () => {
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "سلام دنیا",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        expectedScriptFamily: "arabic",
      }),
    );

    act(() => {
      result.current.handleTextChange("test");
    });

    expect(result.current.inputLanguageMismatch?.observedScriptFamily).toBe("latin");

    act(() => {
      result.current.handleTextChange("testسلامدن");
    });

    expect(result.current.inputLanguageMismatch).toBeNull();
  });
});
