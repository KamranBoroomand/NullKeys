import { act, renderHook, waitFor } from "@testing-library/react";
import { useTypingSession } from "@/lib/input/use-typing-session";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("typing-session persistence lifecycle", () => {
  it("awaits asynchronous completion persistence before reporting saved", async () => {
    const save = deferred<void>();
    const onComplete = vi.fn(() => save.promise);
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "save",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => result.current.handleTextChange("save"));

    expect(result.current.persistenceStatus).toBe("saving");
    expect(result.current.hasUnsavedResult).toBe(true);
    await act(async () => save.resolve());
    await waitFor(() => expect(result.current.persistenceStatus).toBe("saved"));
    expect(result.current.hasUnsavedResult).toBe(false);
  });

  it("retains a failed payload and retries idempotently with the same session ID", async () => {
    const retrySave = deferred<void>();
    const payloadIds: string[] = [];
    const onComplete = vi.fn((payload: { sessionId: string }) => {
      payloadIds.push(payload.sessionId);
      return payloadIds.length === 1
        ? Promise.reject(new DOMException("Storage quota reached", "QuotaExceededError"))
        : retrySave.promise;
    });
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "retry",
        sessionKind: "benchmark",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );

    act(() => result.current.handleTextChange("retry"));
    await waitFor(() => expect(result.current.persistenceStatus).toBe("save-failed"));
    expect(result.current.statusMessage).toMatch(/still in memory/i);

    act(() => {
      result.current.retrySave();
      result.current.retrySave();
    });

    expect(result.current.persistenceStatus).toBe("retrying");
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(new Set(payloadIds).size).toBe(1);
    await act(async () => retrySave.resolve());
    await waitFor(() => expect(result.current.persistenceStatus).toBe("saved"));
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it("warns before unload while a failed result remains unsaved", async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error("IndexedDB unavailable"));
    const { result } = renderHook(() =>
      useTypingSession({
        promptText: "hold",
        sessionKind: "adaptive",
        sessionFlavor: "plain",
        inputMode: "hardware",
        onComplete,
      }),
    );
    act(() => result.current.handleTextChange("hold"));
    await waitFor(() => expect(result.current.persistenceStatus).toBe("save-failed"));

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
