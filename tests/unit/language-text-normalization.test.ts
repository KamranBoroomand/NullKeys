import {
  buildCharacterSignatureForLanguage,
  countTextGraphemes,
  getCodeUnitOffsetForGraphemeCount,
  normalizeFragmentForLanguage,
  normalizeInlineTextForLanguage,
  removeTrailingGrapheme,
  segmentTextIntoGraphemes,
  splitTextIntoGraphemes,
  normalizeTokenForLanguage,
  tokenizeTextForLanguage,
  trimTextToCodeUnitLengthAtGraphemeBoundary,
  trimTextToGraphemeCount,
} from "@/lib/text/language-text-normalization";

describe("language text normalization", () => {
  it("normalizes Persian Arabic yeh and kaf forms into Persian forms", () => {
    expect(normalizeTokenForLanguage("  كليد  ", "persian")).toBe("کلید");
    expect(normalizeTokenForLanguage("مى", "persian")).toBe("می");
  });

  it("keeps Persian ZWNJ words intact while removing broken spacing around them", () => {
    expect(normalizeFragmentForLanguage("می ‌ رود", "persian")).toBe("می‌رود");
    expect(normalizeFragmentForLanguage("خانه ‌ ها", "persian")).toBe("خانه‌ها");
    expect(tokenizeTextForLanguage("نیم‌فاصله متن را طبیعی‌تر می‌کند.", "persian")).toEqual(
      expect.arrayContaining(["نیم‌فاصله", "طبیعی‌تر", "می‌کند"]),
    );
  });

  it("normalizes Persian punctuation spacing and Arabic-Indic digits without forcing Latin digits away", () => {
    expect(
      normalizeInlineTextForLanguage("  كلاس يک ،  عدد ١٢ و 2 ؟  ", "persian"),
    ).toBe("کلاس یک، عدد ۱۲ و 2؟");
  });

  it("builds Persian comparison signatures from normalized codepoints", () => {
    const signature = buildCharacterSignatureForLanguage("كليد يک", "persian");

    expect(signature).toContain("ک");
    expect(signature).toContain("ی");
    expect(signature).not.toContain("ك");
    expect(signature).not.toContain("ي");
  });

  it("segments grapheme clusters without splitting combining marks", () => {
    expect(segmentTextIntoGraphemes("a\u0301b")).toEqual([
      { text: "a\u0301", start: 0, end: 2 },
      { text: "b", start: 2, end: 3 },
    ]);
  });

  it("trims and removes text at grapheme boundaries for input-safe editing", () => {
    expect(trimTextToCodeUnitLengthAtGraphemeBoundary("a\u0301b", 1)).toBe("");
    expect(trimTextToCodeUnitLengthAtGraphemeBoundary("a\u0301b", 2)).toBe("a\u0301");
    expect(trimTextToGraphemeCount("👩🏽‍💻ab", 1)).toBe("👩🏽‍💻");
    expect(removeTrailingGrapheme("a\u0301b")).toBe("a\u0301");
  });

  it("segments representative Unicode and direction-sensitive typing cases", () => {
    const cases = [
      { label: "Persian letters", value: "سلام", count: 4 },
      { label: "Arabic combining mark", value: "سُ", count: 1 },
      { label: "Persian zero-width non-joiner", value: "می‌روم", count: 5 },
      { label: "composed Latin", value: "é", count: 1 },
      { label: "decomposed Latin", value: "e\u0301", count: 1 },
      { label: "emoji variation selector", value: "♥️", count: 1 },
      { label: "emoji skin tone", value: "👍🏽", count: 1 },
      { label: "emoji joined sequence", value: "👩🏽‍💻", count: 1 },
      { label: "Indic combining sequence", value: "क्षि", count: 1 },
      { label: "right-to-left text", value: "שלום", count: 4 },
      { label: "bidirectional text", value: "نسخه 2.0!", count: 9 },
    ];

    for (const testCase of cases) {
      expect(countTextGraphemes(testCase.value), testCase.label).toBe(testCase.count);
    }
  });

  it("translates completed grapheme counts to code-unit offsets for replay rendering", () => {
    const value = "👩🏽‍💻a";

    expect(splitTextIntoGraphemes(value)).toEqual(["👩🏽‍💻", "a"]);
    expect(getCodeUnitOffsetForGraphemeCount(value, 1)).toBe("👩🏽‍💻".length);
    expect(getCodeUnitOffsetForGraphemeCount(value, 2)).toBe(value.length);
  });
});
