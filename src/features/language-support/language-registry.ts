import {
  languageBlueprints,
  languageLexiconLayers,
  languageDigits,
  languageSyntheticWordBanks,
  languageWordBanks,
  practicalLanguageCoverage,
  type LanguageDirection,
} from "@/content/dictionaries/language-word-banks";
import {
  languageLocaleTags,
  languageTextMetadata,
  type ScriptFamily,
} from "@/content/languages/language-text-metadata";

export interface LanguageDefinition {
  id: keyof typeof languageBlueprints;
  label: string;
  nativeLabel: string;
  localeTag: string;
  direction: LanguageDirection;
  scriptFamily: ScriptFamily;
  numberingSystem: "latin" | "native" | "mixed";
  nativeDigits: string[];
  imeProfile: "direct" | "ime-light" | "ime-required";
  usesWordSpacing: boolean;
  wordSeparator: string;
  letters: string[];
  uppercaseLetters: string[];
  digits: string[];
  punctuation: string[];
  quotes: string[];
  pseudoSyllables: readonly string[];
  seedWords: readonly string[];
  stems: readonly string[];
  prefixes: readonly string[];
  suffixes: readonly string[];
  sampleSentence: string;
  wordBank: readonly string[];
  realWordBank: readonly string[];
  syntheticWordBank: readonly string[];
  foundationalWords: readonly string[];
  developingWords: readonly string[];
  advancedWords: readonly string[];
  phraseFragments: readonly string[];
  benchmarkSentences: readonly string[];
}

export const languageRegistry = {} as Record<keyof typeof languageBlueprints, LanguageDefinition>;

for (const languageId of Object.keys(languageBlueprints) as Array<keyof typeof languageBlueprints>) {
  const languageBlueprint = languageBlueprints[languageId];
  const layeredLexicon = languageLexiconLayers[languageId];
  const textMetadata = languageTextMetadata[languageId];

  languageRegistry[languageId] = {
    id: languageId,
    label: languageBlueprint.label,
    nativeLabel: languageBlueprint.nativeLabel,
    localeTag: languageLocaleTags[languageId],
    direction: languageBlueprint.direction,
    scriptFamily: textMetadata.scriptFamily,
    numberingSystem: textMetadata.numberingSystem,
    nativeDigits: [...("nativeDigits" in textMetadata ? textMetadata.nativeDigits ?? [] : [])],
    imeProfile: textMetadata.imeProfile,
    usesWordSpacing: textMetadata.usesWordSpacing,
    wordSeparator: textMetadata.wordSeparator,
    letters: Array.from(languageBlueprint.letters),
    uppercaseLetters: Array.from(
      "uppercaseLetters" in languageBlueprint ? languageBlueprint.uppercaseLetters ?? "" : "",
    ),
    digits: languageDigits[languageId],
    punctuation: [...languageBlueprint.punctuation],
    quotes: [...languageBlueprint.quotes],
    pseudoSyllables: languageBlueprint.pseudoSyllables,
    seedWords: languageBlueprint.seedWords,
    stems: languageBlueprint.stems,
    prefixes: languageBlueprint.prefixes,
    suffixes: languageBlueprint.suffixes,
    sampleSentence: languageBlueprint.sampleSentence,
    wordBank: languageWordBanks[languageId],
    realWordBank: layeredLexicon.realWordBank,
    syntheticWordBank: languageSyntheticWordBanks[languageId],
    foundationalWords: layeredLexicon.foundationalWords,
    developingWords: layeredLexicon.developingWords,
    advancedWords: layeredLexicon.advancedWords,
    phraseFragments: layeredLexicon.phraseFragments,
    benchmarkSentences: layeredLexicon.benchmarkSentences,
  };
}

export const languageOptions = Object.values(languageRegistry);

export function getLanguageDefinition(languageId: string) {
  return languageRegistry[languageId as keyof typeof languageRegistry] ?? languageRegistry.english;
}

export function buildLanguageCharacterPool(options: {
  languageId: string;
  punctuationEnabled: boolean;
  capitalizationEnabled: boolean;
  activeCharacterRange: "core" | "extended" | "full";
}) {
  const languageDefinition = getLanguageDefinition(options.languageId);
  const baseLetters =
    options.activeCharacterRange === "core"
      ? languageDefinition.letters.slice(0, Math.min(14, languageDefinition.letters.length))
      : languageDefinition.letters;
  const characters = [...baseLetters];

  if (options.capitalizationEnabled) {
    characters.push(...languageDefinition.uppercaseLetters);
  }

  if (options.activeCharacterRange !== "core") {
    characters.push(...languageDefinition.digits);
  }

  if (
    languageDefinition.nativeDigits.length > 0 &&
    (options.activeCharacterRange === "full" ||
      languageDefinition.numberingSystem === "mixed")
  ) {
    characters.push(...languageDefinition.nativeDigits);
  }

  if (options.punctuationEnabled || options.activeCharacterRange === "full") {
    characters.push(...languageDefinition.punctuation, ...languageDefinition.quotes);
  }

  return Array.from(new Set(characters));
}

export function isRightToLeftLanguage(languageId: string) {
  return getLanguageDefinition(languageId).direction === "rtl";
}

export function getPracticalLanguageCoverage() {
  return practicalLanguageCoverage;
}
