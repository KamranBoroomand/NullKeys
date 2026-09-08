import { classifyTypingInput } from "@/lib/input/input-event-classifier";

describe("typing input-event classification", () => {
  it.each([
    ["insertFromPaste", "paste", "pasted-text"],
    ["insertFromDrop", "drop", "dropped-text"],
    ["insertReplacementText", "replacement", "replacement-input"],
    ["historyUndo", "history", "undo-redo"],
  ] as const)("classifies %s as %s", (inputType, source, invalidReason) => {
    expect(classifyTypingInput({ inputType }, "ab")).toMatchObject({
      source,
      timingAuthoritative: false,
      invalidReasons: expect.arrayContaining([invalidReason]),
    });
  });

  it("allows a single typed grapheme with authoritative timing", () => {
    expect(classifyTypingInput({ inputType: "insertText" }, "👩🏽‍💻")).toEqual({
      inputType: "insertText",
      source: "typed-text",
      timingAuthoritative: true,
      invalidReasons: [],
    });
  });

  it("invalidates suspicious multi-grapheme insertion outside composition", () => {
    expect(classifyTypingInput({ inputType: "insertText" }, "ab")).toMatchObject({
      source: "typed-text",
      timingAuthoritative: false,
      invalidReasons: ["suspicious-multi-grapheme-input"],
    });
  });

  it("keeps multi-grapheme composition valid while marking its per-character timing non-authoritative", () => {
    expect(classifyTypingInput({ inputType: "insertFromComposition" }, "かな")).toEqual({
      inputType: "insertFromComposition",
      source: "composition",
      timingAuthoritative: false,
      invalidReasons: [],
    });
  });
});
