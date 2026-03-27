import { act, renderHook } from "@testing-library/react";
import { SPACE_SKIP_MARKER } from "@/lib/input/typing-markers";
import { useTypingSession } from "@/lib/input/use-typing-session";

describe("typing session composition flow", () => {
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
