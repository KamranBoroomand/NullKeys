import {
  buildInputLanguageMismatchWarning,
  detectInputLanguageMismatch,
} from "@/lib/input/input-language-mismatch";

describe("input-language mismatch detection", () => {
  it("detects obvious English/Latin input while practicing Persian", () => {
    expect(
      detectInputLanguageMismatch({
        value: "test",
        expectedScriptFamily: "arabic",
      }),
    ).toMatchObject({
      observedScriptFamily: "latin",
    });
  });

  it("detects obvious English/Latin input while practicing Russian", () => {
    expect(
      detectInputLanguageMismatch({
        value: "type",
        expectedScriptFamily: "cyrillic",
      }),
    ).toMatchObject({
      observedScriptFamily: "latin",
    });
  });

  it("detects Persian/Arabic-script input while practicing English", () => {
    expect(
      detectInputLanguageMismatch({
        value: "سلام",
        expectedScriptFamily: "latin",
      }),
    ).toMatchObject({
      observedScriptFamily: "arabic",
    });
  });

  it("stays quiet for mixed or low-confidence samples", () => {
    expect(
      detectInputLanguageMismatch({
        value: "aس",
        expectedScriptFamily: "arabic",
      }),
    ).toBeNull();
    expect(
      detectInputLanguageMismatch({
        value: "12-34",
        expectedScriptFamily: "latin",
      }),
    ).toBeNull();
  });

  it("ignores short trailing wrong-script blips", () => {
    expect(
      detectInputLanguageMismatch({
        value: "سلامte",
        expectedScriptFamily: "arabic",
      }),
    ).toBeNull();
    expect(
      detectInputLanguageMismatch({
        value: "словоab",
        expectedScriptFamily: "cyrillic",
      }),
    ).toBeNull();
  });

  it("warns once the recent trailing run clearly stays in the wrong script", () => {
    expect(
      detectInputLanguageMismatch({
        value: "سلامtest",
        expectedScriptFamily: "arabic",
      }),
    ).toMatchObject({
      observedScriptFamily: "latin",
    });
    expect(
      detectInputLanguageMismatch({
        value: "clearслово",
        expectedScriptFamily: "latin",
      }),
    ).toMatchObject({
      observedScriptFamily: "cyrillic",
    });
  });

  it("clears once the recent input sample returns to the expected script", () => {
    expect(
      detectInputLanguageMismatch({
        value: "testسلامدن",
        expectedScriptFamily: "arabic",
      }),
    ).toBeNull();
  });

  it("builds a calm warning message with the expected input hint", () => {
    expect(
      buildInputLanguageMismatchWarning({
        expectedLanguageLabel: "Persian",
        expectedInputLabel: "Persian",
        mismatch: {
          observedScriptFamily: "latin",
          sampleCount: 4,
          confidence: 1,
        },
      }),
    ).toMatch(/typing English\/Latin characters while practicing Persian/i);
  });
});
