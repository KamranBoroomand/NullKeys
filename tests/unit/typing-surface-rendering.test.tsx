import { render, screen, within } from "@testing-library/react";
import { TypingSurface } from "@/components/practice/typing-surface";

const baseProps = {
  promptText: "ab cd",
  typedText: "",
  inputValue: "",
  onTypedTextChange: () => undefined,
  onCompositionStart: () => undefined,
  onCompositionUpdate: () => undefined,
  onCompositionEnd: () => undefined,
  sessionMetrics: {
    grossWpm: 0,
    netWpm: 0,
    accuracy: 100,
    correctedErrorCount: 0,
    uncorrectedErrorCount: 0,
    durationMs: 0,
  },
  remainingMs: null,
  languageId: "english",
  localeTag: "en",
  scriptFamily: "latin" as const,
  direction: "ltr" as const,
  statusMessage: null,
  onRestart: () => undefined,
  onSkip: () => undefined,
  inputMode: "hardware" as const,
  imeProfile: "direct" as const,
  showStatTiles: false,
  showSessionControls: false,
  showProgressBar: false,
  showReadyMessage: false,
};

describe("typing surface whitespace rendering", () => {
  it("renders bullet whitespace markers", () => {
    render(<TypingSurface {...baseProps} whitespaceStyle="bullet" />);

    const promptBoard = screen.getByTestId("prompt-board");
    expect(within(promptBoard).getByText("·")).toBeInTheDocument();
  });

  it("renders bar whitespace markers", () => {
    render(<TypingSurface {...baseProps} whitespaceStyle="bar" />);

    const promptBoard = screen.getByTestId("prompt-board");
    expect(within(promptBoard).getByText("|")).toBeInTheDocument();
  });

  it("softens bar whitespace markers for RTL prompts", () => {
    render(<TypingSurface {...baseProps} direction="rtl" whitespaceStyle="bar" />);

    const rtlBarMarker = within(screen.getByTestId("prompt-board")).getByText("|");
    expect(rtlBarMarker).toHaveClass("text-textMuted/60");
  });

  it("can hide whitespace markers entirely", () => {
    render(<TypingSurface {...baseProps} whitespaceStyle="none" />);

    const promptBoard = screen.getByTestId("prompt-board");
    expect(within(promptBoard).queryByText("·")).not.toBeInTheDocument();
    expect(within(promptBoard).queryByText("|")).not.toBeInTheDocument();
  });

  it("uses shaping-safe joined-script rendering for Persian prompts", () => {
    render(
      <TypingSurface
        {...baseProps}
        promptText="سلام دنیا"
        languageId="persian"
        localeTag="fa"
        scriptFamily="arabic"
        direction="rtl"
        whitespaceStyle="bar"
      />,
    );

    const promptBoard = screen.getByTestId("prompt-board");
    const joinedWords = Array.from(
      promptBoard.querySelectorAll('[data-joined-script-base="true"]'),
    ).map((element) => element.textContent);

    expect(promptBoard).toHaveAttribute("data-prompt-render-mode", "joined-script");
    expect(promptBoard).toHaveAttribute("lang", "fa");
    expect(promptBoard).toHaveAttribute("dir", "rtl");
    expect(promptBoard).toHaveTextContent("سلام");
    expect(promptBoard).toHaveTextContent("دنیا");
    expect(joinedWords).toEqual(expect.arrayContaining(["سلام", "دنیا"]));
  });

  it("keeps the intact Persian word visible while current-position highlighting is active", () => {
    render(
      <TypingSurface
        {...baseProps}
        promptText="سلام"
        languageId="persian"
        localeTag="fa"
        scriptFamily="arabic"
        direction="rtl"
        whitespaceStyle="bar"
      />,
    );

    const promptBoard = screen.getByTestId("prompt-board");
    const baseWord = promptBoard.querySelector('[data-joined-script-base="true"]');
    const currentSegment = promptBoard.querySelector('[data-prompt-state="current"]');

    expect(baseWord).toHaveTextContent("سلام");
    expect(currentSegment).toHaveTextContent("س");
  });

  it("marks only the mismatched Persian character instead of the full joined word", () => {
    render(
      <TypingSurface
        {...baseProps}
        promptText="سلام"
        typedText="سx"
        inputValue="سx"
        languageId="persian"
        localeTag="fa"
        scriptFamily="arabic"
        direction="rtl"
        whitespaceStyle="bar"
      />,
    );

    const promptBoard = screen.getByTestId("prompt-board");
    const baseWord = promptBoard.querySelector('[data-joined-script-base="true"]');
    const dangerSegments = promptBoard.querySelectorAll('[data-prompt-state="danger"]');
    const currentSegment = promptBoard.querySelector('[data-prompt-state="current"]');

    expect(baseWord).toHaveTextContent("سلام");
    expect(dangerSegments).toHaveLength(1);
    expect(dangerSegments[0]).toHaveTextContent("ل");
    expect(dangerSegments[0]).toHaveAttribute("data-prompt-start", "1");
    expect(dangerSegments[0]).toHaveAttribute("data-prompt-end", "2");
    expect(currentSegment).toHaveTextContent("ا");
  });

  it("keeps Persian whitespace markers isolated between intact joined words", () => {
    render(
      <TypingSurface
        {...baseProps}
        promptText="سلام دنیا"
        languageId="persian"
        localeTag="fa"
        scriptFamily="arabic"
        direction="rtl"
        whitespaceStyle="bar"
      />,
    );

    const promptBoard = screen.getByTestId("prompt-board");
    const whitespaceMarker = promptBoard.querySelector('[data-joined-script-space="true"]');

    expect(whitespaceMarker).toHaveClass("mx-[0.08em]");
    expect(promptBoard).toHaveTextContent("سلام");
    expect(promptBoard).toHaveTextContent("دنیا");
    expect(within(promptBoard).getByText("|")).toBeInTheDocument();
  });

  it("keeps Japanese prompts on script-aware wrap settings instead of latin defaults", () => {
    render(
      <TypingSurface
        {...baseProps}
        promptText="ていねいな ・ れんしゅう ・ を ・ つづける"
        languageId="japanese"
        localeTag="ja"
        scriptFamily="hiragana"
        direction="ltr"
        whitespaceStyle="none"
      />,
    );

    const promptBoard = screen.getByTestId("prompt-board");
    expect(promptBoard).toHaveAttribute("data-script-family", "hiragana");
    expect(promptBoard).toHaveAttribute("data-prompt-render-mode", "character");
    expect(promptBoard.className).toContain("[line-break:strict]");
    expect(promptBoard.className).toContain("[word-break:keep-all]");
  });

  it("renders a calm input-language warning near the practice area", () => {
    render(
      <TypingSurface
        {...baseProps}
        languageId="persian"
        localeTag="fa"
        scriptFamily="arabic"
        direction="rtl"
        warningMessage="You appear to be typing English/Latin characters while practicing Persian. Switch your keyboard/input language to Persian."
      />,
    );

    const warning = screen.getByTestId("input-language-warning");
    expect(warning).toHaveTextContent(/typing English\/Latin characters while practicing Persian/i);
  });
});
