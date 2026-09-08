import {
  getLanguageDefinition,
  firstClassLanguageIds,
  isRightToLeftLanguage,
  languageOptions,
  normalizeFirstClassLanguageId,
} from "@/features/language-support/language-registry";

describe("language direction support", () => {
  it("marks Persian as right to left", () => {
    expect(isRightToLeftLanguage("persian")).toBe(true);
    expect(getLanguageDefinition("persian").direction).toBe("rtl");
  });

  it("marks Russian as left to right", () => {
    expect(isRightToLeftLanguage("russian")).toBe(false);
    expect(getLanguageDefinition("russian").direction).toBe("ltr");
  });

  it("exposes only the three first-class v1 languages", () => {
    expect(firstClassLanguageIds).toEqual(["english", "persian", "russian"]);
    expect(languageOptions.map((language) => language.id)).toEqual(firstClassLanguageIds);
    expect(languageOptions.every((language) => language.supportTier === "first-class")).toBe(true);
  });

  it("keeps internal language data out of preferences and guards prototype-chain keys", () => {
    expect(normalizeFirstClassLanguageId("thai")).toBe("english");
    expect(normalizeFirstClassLanguageId("__proto__")).toBe("english");
    expect(getLanguageDefinition("__proto__").id).toBe("english");
    expect(getLanguageDefinition("constructor").id).toBe("english");
  });

  it("keeps first-class word banks and benchmark material substantial", () => {
    expect(getLanguageDefinition("english").wordBank.length).toBeGreaterThanOrEqual(120);
    expect(getLanguageDefinition("persian").wordBank.length).toBeGreaterThanOrEqual(100);
    expect(getLanguageDefinition("english").realWordBank.length).toBeGreaterThanOrEqual(60);
    expect(getLanguageDefinition("english").foundationalWords.length).toBeGreaterThanOrEqual(24);
    expect(getLanguageDefinition("english").developingWords.length).toBeGreaterThanOrEqual(20);
    expect(getLanguageDefinition("english").advancedWords.length).toBeGreaterThanOrEqual(16);
    expect(getLanguageDefinition("persian").realWordBank.length).toBeGreaterThanOrEqual(100);
    expect(getLanguageDefinition("persian").foundationalWords.length).toBeGreaterThanOrEqual(40);
    expect(getLanguageDefinition("persian").developingWords.length).toBeGreaterThanOrEqual(24);
    expect(getLanguageDefinition("persian").advancedWords.length).toBeGreaterThanOrEqual(20);
    for (const languageId of ["english", "persian", "russian"] as const) {
      const language = getLanguageDefinition(languageId);

      expect(language.phraseFragments.length).toBeGreaterThanOrEqual(24);
      expect(language.benchmarkSentences.length).toBeGreaterThanOrEqual(18);
    }
  });

  it("keeps early-stage English compatible real-word coverage above tiny-loop territory", () => {
    const english = getLanguageDefinition("english");
    const earlyCharacters = new Set(Array.from("asetrlin"));
    const compatibleFoundationalWords = english.foundationalWords.filter((word) =>
      Array.from(word).every((character) => earlyCharacters.has(character)),
    );

    expect(compatibleFoundationalWords.length).toBeGreaterThanOrEqual(12);
  });

  it("exposes explicit script metadata for the first-class languages", () => {
    expect(getLanguageDefinition("english").scriptFamily).toBe("latin");
    expect(getLanguageDefinition("russian").scriptFamily).toBe("cyrillic");
    expect(getLanguageDefinition("persian").scriptFamily).toBe("arabic");
    expect(getLanguageDefinition("persian").nativeDigits.length).toBeGreaterThan(0);
  });
});
