export type ScriptFamily =
  | "latin"
  | "cyrillic"
  | "arabic"
  | "hebrew"
  | "greek"
  | "devanagari"
  | "hiragana"
  | "thai";

export interface LanguageTextMetadata {
  scriptFamily: ScriptFamily;
  numberingSystem: "latin" | "native" | "mixed";
  nativeDigits?: readonly string[];
  imeProfile: "direct" | "ime-light" | "ime-required";
  usesWordSpacing: boolean;
  wordSeparator: string;
}

const arabicIndicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"] as const;
const easternArabicIndicDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;
const devanagariDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"] as const;
const thaiDigits = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"] as const;
const japaneseFullwidthDigits = ["０", "１", "２", "３", "４", "５", "６", "７", "８", "９"] as const;

export const languageLocaleTags = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  portuguese: "pt",
  italian: "it",
  dutch: "nl",
  estonian: "et",
  swedish: "sv",
  norwegian: "no",
  "norwegian-bokmal": "nb",
  danish: "da",
  finnish: "fi",
  polish: "pl",
  czech: "cs",
  croatian: "hr",
  romanian: "ro",
  hungarian: "hu",
  slovenian: "sl",
  turkish: "tr",
  indonesian: "id",
  ukrainian: "uk",
  belarusian: "be",
  russian: "ru",
  greek: "el",
  hebrew: "he",
  arabic: "ar",
  persian: "fa",
  hindi: "hi",
  japanese: "ja",
  thai: "th",
  lithuanian: "lt",
  latvian: "lv",
} as const;

const spacedLatin = {
  scriptFamily: "latin",
  numberingSystem: "latin",
  imeProfile: "direct",
  usesWordSpacing: true,
  wordSeparator: " ",
} as const;

const spacedCyrillic = {
  scriptFamily: "cyrillic",
  numberingSystem: "latin",
  imeProfile: "direct",
  usesWordSpacing: true,
  wordSeparator: " ",
} as const;

export const languageTextMetadata = {
  english: spacedLatin,
  spanish: spacedLatin,
  french: spacedLatin,
  german: spacedLatin,
  portuguese: spacedLatin,
  italian: spacedLatin,
  dutch: spacedLatin,
  estonian: spacedLatin,
  swedish: spacedLatin,
  norwegian: spacedLatin,
  "norwegian-bokmal": spacedLatin,
  danish: spacedLatin,
  finnish: spacedLatin,
  polish: spacedLatin,
  czech: spacedLatin,
  croatian: spacedLatin,
  romanian: spacedLatin,
  hungarian: spacedLatin,
  slovenian: spacedLatin,
  turkish: spacedLatin,
  indonesian: spacedLatin,
  ukrainian: spacedCyrillic,
  belarusian: spacedCyrillic,
  russian: spacedCyrillic,
  greek: {
    scriptFamily: "greek",
    numberingSystem: "latin",
    imeProfile: "direct",
    usesWordSpacing: true,
    wordSeparator: " ",
  },
  hebrew: {
    scriptFamily: "hebrew",
    numberingSystem: "latin",
    imeProfile: "direct",
    usesWordSpacing: true,
    wordSeparator: " ",
  },
  arabic: {
    scriptFamily: "arabic",
    numberingSystem: "mixed",
    nativeDigits: arabicIndicDigits,
    imeProfile: "direct",
    usesWordSpacing: true,
    wordSeparator: " ",
  },
  persian: {
    scriptFamily: "arabic",
    numberingSystem: "mixed",
    nativeDigits: easternArabicIndicDigits,
    imeProfile: "direct",
    usesWordSpacing: true,
    wordSeparator: " ",
  },
  hindi: {
    scriptFamily: "devanagari",
    numberingSystem: "mixed",
    nativeDigits: devanagariDigits,
    imeProfile: "ime-light",
    usesWordSpacing: true,
    wordSeparator: " ",
  },
  japanese: {
    scriptFamily: "hiragana",
    numberingSystem: "mixed",
    nativeDigits: japaneseFullwidthDigits,
    imeProfile: "ime-required",
    usesWordSpacing: false,
    wordSeparator: " ・ ",
  },
  thai: {
    scriptFamily: "thai",
    numberingSystem: "mixed",
    nativeDigits: thaiDigits,
    imeProfile: "ime-light",
    usesWordSpacing: false,
    wordSeparator: " ",
  },
  lithuanian: spacedLatin,
  latvian: spacedLatin,
} as const;
