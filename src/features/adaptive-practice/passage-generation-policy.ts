import {
  commandLineFragments,
  shellCommandTermTiers,
  shellCommandTierSequences,
  shellCommandSequences,
  shellCommandTerms,
  programmerIdentifiers,
  programmerTokenGroups,
} from "@/content/code-snippets/programmer-fragments";
import {
  benchmarkNumberPatterns,
  codeSymbolPatterns,
  commandFlagPatterns,
  dateAndTimePatterns,
  measurementPatterns,
  numberPatternTiers,
  numericClusters,
  numpadDrillFragments,
  punctuationClusters,
  symbolPatternTiers,
  symbolPatternSequences,
} from "@/content/drills/symbol-drills";
import { getDifficultyBandIndex } from "@/features/adaptive-practice/content-difficulty";
import {
  buildRecentContentHistory,
  tokenizePromptText,
  type RecentContentHistory,
} from "@/features/adaptive-practice/content-history";
import { getContentFamily } from "@/features/content-families/content-family-registry";
import type {
  CommonWordsContentPack,
  LoadedLanguageContentBundle,
  PackedTextEntry,
  PackedWordEntry,
} from "@/features/content-packs/content-pack-types";
import { getLanguageDefinition } from "@/features/language-support/language-registry";
import { getProgrammerDrillPreset } from "@/features/programmer-practice/programmer-presets";
import {
  INLINE_WORD_CHARACTERS as INLINE_WORD_CHARACTER_LIST,
  normalizeFragmentKeyForLanguage,
} from "@/lib/text/language-text-normalization";
import type {
  ContentDifficultyBand,
  LearnerConfusionPair,
  SessionContentMetrics,
  SessionFlavor,
  SessionRecord,
} from "@/lib/scoring/session-models";
import { containsAnyCharacter } from "@/lib/utils/character-helpers";
import { chooseRandomItem, sampleItems, shuffleItems } from "@/lib/utils/random";

const MAX_CONTEXT_RECENT_WORDS = 80;
const MAX_CONTEXT_RECENT_FAMILY_KEYS = 24;

export interface PassageGenerationOptions {
  languageId: string;
  targetWordCount: number;
  sessionFlavor: SessionFlavor;
  priorityCharacters: string[];
  newCharacters?: string[];
  shakyCharacters?: string[];
  forgottenCharacters?: string[];
  recoveryCharacters?: string[];
  reinforcementCharacters?: string[];
  bridgeCharacters?: string[];
  hesitationCharacters?: string[];
  confusionPairs?: LearnerConfusionPair[];
  explorationCharacters?: string[];
  fluencyCharacters?: string[];
  stableReviewCharacters?: string[];
  overtrainedCharacters?: string[];
  unlockPreviewCharacters?: string[];
  activeCharacterSet: string[];
  contentSourceBias: "real" | "synthetic" | "mixed";
  punctuationEnabled: boolean;
  capitalizationEnabled: boolean;
  contentFamilyId?: string;
  keyboardLayoutId?: string;
  numpadPracticeEnabled?: boolean;
  lessonBalance?: {
    recoveryShare: number;
    reinforcementShare?: number;
    bridgeShare: number;
    explorationShare: number;
    fluencyShare: number;
    symbolShare: number;
    confusionShare?: number;
    transitionShare?: number;
  };
  programmerDrillPresetId?: string;
  difficultyBand?: ContentDifficultyBand;
  recentSessions?: SessionRecord[];
  contentBundle?: LoadedLanguageContentBundle | null;
  adaptiveLessonPreference?: "common-words" | "phrase-drills" | "quote-drills";
}
export interface GeneratedPassage {
  text: string;
  emphasizedCharacters: string[];
  contentMetrics: SessionContentMetrics;
}

export interface WordFamily {
  key: string;
  words: string[];
}

export interface PassageContext {
  recentWords: string[];
  recentFamilyKeys: string[];
  usageCounts: Map<string, number>;
  recentContentFamilyIds: string[];
  familyUsageCounts: Map<string, number>;
  fragmentUsageCounts: Map<string, number>;
  openingTokenCounts: Map<string, number>;
}

export interface LessonLexicon {
  compatibleWords: string[];
  focusWords: string[];
  clusterWords: string[];
  families: WordFamily[];
  syntheticWords: string[];
  phraseFragments: string[];
  benchmarkSentences: string[];
  realWords: string[];
  scarcityLevel: "healthy" | "tight" | "critical";
  scarcityFallbackWords: string[];
}

export interface GeneratedPassageCandidate {
  text: string;
  emphasizedCharacters: string[];
  contentMetrics: SessionContentMetrics;
}

const INLINE_WORD_CHARACTERS = new Set<string>(INLINE_WORD_CHARACTER_LIST);

export function normalizeWord(word: string) {
  return word.toLowerCase();
}

export function uniqueCharacters(characters: string[]) {
  return Array.from(new Set(characters.filter(Boolean)));
}

const difficultyBandOrder = [
  "foundational",
  "developing",
  "fluent",
  "advanced",
  "expert-control",
] as const satisfies readonly ContentDifficultyBand[];

export function uniqueTextItems(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function uniqueWords(words: string[]) {
  return Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)));
}

export function usesActiveCharacterSet(word: string, activeCharacterSet: string[]) {
  const allowedCharacters = new Set(activeCharacterSet.map((character) => character.toLowerCase()));

  return Array.from(normalizeWord(word)).every(
    (character) => allowedCharacters.has(character) || INLINE_WORD_CHARACTERS.has(character),
  );
}

export function sharedPrefixLength(leftWord: string, rightWord: string) {
  const maxLength = Math.min(leftWord.length, rightWord.length);
  let index = 0;

  while (index < maxLength && leftWord[index] === rightWord[index]) {
    index += 1;
  }

  return index;
}

export function sharedSuffixLength(leftWord: string, rightWord: string) {
  const maxLength = Math.min(leftWord.length, rightWord.length);
  let index = 0;

  while (
    index < maxLength &&
    leftWord[leftWord.length - 1 - index] === rightWord[rightWord.length - 1 - index]
  ) {
    index += 1;
  }

  return index;
}

export function countSharedCharacters(leftWord: string, rightWord: string) {
  const rightCharacterSet = new Set(Array.from(rightWord));

  return Array.from(new Set(Array.from(leftWord))).reduce(
    (total, character) => total + (rightCharacterSet.has(character) ? 1 : 0),
    0,
  );
}

export function buildWordTransitionDiversity(word: string) {
  const characters = Array.from(word);

  if (characters.length < 2) {
    return 0;
  }

  const transitions = new Set<string>();

  for (let index = 1; index < characters.length; index += 1) {
    transitions.add(`${characters[index - 1]}${characters[index]}`);
  }

  return transitions.size / Math.max(characters.length - 1, 1);
}

export function getMaxTokenReuseRatio(tokens: string[]) {
  if (tokens.length === 0) {
    return 0;
  }

  const usageCounts = tokens.reduce((counts, token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return Math.max(...usageCounts.values()) / Math.max(tokens.length, 1);
}

export function capitalizeWord(word: string) {
  return word.length === 0 ? word : `${word[0].toUpperCase()}${word.slice(1)}`;
}

export function joinLanguageTokens(languageId: string, tokens: string[]) {
  const languageDefinition = getLanguageDefinition(languageId);
  return tokens.join(languageDefinition.wordSeparator);
}

export function capitalizeSentenceText(text: string) {
  return text.length === 0 ? text : `${text[0].toUpperCase()}${text.slice(1)}`;
}

export function getLanguageClauseSeparator(languageId: string) {
  return languageId === "persian" ? "،" : ",";
}

export function getLanguageQuestionMark(languageId: string) {
  return languageId === "persian" ? "؟" : "?";
}

export function getSentenceEndingChoices(languageId: string) {
  return [".", ".", "!", getLanguageQuestionMark(languageId)];
}

export function getPhraseFragmentEndings(languageId: string) {
  if (languageId === "persian") {
    return [".", ".", "، سپس."];
  }

  if (languageId === "russian") {
    return [".", ".", ", затем."];
  }

  return [".", ".", ", then."];
}

export function getRestrainedAdaptiveSentenceEndingChoices() {
  return ["."] as const;
}

export function getRestrainedAdaptivePhraseFragmentEndings() {
  return ["."] as const;
}

export function countAdaptiveNonLetterPressure(options: PassageGenerationOptions) {
  const languageDefinition = getLanguageDefinition(options.languageId);
  const nonLetterCharacters = new Set([
    ...languageDefinition.punctuation,
    ...languageDefinition.quotes,
    ...languageDefinition.digits,
    ...languageDefinition.nativeDigits,
  ]);

  return uniqueCharacters([
    ...options.priorityCharacters,
    ...(options.recoveryCharacters ?? []),
    ...(options.reinforcementCharacters ?? []),
    ...(options.hesitationCharacters ?? []),
    ...((options.confusionPairs ?? []).flatMap((pair) => [
      pair.expectedCharacter,
      pair.enteredCharacter,
    ]) ?? []),
  ]).filter((character) => nonLetterCharacters.has(character)).length;
}

export function shouldUseRestrainedAdaptivePunctuation(options: {
  languageId: string;
  difficultyBandIndex: number;
  adaptiveLessonPreference: "common-words" | "phrase-drills" | "quote-drills";
  nonLetterPressure: number;
}) {
  if (options.difficultyBandIndex <= 1) {
    return true;
  }

  if (options.adaptiveLessonPreference === "common-words" && options.nonLetterPressure < 3) {
    return true;
  }

  if (
    options.languageId === "persian" &&
    options.difficultyBandIndex <= 2 &&
    options.adaptiveLessonPreference !== "quote-drills" &&
    options.nonLetterPressure < 3
  ) {
    return true;
  }

  return false;
}

export function shouldAllowAdaptiveClausePunctuation(options: {
  restrainedPunctuation: boolean;
  adaptiveLessonPreference: "common-words" | "phrase-drills" | "quote-drills";
  nonLetterPressure: number;
}) {
  if (options.restrainedPunctuation) {
    return false;
  }

  return (
    options.adaptiveLessonPreference !== "common-words" ||
    options.nonLetterPressure >= 2
  );
}

export function scoreFragmentMachineryPenalty(options: {
  fragment: string;
  languageId: string;
  difficultyBandIndex: number;
  fragmentKind?: "phrase" | "benchmark";
}) {
  if (options.difficultyBandIndex >= 3) {
    return 0;
  }

  const machineryPattern =
    options.languageId === "persian"
      ? /درس|مرحله|شاگرد|مرور|بازبینی|معیار|نشانه‌گذاری/gu
      : options.languageId === "english"
        ? /\blesson\b|\bbenchmark\b|\breview\b|\bprogression\b/giu
        : options.languageId === "russian"
          ? /урок|ученик|обзор|контрольный текст/gu
          : null;

  if (!machineryPattern) {
    return 0;
  }

  const matchCount = (options.fragment.match(machineryPattern) ?? []).length;
  const perMatchPenalty =
    options.languageId === "persian"
      ? options.fragmentKind === "benchmark"
        ? options.difficultyBandIndex <= 1
          ? 12
          : 8
        : options.difficultyBandIndex <= 1
          ? 30
          : 20
      : options.fragmentKind === "benchmark"
        ? options.difficultyBandIndex <= 1
          ? 10
          : 6
        : options.difficultyBandIndex <= 1
          ? 24
          : 16;

  return matchCount * perMatchPenalty;
}

export function isPersianLessonControlWord(word: string) {
  return /درس|مرحله|شاگرد|مرور|بازبینی|معیار|نشانه‌گذاری|تمرین/u.test(word);
}

export function selectFoundationalPersianWordPool(words: string[], targetWordCount: number) {
  const calmWords = words.filter((word) => !isPersianLessonControlWord(word));
  const minimumCalmPoolSize = Math.max(8, Math.round(targetWordCount * 0.55));

  return calmWords.length >= minimumCalmPoolSize ? calmWords : words;
}

export function createPassageContext(history?: RecentContentHistory): PassageContext {
  return {
    recentWords: [...(history?.recentWords ?? [])],
    recentFamilyKeys: [...(history?.recentFamilyKeys ?? [])],
    usageCounts: new Map(history?.usageCounts ?? []),
    recentContentFamilyIds: [...(history?.recentContentFamilyIds ?? [])],
    familyUsageCounts: new Map<string, number>(),
    fragmentUsageCounts: new Map(history?.fragmentUsageCounts ?? []),
    openingTokenCounts: new Map(history?.openingTokenCounts ?? []),
  };
}

export function noteWordUsage(context: PassageContext, word: string, familyKey?: string) {
  const normalizedWord = normalizeWord(word);

  context.usageCounts.set(normalizedWord, (context.usageCounts.get(normalizedWord) ?? 0) + 1);
  context.recentWords.push(normalizedWord);
  if (context.recentWords.length > MAX_CONTEXT_RECENT_WORDS) {
    context.recentWords.shift();
  }

  if (familyKey) {
    context.familyUsageCounts.set(familyKey, (context.familyUsageCounts.get(familyKey) ?? 0) + 1);
    context.recentFamilyKeys.push(familyKey);
    if (context.recentFamilyKeys.length > MAX_CONTEXT_RECENT_FAMILY_KEYS) {
      context.recentFamilyKeys.shift();
    }
  }
}

export function buildTokenReuseLimit(candidatePoolSize: number, targetCount: number) {
  if (candidatePoolSize >= targetCount) {
    return 1;
  }

  if (candidatePoolSize >= Math.max(8, Math.round(targetCount * 0.8))) {
    return 1;
  }

  if (candidatePoolSize >= Math.max(6, Math.round(targetCount * 0.6))) {
    return 2;
  }

  return 1;
}

export function normalizeFragmentKey(fragment: string, languageId: string) {
  return normalizeFragmentKeyForLanguage(fragment, languageId);
}

export function createsRepeatingLoop(words: string[], candidateWord: string) {
  const normalizedWords = words.map(normalizeWord);
  const normalizedCandidate = normalizeWord(candidateWord);
  const lastWord = normalizedWords[normalizedWords.length - 1];
  const secondLastWord = normalizedWords[normalizedWords.length - 2];
  const thirdLastWord = normalizedWords[normalizedWords.length - 3];

  if (!normalizedCandidate) {
    return false;
  }

  if (lastWord === normalizedCandidate) {
    return true;
  }

  if (lastWord === secondLastWord && lastWord === normalizedCandidate) {
    return true;
  }

  return (
    normalizedWords.length >= 3 &&
    lastWord === thirdLastWord &&
    secondLastWord === normalizedCandidate
  );
}

export function looksLoopCollapsed(words: string[]) {
  if (words.length < 6) {
    return false;
  }

  const normalizedWords = words.map(normalizeWord);
  const uniqueWordCount = new Set(normalizedWords).size;
  const usageCounts = normalizedWords.reduce((counts, word) => {
    counts.set(word, (counts.get(word) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const maxReuse = Math.max(...usageCounts.values());
  let alternatingPairs = 0;

  for (let index = 3; index < normalizedWords.length; index += 1) {
    if (
      normalizedWords[index] === normalizedWords[index - 2] &&
      normalizedWords[index - 1] === normalizedWords[index - 3]
    ) {
      alternatingPairs += 1;
    }
  }

  return (
    uniqueWordCount <= Math.max(3, Math.round(words.length * 0.34)) ||
    maxReuse > Math.max(2, Math.round(words.length * 0.3)) ||
    alternatingPairs >= 2
  );
}

export function getDifficultyBand(options: PassageGenerationOptions) {
  return options.difficultyBand ?? "developing";
}

export function usesActiveCharacterSetInText(
  text: string,
  activeCharacterSet: string[],
  punctuationEnabled: boolean,
  languageId: string,
) {
  const languageDefinition = getLanguageDefinition(languageId);
  const allowedCharacters = new Set(activeCharacterSet.map((character) => character.toLowerCase()));
  const punctuationCharacters = new Set(
    punctuationEnabled
      ? [...languageDefinition.punctuation, ...languageDefinition.quotes]
      : [],
  );

  return Array.from(text.toLowerCase()).every((character) => {
    if (character.trim() === "") {
      return true;
    }

    return (
      allowedCharacters.has(character) ||
      INLINE_WORD_CHARACTERS.has(character) ||
      punctuationCharacters.has(character)
    );
  });
}

export function collectCompatibleFragments(
  fragments: readonly string[],
  options: Pick<
    PassageGenerationOptions,
    "activeCharacterSet" | "languageId" | "punctuationEnabled"
  >,
) {
  return fragments.filter((fragment) =>
    usesActiveCharacterSetInText(
      fragment,
      options.activeCharacterSet,
      options.punctuationEnabled,
      options.languageId,
    ),
  );
}

export function collectTierFragments(
  tiers: Record<ContentDifficultyBand, readonly string[]>,
  difficultyBand: ContentDifficultyBand,
  options: Pick<PassageGenerationOptions, "activeCharacterSet" | "languageId" | "punctuationEnabled">,
) {
  const difficultyBandIndex = getDifficultyBandIndex(difficultyBand);
  const currentTierId = difficultyBandOrder[difficultyBandIndex] ?? "developing";
  const supportTierIds =
    difficultyBandIndex <= 1
      ? difficultyBandOrder.slice(0, difficultyBandIndex + 1)
      : difficultyBandOrder.slice(Math.max(0, difficultyBandIndex - 1), difficultyBandIndex + 1);
  const fallbackTierIds = difficultyBandOrder.slice(0, difficultyBandIndex + 1);

  return {
    currentFragments: collectCompatibleFragments(tiers[currentTierId], options),
    supportFragments: uniqueTextItems(
      collectCompatibleFragments(
        supportTierIds.flatMap((tierId) => [...tiers[tierId]]),
        options,
      ),
    ),
    fallbackFragments: uniqueTextItems(
      collectCompatibleFragments(
        fallbackTierIds.flatMap((tierId) => [...tiers[tierId]]),
        options,
      ),
    ),
  };
}

export function collectCompatibleWords(wordBank: readonly string[], activeCharacterSet: string[]) {
  return wordBank.filter((word) => usesActiveCharacterSet(word, activeCharacterSet));
}

export function buildAllowedCharacterSet(options: {
  activeCharacterSet: string[];
  punctuationEnabled: boolean;
  languageId: string;
}) {
  const languageDefinition = getLanguageDefinition(options.languageId);

  return new Set([
    ...options.activeCharacterSet.map((character) => character.toLowerCase()),
    ...INLINE_WORD_CHARACTERS,
    ...(options.punctuationEnabled
      ? [...languageDefinition.punctuation, ...languageDefinition.quotes]
      : []),
  ]);
}

export function usesPackedSignature(signature: string, allowedCharacters: Set<string>) {
  return Array.from(signature).every((character) => allowedCharacters.has(character));
}

export function uniquePackedWordEntries(entries: readonly PackedWordEntry[]) {
  const seenTokens = new Set<string>();
  const uniqueEntries: PackedWordEntry[] = [];

  for (const entry of entries) {
    if (seenTokens.has(entry.token)) {
      continue;
    }

    seenTokens.add(entry.token);
    uniqueEntries.push(entry);
  }

  return uniqueEntries;
}

export function buildPackWordSelection(
  commonWordsPack: CommonWordsContentPack,
  difficultyBand: ContentDifficultyBand,
) {
  const foundationalEntries = commonWordsPack.stages.foundational;
  const developingEntries = commonWordsPack.stages.developing;
  const advancedEntries = commonWordsPack.stages.advanced;
  const difficultyBandIndex = getDifficultyBandIndex(difficultyBand);
  const preferredEntries =
    difficultyBandIndex <= 0
      ? foundationalEntries
      : difficultyBandIndex === 1
        ? [...foundationalEntries, ...developingEntries]
        : difficultyBandIndex === 2
          ? [
              ...foundationalEntries.slice(0, Math.max(24, Math.round(foundationalEntries.length * 0.42))),
              ...developingEntries,
              ...advancedEntries.slice(0, Math.max(24, Math.round(advancedEntries.length * 0.22))),
            ]
          : difficultyBandIndex === 3
            ? [...developingEntries, ...advancedEntries, ...foundationalEntries.slice(0, 24)]
            : [...advancedEntries, ...developingEntries.slice(0, 120), ...foundationalEntries.slice(0, 18)];

  return {
    preferredEntries: uniquePackedWordEntries(preferredEntries),
    allEntries: uniquePackedWordEntries([
      ...foundationalEntries,
      ...developingEntries,
      ...advancedEntries,
    ]),
  };
}

export function collectCompatiblePackedWords(
  entries: readonly PackedWordEntry[],
  allowedCharacters: Set<string>,
) {
  return entries
    .filter((entry) => usesPackedSignature(entry.signature, allowedCharacters))
    .map((entry) => entry.token);
}

export function collectCompatiblePackedTexts(options: {
  entries: readonly PackedTextEntry[];
  allowedCharacters: Set<string>;
  difficultyBand: ContentDifficultyBand;
  minimumCount: number;
}) {
  const compatibleEntries = options.entries.filter((entry) =>
    usesPackedSignature(entry.signature, options.allowedCharacters),
  );
  const targetBandIndex = getDifficultyBandIndex(options.difficultyBand);
  let filteredEntries = compatibleEntries.filter(
    (entry) => getDifficultyBandIndex(entry.difficultyBand) <= targetBandIndex,
  );

  if (filteredEntries.length < options.minimumCount && targetBandIndex < 4) {
    filteredEntries = compatibleEntries.filter(
      (entry) => getDifficultyBandIndex(entry.difficultyBand) <= targetBandIndex + 1,
    );
  }

  if (filteredEntries.length < options.minimumCount && targetBandIndex < 3) {
    filteredEntries = compatibleEntries.filter(
      (entry) => getDifficultyBandIndex(entry.difficultyBand) <= targetBandIndex + 2,
    );
  }

  return filteredEntries.map((entry) => entry.text);
}

export function addWordFamily(
  familyMap: Map<string, Set<string>>,
  key: string,
  words: string[],
) {
  if (words.length < 2) {
    return;
  }

  const nextWords = familyMap.get(key) ?? new Set<string>();
  for (const word of words) {
    nextWords.add(word);
  }
  familyMap.set(key, nextWords);
}

export function buildWordFamilies(words: string[], languageId: string) {
  const languageDefinition = getLanguageDefinition(languageId);
  const familyMap = new Map<string, Set<string>>();

  for (const stem of languageDefinition.stems) {
    const normalizedStem = normalizeWord(stem).slice(0, Math.min(4, stem.length));
    addWordFamily(
      familyMap,
      `stem:${normalizedStem}`,
      words.filter((word) => normalizeWord(word).includes(normalizedStem)),
    );
  }

  for (const prefix of languageDefinition.prefixes) {
    addWordFamily(
      familyMap,
      `prefix:${normalizeWord(prefix)}`,
      words.filter((word) => normalizeWord(word).startsWith(normalizeWord(prefix))),
    );
  }

  for (const suffix of languageDefinition.suffixes) {
    addWordFamily(
      familyMap,
      `suffix:${normalizeWord(suffix)}`,
      words.filter((word) => normalizeWord(word).endsWith(normalizeWord(suffix))),
    );
  }

  const prefixGroups = new Map<string, string[]>();
  const suffixGroups = new Map<string, string[]>();

  for (const word of words) {
    if (word.length >= 4) {
      const prefixKey = normalizeWord(word).slice(0, 3);
      prefixGroups.set(prefixKey, [...(prefixGroups.get(prefixKey) ?? []), word]);
    }

    if (word.length >= 5) {
      const suffixKey = normalizeWord(word).slice(-3);
      suffixGroups.set(suffixKey, [...(suffixGroups.get(suffixKey) ?? []), word]);
    }
  }

  for (const [prefixKey, prefixWords] of prefixGroups.entries()) {
    addWordFamily(familyMap, `family-prefix:${prefixKey}`, prefixWords);
  }

  for (const [suffixKey, suffixWords] of suffixGroups.entries()) {
    addWordFamily(familyMap, `family-suffix:${suffixKey}`, suffixWords);
  }

  return Array.from(familyMap.entries())
    .map(([key, familyWords]) => ({
      key,
      words: Array.from(familyWords.values()),
    }))
    .sort((left, right) => right.words.length - left.words.length);
}
