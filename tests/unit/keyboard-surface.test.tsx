import { render, screen } from "@testing-library/react";
import { KeyboardSurface } from "@/components/keyboard/keyboard-surface";

function readViewBoxSize(element: Element) {
  const viewBox = element.getAttribute("viewBox");

  if (!viewBox) {
    throw new Error("Expected keyboard svg to expose a viewBox.");
  }

  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  return { width, height };
}

describe("keyboard surface geometry", () => {
  it("changes visible geometry when switching keyboard families", () => {
    const { rerender } = render(
      <KeyboardSurface
        layoutId="ansi-us-compact"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
      />,
    );

    const compactKeyboard = screen.getByRole("img", { name: /ansi us compact keyboard/i });
    const compactSize = readViewBoxSize(compactKeyboard);

    rerender(
      <KeyboardSurface
        layoutId="apple-us-compact"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
      />,
    );

    const appleKeyboard = screen.getByRole("img", { name: /apple us compact keyboard/i });
    const appleSize = readViewBoxSize(appleKeyboard);

    rerender(
      <KeyboardSurface
        layoutId="touch-android-standard"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
      />,
    );

    const touchKeyboard = screen.getByRole("img", { name: /touch android standard keyboard/i });
    const touchSize = readViewBoxSize(touchKeyboard);

    expect(appleSize.width).not.toBe(compactSize.width);
    expect(touchSize.height).not.toBe(compactSize.height);
  });

  it("expands the board when a full-size layout shows the numpad", () => {
    const { rerender } = render(
      <KeyboardSurface
        layoutId="ansi-us-full"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
        includeNumpad={false}
      />,
    );

    const collapsedKeyboard = screen.getByRole("img", { name: /ansi us full keyboard/i });
    const collapsedSize = readViewBoxSize(collapsedKeyboard);

    rerender(
      <KeyboardSurface
        layoutId="ansi-us-full"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
        includeNumpad
      />,
    );

    const expandedKeyboard = screen.getByRole("img", { name: /ansi us full keyboard/i });
    const expandedSize = readViewBoxSize(expandedKeyboard);

    expect(expandedSize.width).toBeGreaterThan(collapsedSize.width);
  });

  it("shows family-specific modifier legends for Apple, Windows, and Linux boards", () => {
    const { rerender } = render(
      <KeyboardSurface
        layoutId="apple-us-compact"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
      />,
    );

    expect(screen.getAllByText("⌘").length).toBeGreaterThan(0);

    rerender(
      <KeyboardSurface
        layoutId="ansi-us-compact"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
      />,
    );

    expect(screen.getAllByText("Win").length).toBeGreaterThan(0);

    rerender(
      <KeyboardSurface
        layoutId="linux-terminal-tkl"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
      />,
    );

    expect(screen.getAllByText("Super").length).toBeGreaterThan(0);
  });

  it("shows language-aware legends for Russian and Persian overlays", () => {
    const { rerender } = render(
      <KeyboardSurface
        layoutId="ansi-us-compact"
        languageId="russian"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
      />,
    );

    expect(screen.getAllByText("Й").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ф").length).toBeGreaterThan(0);

    rerender(
      <KeyboardSurface
        layoutId="ansi-us-compact"
        languageId="persian"
        highlightedCharacters={[]}
        depressedKeyCodes={[]}
      />,
    );

    expect(screen.getAllByText("ض").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ش").length).toBeGreaterThan(0);
    expect(screen.getAllByText("۱").length).toBeGreaterThan(0);
  });
});
