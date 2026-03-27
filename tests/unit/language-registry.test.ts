import {
  getLanguageDefinition,
  getPracticalLanguageCoverage,
  isRightToLeftLanguage,
} from "@/features/language-support/language-registry";

describe("language direction support", () => {
  const requiredLanguageIds = [
    "arabic",
    "belarusian",
    "czech",
    "danish",
    "german",
    "greek",
    "english",
    "spanish",
    "estonian",
    "persian",
    "finnish",
    "french",
    "hebrew",
    "croatian",
    "hungarian",
    "italian",
    "japanese",
    "lithuanian",
    "latvian",
    "norwegian-bokmal",
    "dutch",
    "polish",
    "portuguese",
    "romanian",
    "russian",
    "slovenian",
    "swedish",
    "thai",
    "turkish",
    "ukrainian",
  ] as const;

  it("marks Persian as right to left", () => {
    expect(isRightToLeftLanguage("persian")).toBe(true);
    expect(getLanguageDefinition("persian").direction).toBe("rtl");
  });

  it("marks Russian as left to right", () => {
    expect(isRightToLeftLanguage("russian")).toBe(false);
    expect(getLanguageDefinition("russian").direction).toBe("ltr");
  });

  it("covers a broad practical language set with scalable word banks", () => {
    expect(getPracticalLanguageCoverage()).toBeGreaterThanOrEqual(requiredLanguageIds.length);
    for (const requiredLanguageId of requiredLanguageIds) {
      expect(getLanguageDefinition(requiredLanguageId).id).toBe(requiredLanguageId);
    }
    expect(getLanguageDefinition("english").wordBank.length).toBeGreaterThanOrEqual(120);
    expect(getLanguageDefinition("persian").wordBank.length).toBeGreaterThanOrEqual(100);
    expect(getLanguageDefinition("hindi").wordBank.length).toBeGreaterThanOrEqual(100);
    expect(getLanguageDefinition("english").realWordBank.length).toBeGreaterThanOrEqual(60);
    expect(getLanguageDefinition("english").foundationalWords.length).toBeGreaterThanOrEqual(24);
    expect(getLanguageDefinition("english").developingWords.length).toBeGreaterThanOrEqual(20);
    expect(getLanguageDefinition("english").advancedWords.length).toBeGreaterThanOrEqual(16);
    expect(getLanguageDefinition("spanish").realWordBank.length).toBeGreaterThanOrEqual(120);
    expect(getLanguageDefinition("french").realWordBank.length).toBeGreaterThanOrEqual(120);
    expect(getLanguageDefinition("german").realWordBank.length).toBeGreaterThanOrEqual(110);
    expect(getLanguageDefinition("indonesian").realWordBank.length).toBeGreaterThanOrEqual(90);
    expect(getLanguageDefinition("belarusian").realWordBank.length).toBeGreaterThanOrEqual(90);
    expect(getLanguageDefinition("hindi").realWordBank.length).toBeGreaterThanOrEqual(90);
    expect(getLanguageDefinition("persian").realWordBank.length).toBeGreaterThanOrEqual(100);
    expect(getLanguageDefinition("persian").foundationalWords.length).toBeGreaterThanOrEqual(40);
    expect(getLanguageDefinition("persian").developingWords.length).toBeGreaterThanOrEqual(24);
    expect(getLanguageDefinition("persian").advancedWords.length).toBeGreaterThanOrEqual(20);
    expect(getLanguageDefinition("english").phraseFragments.length).toBeGreaterThan(0);
    expect(getLanguageDefinition("english").benchmarkSentences.length).toBeGreaterThan(0);
    expect(getLanguageDefinition("persian").phraseFragments.length).toBeGreaterThanOrEqual(950);
    expect(getLanguageDefinition("persian").benchmarkSentences.length).toBeGreaterThanOrEqual(500);
    expect(getLanguageDefinition("russian").phraseFragments.length).toBeGreaterThanOrEqual(120);
    expect(getLanguageDefinition("russian").benchmarkSentences.length).toBeGreaterThanOrEqual(80);
  });

  it("keeps early-stage English compatible real-word coverage above tiny-loop territory", () => {
    const english = getLanguageDefinition("english");
    const earlyCharacters = new Set(Array.from("asetrlin"));
    const compatibleFoundationalWords = english.foundationalWords.filter((word) =>
      Array.from(word).every((character) => earlyCharacters.has(character)),
    );

    expect(compatibleFoundationalWords.length).toBeGreaterThanOrEqual(12);
  });

  it("exposes explicit script and IME metadata for complex scripts", () => {
    expect(getLanguageDefinition("arabic").scriptFamily).toBe("arabic");
    expect(getLanguageDefinition("hebrew").direction).toBe("rtl");
    expect(getLanguageDefinition("japanese").imeProfile).toBe("ime-required");
    expect(getLanguageDefinition("japanese").usesWordSpacing).toBe(false);
    expect(getLanguageDefinition("thai").scriptFamily).toBe("thai");
    expect(getLanguageDefinition("persian").nativeDigits.length).toBeGreaterThan(0);
  });
});
