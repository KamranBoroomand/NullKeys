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

interface WordFamily {
  key: string;
  words: string[];
}

interface PassageContext {
  recentWords: string[];
  recentFamilyKeys: string[];
  usageCounts: Map<string, number>;
  recentContentFamilyIds: string[];
  familyUsageCounts: Map<string, number>;
  fragmentUsageCounts: Map<string, number>;
  openingTokenCounts: Map<string, number>;
}

interface LessonLexicon {
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

interface GeneratedPassageCandidate {
  text: string;
  emphasizedCharacters: string[];
  contentMetrics: SessionContentMetrics;
}

const INLINE_WORD_CHARACTERS = new Set<string>(INLINE_WORD_CHARACTER_LIST);

function normalizeWord(word: string) {
  return word.toLowerCase();
}

function uniqueCharacters(characters: string[]) {
  return Array.from(new Set(characters.filter(Boolean)));
}

const difficultyBandOrder = [
  "foundational",
  "developing",
  "fluent",
  "advanced",
  "expert-control",
] as const satisfies readonly ContentDifficultyBand[];

function uniqueTextItems(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueWords(words: string[]) {
  return Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)));
}

function usesActiveCharacterSet(word: string, activeCharacterSet: string[]) {
  const allowedCharacters = new Set(activeCharacterSet.map((character) => character.toLowerCase()));

  return Array.from(normalizeWord(word)).every(
    (character) => allowedCharacters.has(character) || INLINE_WORD_CHARACTERS.has(character),
  );
}

function sharedPrefixLength(leftWord: string, rightWord: string) {
  const maxLength = Math.min(leftWord.length, rightWord.length);
  let index = 0;

  while (index < maxLength && leftWord[index] === rightWord[index]) {
    index += 1;
  }

  return index;
}

function sharedSuffixLength(leftWord: string, rightWord: string) {
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

function countSharedCharacters(leftWord: string, rightWord: string) {
  const rightCharacterSet = new Set(Array.from(rightWord));

  return Array.from(new Set(Array.from(leftWord))).reduce(
    (total, character) => total + (rightCharacterSet.has(character) ? 1 : 0),
    0,
  );
}

function buildWordTransitionDiversity(word: string) {
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

function getMaxTokenReuseRatio(tokens: string[]) {
  if (tokens.length === 0) {
    return 0;
  }

  const usageCounts = tokens.reduce((counts, token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return Math.max(...usageCounts.values()) / Math.max(tokens.length, 1);
}

function capitalizeWord(word: string) {
  return word.length === 0 ? word : `${word[0].toUpperCase()}${word.slice(1)}`;
}

function joinLanguageTokens(languageId: string, tokens: string[]) {
  const languageDefinition = getLanguageDefinition(languageId);
  return tokens.join(languageDefinition.wordSeparator);
}

function capitalizeSentenceText(text: string) {
  return text.length === 0 ? text : `${text[0].toUpperCase()}${text.slice(1)}`;
}

function getLanguageClauseSeparator(languageId: string) {
  return languageId === "persian" ? "،" : ",";
}

function getLanguageQuestionMark(languageId: string) {
  return languageId === "persian" ? "؟" : "?";
}

function getSentenceEndingChoices(languageId: string) {
  return [".", ".", "!", getLanguageQuestionMark(languageId)];
}

function getPhraseFragmentEndings(languageId: string) {
  if (languageId === "persian") {
    return [".", ".", "، سپس."];
  }

  if (languageId === "russian") {
    return [".", ".", ", затем."];
  }

  return [".", ".", ", then."];
}

function getRestrainedAdaptiveSentenceEndingChoices() {
  return ["."] as const;
}

function getRestrainedAdaptivePhraseFragmentEndings() {
  return ["."] as const;
}

function countAdaptiveNonLetterPressure(options: PassageGenerationOptions) {
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

function shouldUseRestrainedAdaptivePunctuation(options: {
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

function shouldAllowAdaptiveClausePunctuation(options: {
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

function scoreFragmentMachineryPenalty(options: {
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

function createPassageContext(history?: RecentContentHistory): PassageContext {
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

function noteWordUsage(context: PassageContext, word: string, familyKey?: string) {
  const normalizedWord = normalizeWord(word);

  context.usageCounts.set(normalizedWord, (context.usageCounts.get(normalizedWord) ?? 0) + 1);
  context.recentWords.push(normalizedWord);
  if (context.recentWords.length > 8) {
    context.recentWords.shift();
  }

  if (familyKey) {
    context.familyUsageCounts.set(familyKey, (context.familyUsageCounts.get(familyKey) ?? 0) + 1);
    context.recentFamilyKeys.push(familyKey);
    if (context.recentFamilyKeys.length > 4) {
      context.recentFamilyKeys.shift();
    }
  }
}

function buildTokenReuseLimit(candidatePoolSize: number, targetCount: number) {
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

function normalizeFragmentKey(fragment: string, languageId: string) {
  return normalizeFragmentKeyForLanguage(fragment, languageId);
}

function createsRepeatingLoop(words: string[], candidateWord: string) {
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

function looksLoopCollapsed(words: string[]) {
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

function getDifficultyBand(options: PassageGenerationOptions) {
  return options.difficultyBand ?? "developing";
}

function usesActiveCharacterSetInText(
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

function collectCompatibleFragments(
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

function collectTierFragments(
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

function collectCompatibleWords(wordBank: readonly string[], activeCharacterSet: string[]) {
  return wordBank.filter((word) => usesActiveCharacterSet(word, activeCharacterSet));
}

function buildAllowedCharacterSet(options: {
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

function usesPackedSignature(signature: string, allowedCharacters: Set<string>) {
  return Array.from(signature).every((character) => allowedCharacters.has(character));
}

function uniquePackedWordEntries(entries: readonly PackedWordEntry[]) {
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

function buildPackWordSelection(
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

function collectCompatiblePackedWords(
  entries: readonly PackedWordEntry[],
  allowedCharacters: Set<string>,
) {
  return entries
    .filter((entry) => usesPackedSignature(entry.signature, allowedCharacters))
    .map((entry) => entry.token);
}

function collectCompatiblePackedTexts(options: {
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

function addWordFamily(
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

function buildWordFamilies(words: string[], languageId: string) {
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

function buildLessonLexicon(options: PassageGenerationOptions, emphasisCharacters: string[]) {
  const languageDefinition = getLanguageDefinition(options.languageId);
  const contentFamily = getContentFamily(options.contentFamilyId);
  const difficultyBand = getDifficultyBand(options);
  const difficultyBandIndex = getDifficultyBandIndex(difficultyBand);
  const contentBundle =
    options.contentBundle && options.contentBundle.languageId === options.languageId
      ? options.contentBundle
      : null;
  const packWordSelection = contentBundle?.commonWordsPack
    ? buildPackWordSelection(contentBundle.commonWordsPack, difficultyBand)
    : null;
  const allowedCharacters = buildAllowedCharacterSet({
    activeCharacterSet: options.activeCharacterSet,
    punctuationEnabled: options.punctuationEnabled,
    languageId: options.languageId,
  });
  const focusCharacters = uniqueCharacters(
    emphasisCharacters.map((character) => character.toLowerCase()),
  );
  const clusterCharacters = uniqueCharacters(
    [
      ...focusCharacters,
      ...(options.bridgeCharacters ?? []),
      ...(options.reinforcementCharacters ?? []),
      ...(options.activeCharacterSet.slice(0, 10) ?? []),
    ].map((character) => character.toLowerCase()),
  );
  const preferredRealWords =
    packWordSelection
      ? packWordSelection.preferredEntries.map((entry) => entry.token)
      : difficultyBandIndex <= 0
        ? languageDefinition.foundationalWords
        : difficultyBandIndex === 1
          ? [...languageDefinition.foundationalWords, ...languageDefinition.developingWords]
          : difficultyBandIndex === 2
            ? [
                ...languageDefinition.foundationalWords.slice(0, 12),
                ...languageDefinition.developingWords,
                ...languageDefinition.advancedWords.slice(0, 10),
              ]
            : difficultyBandIndex === 3
              ? [...languageDefinition.developingWords, ...languageDefinition.advancedWords]
              : [
                  ...languageDefinition.advancedWords,
                  ...languageDefinition.developingWords.slice(0, 14),
                  ...languageDefinition.foundationalWords.slice(0, 8),
                ];
  const broaderRealWords = packWordSelection
    ? packWordSelection.allEntries.map((entry) => entry.token)
    : languageDefinition.realWordBank;
  const realWordPool =
    contentFamily.id === "quote-drills"
      ? [
          ...preferredRealWords,
          ...broaderRealWords.slice(0, Math.max(24, preferredRealWords.length)),
        ]
      : preferredRealWords;
  const compatibleWords = packWordSelection
    ? collectCompatiblePackedWords(
        uniquePackedWordEntries([
          ...packWordSelection.preferredEntries,
          ...packWordSelection.allEntries.filter((entry) => realWordPool.includes(entry.token)),
        ]),
        allowedCharacters,
      )
    : collectCompatibleWords(realWordPool, options.activeCharacterSet);
  const broaderCompatibleWords = packWordSelection
    ? collectCompatiblePackedWords(packWordSelection.allEntries, allowedCharacters)
    : collectCompatibleWords(languageDefinition.realWordBank, options.activeCharacterSet);
  const fallbackWords = uniqueWords(
    compatibleWords.length >= 6
      ? compatibleWords
      : [...compatibleWords, ...broaderCompatibleWords],
  );
  const focusWords = compatibleWords.filter((word) =>
    focusCharacters.length === 0 ? true : containsAnyCharacter(normalizeWord(word), focusCharacters),
  );
  const clusterWords = fallbackWords.filter((word) =>
    containsAnyCharacter(normalizeWord(word), clusterCharacters),
  );
  const compatibleSyntheticWords = collectCompatibleWords(
    languageDefinition.syntheticWordBank,
    options.activeCharacterSet,
  );
  const rawPhraseFragments =
    contentBundle?.phrasePack && contentBundle.phrasePack.entries.length > 0
      ? collectCompatiblePackedTexts({
          entries: contentBundle.phrasePack.entries,
          allowedCharacters,
          difficultyBand,
          minimumCount: 6,
        })
      : languageDefinition.phraseFragments.filter((fragment) =>
          usesActiveCharacterSetInText(
            fragment,
            options.activeCharacterSet,
            options.punctuationEnabled,
            options.languageId,
          ),
        );
  const rawBenchmarkSentences =
    contentBundle?.quotePack && contentBundle.quotePack.entries.length > 0
      ? collectCompatiblePackedTexts({
          entries: contentBundle.quotePack.entries,
          allowedCharacters,
          difficultyBand,
          minimumCount: 4,
        })
      : languageDefinition.benchmarkSentences.filter((sentence) =>
          usesActiveCharacterSetInText(
            sentence,
            options.activeCharacterSet,
            options.punctuationEnabled,
            options.languageId,
          ),
        );
  const readablePhraseFragments = filterReadableNaturalFragments({
    fragments: rawPhraseFragments,
    languageId: options.languageId,
    difficultyBand,
    fragmentKind: "phrase",
    minimumCount: 6,
  });
  const readableBenchmarkSentences = filterReadableNaturalFragments({
    fragments: rawBenchmarkSentences,
    languageId: options.languageId,
    difficultyBand,
    fragmentKind: "benchmark",
    minimumCount: 4,
  });
  const machineryLightPhraseFragments =
    options.languageId === "persian" && difficultyBandIndex <= 1
      ? readablePhraseFragments.filter(
          (fragment) =>
            scoreFragmentMachineryPenalty({
              fragment,
              languageId: options.languageId,
              difficultyBandIndex,
              fragmentKind: "phrase",
            }) === 0,
        )
      : readablePhraseFragments;
  const machineryLightBenchmarkSentences =
    options.languageId === "persian" && difficultyBandIndex <= 1
      ? readableBenchmarkSentences.filter(
          (sentence) =>
            scoreFragmentMachineryPenalty({
              fragment: sentence,
              languageId: options.languageId,
              difficultyBandIndex,
              fragmentKind: "benchmark",
            }) === 0,
        )
      : readableBenchmarkSentences;
  const phraseFragments =
    machineryLightPhraseFragments.length >= 6
      ? machineryLightPhraseFragments
      : readablePhraseFragments;
  const benchmarkSentences =
    machineryLightBenchmarkSentences.length >= 4
      ? machineryLightBenchmarkSentences
      : readableBenchmarkSentences;

  return {
    compatibleWords: fallbackWords,
    focusWords,
    clusterWords,
    families: buildWordFamilies(fallbackWords, options.languageId),
    syntheticWords: compatibleSyntheticWords,
    phraseFragments,
    benchmarkSentences,
    realWords: fallbackWords,
    scarcityLevel:
      fallbackWords.length >= Math.max(8, Math.round(options.targetWordCount * 0.6))
        ? "healthy"
        : fallbackWords.length >= 4
          ? "tight"
          : "critical",
    scarcityFallbackWords: uniqueWords([
      ...fallbackWords,
      ...collectCompatibleWords(languageDefinition.realWordBank, options.activeCharacterSet),
      ...compatibleSyntheticWords.slice(0, 6),
    ]),
  } satisfies LessonLexicon;
}

function scoreCandidateWord(options: {
  word: string;
  focusCharacters: string[];
  clusterCharacters: string[];
  seedWord: string | null;
  usageCount: number;
  recentWords: string[];
  difficultyBand: ContentDifficultyBand;
}) {
  const normalizedWord = normalizeWord(options.word);
  const difficultyBandIndex = getDifficultyBandIndex(options.difficultyBand);
  const focusHits = options.focusCharacters.filter((character) =>
    normalizedWord.includes(character),
  ).length;
  const clusterHits = options.clusterCharacters.filter((character) =>
    normalizedWord.includes(character),
  ).length;
  const sharedSeedPrefix = options.seedWord
    ? sharedPrefixLength(normalizedWord, normalizeWord(options.seedWord))
    : 0;
  const sharedSeedSuffix = options.seedWord
    ? sharedSuffixLength(normalizedWord, normalizeWord(options.seedWord))
    : 0;
  const sharedSeedCharacters = options.seedWord
    ? countSharedCharacters(normalizedWord, normalizeWord(options.seedWord))
    : 0;
  const seedSimilarityPenalty =
    (sharedSeedPrefix >= 3 ? 8 + sharedSeedPrefix * 2 : 0) +
    (sharedSeedSuffix >= 3 ? 5 + sharedSeedSuffix * 1.5 : 0);
  const recentPenalty = options.recentWords.includes(normalizedWord) ? 12 : 0;
  const targetLength = [4, 5, 6, 8, 10][difficultyBandIndex] ?? 6;
  const lengthScore = Math.max(-12, 12 - Math.abs(normalizedWord.length - targetLength) * 3);
  const distinctCharacterCount = new Set(Array.from(normalizedWord)).size;
  const transitionDiversity = buildWordTransitionDiversity(normalizedWord);
  const uniqueCharacterBonus =
    difficultyBandIndex >= 2
      ? distinctCharacterCount + transitionDiversity * 5
      : distinctCharacterCount * 0.25;
  const earlyDifficultyPenalty =
    difficultyBandIndex <= 1 && transitionDiversity > 0.88 ? 3 : 0;

  return (
    focusHits * 16 +
    clusterHits * 6 +
    sharedSeedPrefix * (difficultyBandIndex <= 1 ? 2 : 3) +
    sharedSeedSuffix * (difficultyBandIndex <= 1 ? 1.5 : 2.5) +
    sharedSeedCharacters * 1.2 -
    seedSimilarityPenalty -
    options.usageCount * 18 -
    recentPenalty +
    lengthScore +
    uniqueCharacterBonus -
    earlyDifficultyPenalty
  );
}

function chooseRelatedWord(options: {
  candidateWords: string[];
  focusCharacters: string[];
  clusterCharacters: string[];
  seedWord: string | null;
  context: PassageContext;
  difficultyBand: ContentDifficultyBand;
  targetCount: number;
  outputWords?: string[];
}) {
  if (options.candidateWords.length === 0) {
    return null;
  }

  const maxReuse = buildTokenReuseLimit(options.candidateWords.length, options.targetCount);
  const filteredCandidates = options.candidateWords.filter((candidateWord) => {
    const normalizedCandidate = normalizeWord(candidateWord);
    const usageCount = options.context.usageCounts.get(normalizedCandidate) ?? 0;

    if (
      usageCount >= maxReuse ||
      createsRepeatingLoop(options.outputWords ?? [], candidateWord)
    ) {
      return false;
    }

    return !options.context.recentWords.includes(normalizedCandidate);
  });
  const effectiveCandidates =
    filteredCandidates.length > 0
      ? filteredCandidates
      : options.candidateWords.filter(
          (candidateWord) => !createsRepeatingLoop(options.outputWords ?? [], candidateWord),
        );
  const fallbackCandidates =
    effectiveCandidates.length > 0 ? effectiveCandidates : options.candidateWords;
  const topCandidates = fallbackCandidates
    .map((candidateWord) => ({
      word: candidateWord,
      score: scoreCandidateWord({
        word: candidateWord,
        focusCharacters: options.focusCharacters,
        clusterCharacters: options.clusterCharacters,
        seedWord: options.seedWord,
        usageCount: options.context.usageCounts.get(normalizeWord(candidateWord)) ?? 0,
        recentWords: options.context.recentWords,
        difficultyBand: options.difficultyBand,
      }),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((entry) => entry.word);

  return chooseRandomItem(topCandidates);
}

function chooseWordFamily(options: {
  families: WordFamily[];
  focusCharacters: string[];
  clusterCharacters: string[];
  context: PassageContext;
  targetCount: number;
}) {
  const weightedFamilies = options.families
    .map((family) => {
      const focusHits = family.words.reduce(
        (sum, word) =>
          sum +
          options.focusCharacters.filter((character) =>
            normalizeWord(word).includes(character),
          ).length,
        0,
      );
      const clusterHits = family.words.reduce(
        (sum, word) =>
          sum +
          options.clusterCharacters.filter((character) =>
            normalizeWord(word).includes(character),
          ).length,
        0,
      );
      const unusedWords = family.words.filter(
        (word) => !options.context.recentWords.includes(normalizeWord(word)),
      ).length;
      const recencyPenalty = options.context.recentFamilyKeys.includes(family.key) ? 12 : 0;
      const familyUsagePenalty =
        (options.context.familyUsageCounts.get(family.key) ?? 0) >=
        Math.max(1, Math.round(options.targetCount / 6))
          ? 20
          : 0;

      return {
        family,
        score:
          focusHits * 10 +
          clusterHits * 4 +
          unusedWords * 3 +
          family.words.length -
          recencyPenalty -
          familyUsagePenalty,
      };
    })
    .sort((left, right) => right.score - left.score);

  return weightedFamilies[0]?.family ?? null;
}

function createPseudoWord(options: {
  languageId: string;
  activeCharacterSet: string[];
  emphasisCharacters: string[];
  bridgeCharacters: string[];
  context: PassageContext;
  difficultyBand: ContentDifficultyBand;
}) {
  const languageDefinition = getLanguageDefinition(options.languageId);
  const compatibleSyllables = languageDefinition.pseudoSyllables.filter((syllable) =>
    usesActiveCharacterSet(syllable, options.activeCharacterSet),
  );
  const difficultyBandIndex = getDifficultyBandIndex(options.difficultyBand);
  const syllablePool =
    compatibleSyllables.length > 0
      ? compatibleSyllables
      : uniqueCharacters([
          ...options.emphasisCharacters,
          ...options.bridgeCharacters,
          ...options.activeCharacterSet.slice(0, 8),
        ]).map((character, index) => `${character}${options.activeCharacterSet[(index + 1) % options.activeCharacterSet.length] ?? character}`);
  const syllables: string[] = [];
  const targetSyllables =
    difficultyBandIndex >= 4
      ? 4
      : difficultyBandIndex >= 2
        ? 3
        : 2;

  for (let index = 0; index < targetSyllables; index += 1) {
    const candidates =
      index > 0
        ? syllablePool.filter((syllable) => syllable !== syllables[index - 1])
        : syllablePool;
    syllables.push(chooseRandomItem(candidates.length > 0 ? candidates : syllablePool));
  }

  const baseWord = syllables.join("");
  const hardCluster =
    difficultyBandIndex >= 2 && options.emphasisCharacters.length > 0
      ? `${chooseRandomItem(options.emphasisCharacters)}${chooseRandomItem(
          options.bridgeCharacters.length > 0 ? options.bridgeCharacters : options.activeCharacterSet,
        )}`
      : "";
  const pseudoWord =
    difficultyBandIndex >= 3 && hardCluster.length > 0
      ? `${baseWord}${hardCluster}`
      : baseWord;

  if (
    languageDefinition.realWordBank.includes(pseudoWord) ||
    options.context.recentWords.includes(normalizeWord(pseudoWord))
  ) {
    return `${pseudoWord}${syllablePool[0] ?? ""}`;
  }

  return pseudoWord;
}

function repairLoopingWordRun(options: {
  words: string[];
  lexicon: LessonLexicon;
  context: PassageContext;
  targetCount: number;
  allowSyntheticFallback: boolean;
}) {
  const repairedWords = [...options.words];

  if (!looksLoopCollapsed(repairedWords)) {
    return repairedWords;
  }

  const replacementPool = uniqueWords([
    ...options.lexicon.focusWords,
    ...options.lexicon.clusterWords,
    ...options.lexicon.compatibleWords,
    ...(options.allowSyntheticFallback ? options.lexicon.syntheticWords.slice(0, 10) : []),
  ]);
  const usageCounts = repairedWords.reduce((counts, word) => {
    const normalizedWord = normalizeWord(word);
    counts.set(normalizedWord, (counts.get(normalizedWord) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const maxReuse = buildTokenReuseLimit(replacementPool.length, options.targetCount);

  for (let index = 0; index < repairedWords.length; index += 1) {
    const currentWord = repairedWords[index]!;
    const normalizedWord = normalizeWord(currentWord);
    const shouldReplace =
      (usageCounts.get(normalizedWord) ?? 0) > maxReuse ||
      createsRepeatingLoop(repairedWords.slice(0, index), currentWord);

    if (!shouldReplace) {
      continue;
    }

    const replacement = replacementPool.find((candidateWord) => {
      const normalizedCandidate = normalizeWord(candidateWord);

      return (
        normalizedCandidate !== normalizedWord &&
        !options.context.recentWords.includes(normalizedCandidate) &&
        (usageCounts.get(normalizedCandidate) ?? 0) < maxReuse &&
        !createsRepeatingLoop(repairedWords.slice(0, index), candidateWord)
      );
    });

    if (!replacement) {
      continue;
    }

    usageCounts.set(normalizedWord, Math.max(0, (usageCounts.get(normalizedWord) ?? 1) - 1));
    repairedWords[index] = replacement;
    const normalizedReplacement = normalizeWord(replacement);
    usageCounts.set(
      normalizedReplacement,
      (usageCounts.get(normalizedReplacement) ?? 0) + 1,
    );
  }

  return repairedWords;
}

function buildNaturalWordRun(options: {
  lexicon: LessonLexicon;
  context: PassageContext;
  targetCount: number;
  focusCharacters: string[];
  clusterCharacters: string[];
  languageId: string;
  activeCharacterSet: string[];
  bridgeCharacters: string[];
  contentSourceBias: PassageGenerationOptions["contentSourceBias"];
  difficultyBand: ContentDifficultyBand;
  forceSynthetic?: boolean;
  allowSyntheticFallback?: boolean;
}) {
  const words: string[] = [];
  let clusterSeed: string | null = null;
  let syntheticInsertions = 0;
  const naturalCandidatePool = uniqueWords([
    ...options.lexicon.focusWords,
    ...options.lexicon.clusterWords,
    ...options.lexicon.compatibleWords,
  ]);
  const scarcityLevel = options.lexicon.scarcityLevel;
  const allowSyntheticFallback =
    options.allowSyntheticFallback ??
    (options.forceSynthetic ||
      options.contentSourceBias !== "real" ||
      scarcityLevel !== "healthy" ||
      naturalCandidatePool.length < Math.max(5, Math.round(options.targetCount * 0.4)));
  const maxSyntheticInsertions = options.forceSynthetic
    ? options.targetCount
    : scarcityLevel === "critical"
      ? Math.min(2, Math.max(1, Math.round(options.targetCount * 0.16)))
      : scarcityLevel === "tight" && options.contentSourceBias !== "real"
        ? 1
        : 0;

  while (words.length < options.targetCount) {
    const useSynthetic =
      options.forceSynthetic ||
      options.contentSourceBias === "synthetic" ||
      (options.contentSourceBias === "mixed" &&
        (scarcityLevel === "critical" || Math.random() > 0.86));

    if (
      !useSynthetic &&
      scarcityLevel !== "critical" &&
      words.length <= options.targetCount - 2
    ) {
      const family = chooseWordFamily({
        families: options.lexicon.families,
        focusCharacters: options.focusCharacters,
        clusterCharacters: options.clusterCharacters,
        context: options.context,
        targetCount: options.targetCount,
      });

      if (family) {
        const familyWords: string[] = [];
        const familyTarget = Math.min(
          options.targetCount - words.length,
          Math.random() > 0.58 ? 3 : 2,
        );
        let familySeed: string | null = null;

        while (familyWords.length < familyTarget) {
          const nextFamilyWord = chooseRelatedWord({
            candidateWords: family.words,
            focusCharacters: options.focusCharacters,
            clusterCharacters: options.clusterCharacters,
            seedWord: familySeed,
            context: options.context,
            difficultyBand: options.difficultyBand,
            targetCount: options.targetCount,
            outputWords: [...words, ...familyWords],
          });

          if (!nextFamilyWord) {
            break;
          }

          familyWords.push(nextFamilyWord);
          noteWordUsage(options.context, nextFamilyWord, family.key);
          familySeed = nextFamilyWord;
        }

        if (familyWords.length >= 2) {
          words.push(...familyWords);
          clusterSeed = familyWords[familyWords.length - 1] ?? clusterSeed;
          continue;
        }
      }
    }

    const candidatePool =
      options.lexicon.focusWords.length >= 6
        ? options.lexicon.focusWords
        : options.lexicon.clusterWords.length >= 4
          ? uniqueWords([...options.lexicon.focusWords, ...options.lexicon.clusterWords])
          : naturalCandidatePool.length > 0
            ? naturalCandidatePool
            : options.lexicon.scarcityFallbackWords;
    const naturalWord: string | null =
      useSynthetic || candidatePool.length === 0
        ? null
        : chooseRelatedWord({
            candidateWords: candidatePool,
            focusCharacters: options.focusCharacters,
            clusterCharacters: options.clusterCharacters,
            seedWord: clusterSeed,
            context: options.context,
            difficultyBand: options.difficultyBand,
            targetCount: options.targetCount,
            outputWords: words,
          });
    const syntheticWord =
      allowSyntheticFallback && syntheticInsertions < maxSyntheticInsertions
        ? chooseRelatedWord({
            candidateWords: options.lexicon.syntheticWords,
            focusCharacters: options.focusCharacters,
            clusterCharacters: options.clusterCharacters,
            seedWord: clusterSeed,
            context: options.context,
            difficultyBand: options.difficultyBand,
            targetCount: options.targetCount,
            outputWords: words,
          })
        : null;
    const nextWord: string =
      naturalWord ??
      syntheticWord ??
      createPseudoWord({
        languageId: options.languageId,
        activeCharacterSet: options.activeCharacterSet,
        emphasisCharacters: options.focusCharacters,
        bridgeCharacters: options.bridgeCharacters,
        context: options.context,
        difficultyBand: options.difficultyBand,
      });

    noteWordUsage(options.context, nextWord);
    words.push(nextWord);
    if (!naturalWord && syntheticWord) {
      syntheticInsertions += 1;
    }
    clusterSeed = nextWord;
  }

  return repairLoopingWordRun({
    words: words.slice(0, options.targetCount),
    lexicon: options.lexicon,
    context: options.context,
    targetCount: options.targetCount,
    allowSyntheticFallback,
  });
}

function buildIntentionalPunctuationSegment(options: {
  languageId: string;
  lexicon: LessonLexicon;
  context: PassageContext;
  activeCharacterSet: string[];
  focusCharacters: string[];
  bridgeCharacters: string[];
  capitalizationEnabled: boolean;
  difficultyBand: ContentDifficultyBand;
}) {
  const languageDefinition = getLanguageDefinition(options.languageId);
  const quoteOpen = languageDefinition.quotes[0] ?? "“";
  const quoteClose = languageDefinition.quotes[1] ?? "”";
  const clauseSeparator = getLanguageClauseSeparator(options.languageId);
  const firstClause = buildNaturalWordRun({
    lexicon: options.lexicon,
    context: options.context,
    targetCount: 3,
    focusCharacters: options.focusCharacters,
    clusterCharacters: [...options.focusCharacters, ...options.bridgeCharacters],
    languageId: options.languageId,
    activeCharacterSet: options.activeCharacterSet,
    bridgeCharacters: options.bridgeCharacters,
    contentSourceBias: "real",
    difficultyBand: options.difficultyBand,
    allowSyntheticFallback: false,
  });
  const secondClause = buildNaturalWordRun({
    lexicon: options.lexicon,
    context: options.context,
    targetCount: 3,
    focusCharacters: options.bridgeCharacters,
    clusterCharacters: [...options.focusCharacters, ...options.bridgeCharacters],
    languageId: options.languageId,
    activeCharacterSet: options.activeCharacterSet,
    bridgeCharacters: options.bridgeCharacters,
    contentSourceBias: "real",
    difficultyBand: options.difficultyBand,
    allowSyntheticFallback: false,
  });
  const firstSentence = capitalizeSentenceText(
    joinLanguageTokens(options.languageId, firstClause),
  );
  const secondSentence = options.capitalizationEnabled
    ? capitalizeSentenceText(joinLanguageTokens(options.languageId, secondClause))
    : joinLanguageTokens(options.languageId, secondClause);

  return chooseRandomItem([
    `${firstSentence}${clauseSeparator} ${secondSentence}.`,
    `${firstSentence}: ${secondSentence}.`,
    `${quoteOpen}${firstSentence}.${quoteClose} ${capitalizeSentenceText(secondSentence)}.`,
  ]);
}

function createNumericSequence(difficultyBandIndex: number) {
  return shuffleItems(numericClusters.filter((fragment) => isCleanNumberFragment(fragment, difficultyBandIndex)))
    .slice(0, 5)
    .join(" ");
}

function createNumpadSequence() {
  return shuffleItems(numpadDrillFragments)
    .slice(0, 2)
    .join(" ");
}

function createSymbolSequence(symbolPressure: number) {
  return shuffleItems(punctuationClusters.filter(isCleanSymbolFragment))
    .slice(0, Math.max(3, Math.round(symbolPressure * 12)))
    .join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const DISALLOWED_NUMBER_LEXICAL_TOKEN_PATTERN =
  /\b(?:cm|kg|km|ms|px|lane|gate|seat|batch|local|cpu|ram|node|shard|load|temp|rack|invoice|due|net|lat|lon|enter)\b/iu;
const NUMBER_ALPHA_TOKEN_PATTERN = /\b[A-Za-z]+\b/gu;
const FOUNDATIONAL_ALLOWED_NUMBER_ALPHA_TOKEN_PATTERN = /^(?:ID|v)$/u;
const ADVANCED_ALLOWED_NUMBER_ALPHA_TOKEN_PATTERN = /^(?:ID|SN|v|Q|W|D|T|Z)$/u;
const SYMBOL_IDENTIFIER_PATTERN = /\b[a-z_][a-z0-9_]{2,}\b/iu;
const NATURAL_LANGUAGE_CONTROL_TOKEN_PATTERN =
  /\b(cmd|alt|ctrl|delete|systemctl|grep|git|npm|sudo|ssh|sed|awk|printf|chmod|docker|journalctl|kubectl|tail|head|cat|brew|curl|find|ls)\b|&&|\|\||=>|<\/?[a-z][^>]*>|--[a-z0-9-]+|\$\(|https?:\/\/|~\/|\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)+/iu;
const CODE_FRAGMENT_PATTERN =
  /\b(?:const|return|type|async|await|function|def|class|import|export|SELECT|INSERT|UPDATE)\b|=>|===|!==|::|<[^>]+>|\[[a-z_][a-z0-9_]*\]|\b[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\b/iu;
const SHELL_FRAGMENT_PATTERN =
  /\b(?:git|npm|node|curl|ssh|docker|journalctl|systemctl|find|grep|sed|awk|printf|tail|head|ls|cp|mv|rm|mkdir|tar|jq|rg)\b|--[a-z0-9-]+|\|\s|\s\||2>&1|\$\(.*\)|~\/|\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)+/iu;
const SYMBOL_ALPHA_NUMERIC_PATTERN = /[\p{L}\p{N}]/u;

function getAllowedNumberAlphaPattern(difficultyBandIndex: number) {
  return difficultyBandIndex <= 1
    ? FOUNDATIONAL_ALLOWED_NUMBER_ALPHA_TOKEN_PATTERN
    : ADVANCED_ALLOWED_NUMBER_ALPHA_TOKEN_PATTERN;
}

function isCleanNumberFragment(fragment: string, difficultyBandIndex = 4) {
  if (DISALLOWED_NUMBER_LEXICAL_TOKEN_PATTERN.test(fragment)) {
    return false;
  }

  return (fragment.match(NUMBER_ALPHA_TOKEN_PATTERN) ?? []).every((token) =>
    getAllowedNumberAlphaPattern(difficultyBandIndex).test(token),
  );
}

function isCleanSymbolFragment(fragment: string) {
  return !SYMBOL_IDENTIFIER_PATTERN.test(fragment) && !SYMBOL_ALPHA_NUMERIC_PATTERN.test(fragment);
}

function isShellLikeFragment(fragment: string) {
  return SHELL_FRAGMENT_PATTERN.test(fragment);
}

function isCodeLikeFragment(fragment: string) {
  return CODE_FRAGMENT_PATTERN.test(fragment);
}

function isCleanNaturalLanguageFragment(fragment: string, languageId: string) {
  if (
    NATURAL_LANGUAGE_CONTROL_TOKEN_PATTERN.test(fragment) ||
    isShellLikeFragment(fragment) ||
    isCodeLikeFragment(fragment)
  ) {
    return false;
  }

  if (getLanguageDefinition(languageId).scriptFamily === "latin") {
    return true;
  }

  return (fragment.match(LATIN_TOKEN_PATTERN) ?? []).length <= 1;
}

function startsWithConnector(fragment: string, languageId: string) {
  const trimmed = fragment.trim();

  if (languageId === "persian") {
    return /^(?:و|اما|یا|بعد|وقتی|اگر)\b/u.test(trimmed);
  }

  if (languageId === "russian") {
    return /^(?:и|но|или|потом|когда|если)\b/iu.test(trimmed);
  }

  return /^(?:and|but|or|then|while|because|if|when)\b/iu.test(trimmed);
}

function scoreFragmentAbstractionPenalty(
  fragment: string,
  languageId: string,
  difficultyBandIndex: number,
  fragmentKind: "phrase" | "benchmark",
) {
  const abstractionPattern =
    languageId === "persian"
      ? /درس|مرحله|مرور|بازبینی|معیار|نشانه‌گذاری|واژگان|شاگرد|تمرین/gu
      : languageId === "russian"
        ? /урок|обзор|контрольный|пунктуац|словар|повтор|практик/gu
        : /\blesson\b|\bbenchmark\b|\breview\b|\bpunctuation\b|\bvocabulary\b|\bprogression\b|\brecovery\b|\bteacher(?:-like)?\b/giu;
  const matchCount = (fragment.match(abstractionPattern) ?? []).length;
  const basePenalty =
    fragmentKind === "benchmark"
      ? difficultyBandIndex <= 1
        ? 5
        : 2
      : difficultyBandIndex <= 1
        ? 9
        : 4;

  return matchCount * basePenalty;
}

function isReadableNaturalFragment(options: {
  fragment: string;
  languageId: string;
  difficultyBand: ContentDifficultyBand;
  fragmentKind: "phrase" | "benchmark";
}) {
  if (!isCleanNaturalLanguageFragment(options.fragment, options.languageId)) {
    return false;
  }

  const difficultyBandIndex = getDifficultyBandIndex(options.difficultyBand);
  const tokens = tokenizePromptText(options.fragment, options.languageId);

  if (tokens.length === 0) {
    return false;
  }

  const normalizedTokens = tokens.map(normalizeWord);
  const punctuationCount = (options.fragment.match(/[^\p{L}\p{M}\p{N}\s]/gu) ?? []).length;
  const maxReuseRatio = getMaxTokenReuseRatio(normalizedTokens);
  const lowValuePenalty = scoreFragmentAbstractionPenalty(
    options.fragment,
    options.languageId,
    difficultyBandIndex,
    options.fragmentKind,
  );

  if (
    options.fragmentKind === "phrase" &&
    difficultyBandIndex <= 2 &&
    startsWithConnector(options.fragment, options.languageId)
  ) {
    return false;
  }

  if (
    (options.fragmentKind === "phrase" && tokens.length < 3) ||
    (options.fragmentKind === "benchmark" && tokens.length < 7)
  ) {
    return false;
  }

  if (options.fragmentKind === "phrase" && tokens.length > (difficultyBandIndex <= 1 ? 10 : 13)) {
    return false;
  }

  if (options.fragmentKind === "benchmark" && tokens.length > (difficultyBandIndex <= 1 ? 24 : 32)) {
    return false;
  }

  if (
    maxReuseRatio > (options.fragmentKind === "benchmark" ? 0.34 : 0.42) ||
    lowValuePenalty >= (options.fragmentKind === "benchmark" ? 12 : 16)
  ) {
    return false;
  }

  if (difficultyBandIndex <= 1 && punctuationCount > (options.fragmentKind === "benchmark" ? 3 : 1)) {
    return false;
  }

  return true;
}

function filterReadableNaturalFragments(options: {
  fragments: string[];
  languageId: string;
  difficultyBand: ContentDifficultyBand;
  fragmentKind: "phrase" | "benchmark";
  minimumCount: number;
}) {
  const readableFragments = options.fragments.filter((fragment) =>
    isReadableNaturalFragment({
      fragment,
      languageId: options.languageId,
      difficultyBand: options.difficultyBand,
      fragmentKind: options.fragmentKind,
    }),
  );

  if (readableFragments.length >= options.minimumCount) {
    return readableFragments;
  }

  const purityOnlyFragments = options.fragments.filter((fragment) =>
    isCleanNaturalLanguageFragment(fragment, options.languageId),
  );

  return purityOnlyFragments.length >= options.minimumCount ? purityOnlyFragments : options.fragments;
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function scoreSpecialtyFragmentComplexity(
  fragment: string,
  kind: "shell" | "number" | "symbol",
) {
  const separatorDensity =
    kind === "shell"
      ? countMatches(fragment, /[|/&><=:.-]/gu) / Math.max(fragment.length, 1)
      : kind === "number"
        ? countMatches(fragment, /[,:./%+\-=]/gu) / Math.max(fragment.length, 1)
        : countMatches(fragment, /[()[\]{}<>"'`|&?!:;=+*%$#@^~/_\\.-]/gu) /
          Math.max(fragment.length, 1);
  const structuralPatternCount =
    kind === "shell"
      ? countMatches(
          fragment,
          /\|\||&&|2>&1|\$\(|--[a-z0-9-]+|[a-z0-9_.-]+\/[a-z0-9_.-]+|[A-Z_]+=|tee|journalctl|docker/giu,
        )
      : kind === "number"
        ? countMatches(
            fragment,
            /\d{2,}:\d{2}(?::\d{2}(?:\.\d+)?)?|(?:ID|SN)-|v\d|Q\d|W\d|D\d|#\d|Z\b|%|[+-]\d|\d+\.\d+|\d{4}-\d{2}-\d{2}/gu,
          )
        : countMatches(
            fragment,
            /\?\?|=>|&&|\|\||::|!=|==|<=|>=|\+=|-=|\*=|\/=|\/\*|\*\/|\\["'`]|\\\\|\/\/|["'`]{2,}|[()[\]{}<>]{4,}/gu,
          );
  const tokenCount = tokenizePromptText(fragment, "english").length;
  const digitCount = countMatches(fragment, /\d/gu);
  const punctuationDensity =
    countMatches(fragment, /[^\p{L}\p{M}\p{N}\s]/gu) / Math.max(fragment.length, 1);

  return clamp(
    kind === "shell"
      ? separatorDensity * 2.9 + structuralPatternCount * 0.08 + tokenCount * 0.018 + digitCount * 0.004
      : kind === "number"
        ? separatorDensity * 3.1 + structuralPatternCount * 0.075 + tokenCount * 0.02 + digitCount * 0.008
        : punctuationDensity * 3.2 + structuralPatternCount * 0.085 + tokenCount * 0.02,
    0,
    1,
  );
}

function collectTierShapedSpecialtyWindow(options: {
  fragments: string[];
  kind: "shell" | "number" | "symbol";
  difficultyBandIndex: number;
  context: PassageContext;
  limit: number;
}) {
  const targetComplexity = [0.18, 0.32, 0.48, 0.64, 0.8][options.difficultyBandIndex] ?? 0.48;
  const rankedFragments = uniqueTextItems(options.fragments)
    .map((fragment) => {
      const normalizedTokens = tokenizePromptText(fragment, "english").map(normalizeWord);
      const overlapPenalty = normalizedTokens.reduce(
        (sum, token) => sum + (options.context.usageCounts.get(token) ?? 0) * 6,
        0,
      );
      const recentWordPenalty = normalizedTokens.filter((token) =>
        options.context.recentWords.includes(token),
      ).length * 5;
      const complexity = scoreSpecialtyFragmentComplexity(fragment, options.kind);
      const freshnessBonus = normalizedTokens.filter(
        (token) => !options.context.recentWords.includes(token),
      ).length * 2.5;

      return {
        fragment,
        score:
          100 -
          Math.abs(complexity - targetComplexity) * 170 -
          overlapPenalty -
          recentWordPenalty +
          freshnessBonus,
      };
    })
    .sort((left, right) => right.score - left.score);
  const windowSize = Math.min(
    rankedFragments.length,
    Math.max(options.limit * 2, Math.min(12, Math.round(rankedFragments.length * 0.7))),
  );

  return rankedFragments.slice(0, windowSize).map((entry) => entry.fragment);
}

function chooseTierShapedSpecialtyFragments(options: {
  anchorPool: string[];
  supportPool: string[];
  fallbackPool: string[];
  difficultyBandIndex: number;
  anchorCount: number;
  supportCount: number;
  kind: "shell" | "number" | "symbol";
  context: PassageContext;
}) {
  const fallbackWindow = collectTierShapedSpecialtyWindow({
    fragments: options.fallbackPool,
    kind: options.kind,
    difficultyBandIndex: options.difficultyBandIndex,
    context: options.context,
    limit: options.anchorCount + options.supportCount,
  });
  const anchorWindow = collectTierShapedSpecialtyWindow({
    fragments: options.anchorPool.length > 0 ? options.anchorPool : fallbackWindow,
    kind: options.kind,
    difficultyBandIndex: options.difficultyBandIndex,
    context: options.context,
    limit: options.anchorCount,
  });
  const supportWindow = collectTierShapedSpecialtyWindow({
    fragments: options.supportPool.length > 0 ? options.supportPool : fallbackWindow,
    kind: options.kind,
    difficultyBandIndex: options.difficultyBandIndex,
    context: options.context,
    limit: options.supportCount,
  });

  return uniqueTextItems([
    ...sampleItems(anchorWindow.length > 0 ? anchorWindow : fallbackWindow, options.anchorCount),
    ...sampleItems(
      supportWindow.length > 0 ? supportWindow : anchorWindow.length > 0 ? anchorWindow : fallbackWindow,
      options.supportCount,
    ),
  ]);
}

function chooseFreshFragment(
  fragments: string[],
  context: PassageContext,
  languageId: string,
  options?: {
    difficultyBand?: ContentDifficultyBand;
    fragmentKind?: "phrase" | "benchmark";
  },
) {
  if (fragments.length === 0) {
    return null;
  }

  const difficultyBandIndex = getDifficultyBandIndex(options?.difficultyBand ?? "developing");
  const scoredFragments = fragments
    .map((fragment) => {
      const tokens = tokenizePromptText(fragment, languageId);
      const normalizedTokens = tokens.map(normalizeWord);
      const openingToken = tokens[0];
      const fragmentKey = normalizeFragmentKey(fragment, languageId);
      const punctuationCount = (fragment.match(/[^\p{L}\p{M}\p{N}\s]/gu) ?? []).length;
      const targetTokenCount =
        options?.fragmentKind === "benchmark"
          ? [8, 10, 13, 17, 21][difficultyBandIndex] ?? 13
          : [4, 5, 7, 9, 11][difficultyBandIndex] ?? 7;
      const tokenReusePenalty = tokens.reduce(
        (sum, token) => sum + (context.usageCounts.get(normalizeWord(token)) ?? 0) * 4,
        0,
      );
      const internalReusePenalty =
        Math.max(0, getMaxTokenReuseRatio(normalizedTokens) - 0.28) * 55;
      const machineryPenalty = scoreFragmentMachineryPenalty({
        fragment,
        languageId,
        difficultyBandIndex,
        fragmentKind: options?.fragmentKind,
      });
      const abstractionPenalty = scoreFragmentAbstractionPenalty(
        fragment,
        languageId,
        difficultyBandIndex,
        options?.fragmentKind ?? "phrase",
      );
      const readabilityPenalty =
        Math.abs(tokens.length - targetTokenCount) * 4 +
        (difficultyBandIndex <= 1 ? punctuationCount * 5 : punctuationCount * 1.5) +
        internalReusePenalty +
        (startsWithConnector(fragment, languageId) && difficultyBandIndex <= 2 ? 10 : 0) +
        (isCleanNaturalLanguageFragment(fragment, languageId) ? 0 : 90);

      return {
        fragment,
        score:
          tokens.filter((token) => !context.recentWords.includes(normalizeWord(token))).length * 9 +
          tokens.length * 2 -
          readabilityPenalty -
          machineryPenalty -
          abstractionPenalty -
          (context.fragmentUsageCounts.get(fragmentKey) ?? 0) * 28 -
          (openingToken ? (context.openingTokenCounts.get(openingToken) ?? 0) * 18 : 0) -
          tokenReusePenalty,
      };
    })
    .sort((left, right) => right.score - left.score);

  return scoredFragments[0]?.fragment ?? null;
}

function fragmentOverlapRatio(leftFragment: string, rightFragment: string, languageId: string) {
  const leftTokens = tokenizePromptText(leftFragment, languageId).map(normalizeWord);
  const rightTokenSet = new Set(tokenizePromptText(rightFragment, languageId).map(normalizeWord));

  return leftTokens.filter((token) => rightTokenSet.has(token)).length / Math.max(leftTokens.length, 1);
}

function fragmentsAreDistinctEnough(leftFragment: string, rightFragment: string, languageId: string) {
  const leftTokens = tokenizePromptText(leftFragment, languageId);
  const rightTokens = tokenizePromptText(rightFragment, languageId);

  return (
    leftTokens[0] !== rightTokens[0] &&
    fragmentOverlapRatio(leftFragment, rightFragment, languageId) < 0.55
  );
}

function chooseDistinctFreshFragments(options: {
  fragments: string[];
  count: number;
  context: PassageContext;
  languageId: string;
  difficultyBand: ContentDifficultyBand;
  fragmentKind: "phrase" | "benchmark";
}) {
  const selectedFragments: string[] = [];
  const remainingFragments = [...options.fragments];

  while (selectedFragments.length < options.count && remainingFragments.length > 0) {
    const compatibleRemaining = remainingFragments.filter((fragment) =>
      selectedFragments.every((selectedFragment) =>
        fragmentsAreDistinctEnough(selectedFragment, fragment, options.languageId),
      ),
    );
    const candidatePool =
      compatibleRemaining.length > 0 ? compatibleRemaining : remainingFragments;
    const nextFragment = chooseFreshFragment(candidatePool, options.context, options.languageId, {
      difficultyBand: options.difficultyBand,
      fragmentKind: options.fragmentKind,
    });

    if (!nextFragment) {
      break;
    }

    selectedFragments.push(nextFragment);
    noteFragmentUsage(options.context, nextFragment, options.languageId);
    remainingFragments.splice(remainingFragments.indexOf(nextFragment), 1);
  }

  return selectedFragments;
}

function noteFragmentUsage(context: PassageContext, fragment: string, languageId: string) {
  const fragmentKey = normalizeFragmentKey(fragment, languageId);
  const tokens = tokenizePromptText(fragment, languageId);

  context.fragmentUsageCounts.set(fragmentKey, (context.fragmentUsageCounts.get(fragmentKey) ?? 0) + 1);
  if (tokens[0]) {
    context.openingTokenCounts.set(tokens[0], (context.openingTokenCounts.get(tokens[0]) ?? 0) + 1);
  }

  for (const token of tokens) {
    noteWordUsage(context, token);
  }
}

function buildSentenceLikeLesson(
  options: PassageGenerationOptions,
  history?: RecentContentHistory,
) {
  const difficultyBand = getDifficultyBand(options);
  const difficultyBandIndex = getDifficultyBandIndex(difficultyBand);
  const context = createPassageContext(history);
  const emphasisCharacters =
    options.priorityCharacters.length > 0
      ? options.priorityCharacters
      : options.activeCharacterSet.slice(0, 8);
  const lexicon = buildLessonLexicon(options, emphasisCharacters);
  const sentenceCount = Math.max(2, Math.min(4, Math.round(options.targetWordCount / 9)));
  const sentences: string[] = [];

  for (let sentenceIndex = 0; sentenceIndex < sentenceCount; sentenceIndex += 1) {
    const phraseFragment =
      lexicon.phraseFragments.length > 0 &&
      (sentenceIndex === 0 || difficultyBandIndex <= 2 || Math.random() > 0.45)
        ? chooseFreshFragment(lexicon.phraseFragments, context, options.languageId, {
            difficultyBand,
            fragmentKind: "phrase",
          })
        : null;

    if (phraseFragment) {
      noteFragmentUsage(context, phraseFragment, options.languageId);
      sentences.push(
        `${capitalizeSentenceText(phraseFragment)}${chooseRandomItem(
          getPhraseFragmentEndings(options.languageId),
        )}`,
      );
      continue;
    }

    const leadWords = buildNaturalWordRun({
      lexicon,
      context,
      targetCount: Math.max(3, Math.round(options.targetWordCount / sentenceCount / 1.8)),
      focusCharacters:
        sentenceIndex === 0
          ? emphasisCharacters
          : uniqueCharacters([
              ...emphasisCharacters,
              ...(options.reinforcementCharacters ?? []),
              ...(options.bridgeCharacters ?? []),
            ]),
      clusterCharacters: uniqueCharacters([
        ...emphasisCharacters,
        ...(options.bridgeCharacters ?? []),
        ...(options.fluencyCharacters ?? []),
      ]),
      languageId: options.languageId,
      activeCharacterSet: options.activeCharacterSet,
      bridgeCharacters: options.bridgeCharacters ?? [],
      contentSourceBias: "real",
      difficultyBand,
      allowSyntheticFallback: false,
    });
    const tailWords = buildNaturalWordRun({
      lexicon,
      context,
      targetCount: Math.max(2, Math.round(options.targetWordCount / sentenceCount / 2.4)),
      focusCharacters: uniqueCharacters([
        ...(options.bridgeCharacters ?? []),
        ...(options.fluencyCharacters ?? []),
        ...emphasisCharacters.slice(0, 2),
      ]),
      clusterCharacters: uniqueCharacters([
        ...emphasisCharacters,
        ...(options.bridgeCharacters ?? []),
        ...(options.reinforcementCharacters ?? []),
      ]),
      languageId: options.languageId,
      activeCharacterSet: options.activeCharacterSet,
      bridgeCharacters: options.bridgeCharacters ?? [],
      contentSourceBias: "real",
      difficultyBand,
      allowSyntheticFallback: false,
    });
    const leadText = joinLanguageTokens(options.languageId, leadWords);
    const tailText = joinLanguageTokens(options.languageId, tailWords);
    const clauseSeparator = getLanguageClauseSeparator(options.languageId);
    const sentenceText =
      options.punctuationEnabled && tailWords.length >= 2
        ? `${capitalizeSentenceText(leadText)}${clauseSeparator} ${tailText}`
        : capitalizeSentenceText(joinLanguageTokens(options.languageId, [...leadWords, ...tailWords]));
    sentences.push(`${sentenceText}${chooseRandomItem(getSentenceEndingChoices(options.languageId))}`);
  }

  if (options.punctuationEnabled && difficultyBandIndex >= 1) {
    sentences.splice(
      Math.min(1, sentences.length),
      0,
      buildIntentionalPunctuationSegment({
        languageId: options.languageId,
        lexicon,
        context,
        activeCharacterSet: options.activeCharacterSet,
        focusCharacters: emphasisCharacters,
        bridgeCharacters: options.bridgeCharacters ?? [],
        capitalizationEnabled: options.capitalizationEnabled,
        difficultyBand,
      }),
    );
  }

  return sentences.join(" ");
}

function buildPlainWordLesson(
  options: PassageGenerationOptions,
  history?: RecentContentHistory,
) {
  const difficultyBand = getDifficultyBand(options);
  const context = createPassageContext(history);
  const emphasisCharacters =
    options.priorityCharacters.length > 0
      ? options.priorityCharacters
      : options.activeCharacterSet.slice(0, 8);
  const lexicon = buildLessonLexicon(options, emphasisCharacters);
  const contentFamilyId = getContentFamily(options.contentFamilyId).id;
  const generatedWords = buildNaturalWordRun({
    lexicon,
    context,
    targetCount: Math.max(6, options.targetWordCount),
    focusCharacters: emphasisCharacters,
    clusterCharacters: uniqueCharacters([
      ...emphasisCharacters,
      ...(options.bridgeCharacters ?? []),
      ...(options.reinforcementCharacters ?? []),
    ]),
    languageId: options.languageId,
    activeCharacterSet: options.activeCharacterSet,
    bridgeCharacters: options.bridgeCharacters ?? [],
    contentSourceBias: contentFamilyId === "common-words" ? "real" : options.contentSourceBias,
    forceSynthetic: contentFamilyId === "pseudo-words",
    difficultyBand,
  });

  if (
    contentFamilyId === "common-words" &&
    lexicon.scarcityLevel === "critical" &&
    options.punctuationEnabled &&
    generatedWords.length >= 6
  ) {
    const leadWords = generatedWords.slice(0, Math.max(3, Math.floor(generatedWords.length / 2)));
    const tailWords = generatedWords.slice(leadWords.length);
    return `${capitalizeSentenceText(joinLanguageTokens(options.languageId, leadWords))}${getLanguageClauseSeparator(options.languageId)} ${joinLanguageTokens(options.languageId, tailWords)}.`;
  }

  return joinLanguageTokens(options.languageId, generatedWords);
}

function buildQuoteLikeLesson(
  options: PassageGenerationOptions,
  history?: RecentContentHistory,
) {
  const context = createPassageContext(history);
  const difficultyBand = getDifficultyBand(options);
  const lexicon = buildLessonLexicon(
    options,
    options.priorityCharacters.length > 0 ? options.priorityCharacters : options.activeCharacterSet.slice(0, 10),
  );
  const benchmarkSentences =
    lexicon.benchmarkSentences.length >= 2
      ? lexicon.benchmarkSentences
      : [buildSentenceLikeLesson(options, history)];
  const selectedSentences = chooseDistinctFreshFragments({
    fragments: benchmarkSentences,
    count: Math.max(2, Math.min(4, getDifficultyBandIndex(difficultyBand) + 2)),
    context,
    languageId: options.languageId,
    difficultyBand,
    fragmentKind: "benchmark",
  });

  if (selectedSentences.length >= 2) {
    return selectedSentences.join(" ");
  }

  return [
    buildSentenceLikeLesson(
      {
        ...options,
        targetWordCount: Math.max(10, Math.round(options.targetWordCount * 0.55)),
      },
      history,
    ),
    buildSentenceLikeLesson(
      {
        ...options,
        targetWordCount: Math.max(10, Math.round(options.targetWordCount * 0.45)),
      },
      history,
    ),
  ].join(" ");
}

function buildNumberLesson(options: PassageGenerationOptions) {
  const difficultyBand = getDifficultyBand(options);
  const difficultyBandIndex = getDifficultyBandIndex(difficultyBand);
  const context = createPassageContext(
    buildRecentContentHistory({
      sessionRecords: options.recentSessions,
      languageId: options.languageId,
    }),
  );
  const tierSelection = collectTierFragments(numberPatternTiers, difficultyBand, {
    activeCharacterSet: options.activeCharacterSet,
    languageId: options.languageId,
    punctuationEnabled: true,
  });
  const cleanCurrentNumberFragments = tierSelection.currentFragments.filter((fragment) =>
    isCleanNumberFragment(fragment, difficultyBandIndex),
  );
  const cleanSupportNumberFragments = tierSelection.supportFragments.filter((fragment) =>
    isCleanNumberFragment(fragment, difficultyBandIndex),
  );
  const cleanFallbackNumberFragments = tierSelection.fallbackFragments.filter((fragment) =>
    isCleanNumberFragment(fragment, difficultyBandIndex),
  );
  const fallbackFragments = uniqueTextItems([
    ...(
      tierSelection.fallbackFragments.length > 0
        ? [
            ...cleanCurrentNumberFragments,
            ...cleanSupportNumberFragments,
            ...cleanFallbackNumberFragments,
          ]
        : [
            ...numericClusters.filter((fragment) => isCleanNumberFragment(fragment, difficultyBandIndex)),
            ...dateAndTimePatterns.filter((fragment) => isCleanNumberFragment(fragment, difficultyBandIndex)),
            ...measurementPatterns.filter((fragment) => isCleanNumberFragment(fragment, difficultyBandIndex)),
            ...benchmarkNumberPatterns.filter((fragment) => isCleanNumberFragment(fragment, difficultyBandIndex)),
          ]
    ),
  ]);
  const anchorPool =
    cleanCurrentNumberFragments.length > 0
      ? cleanCurrentNumberFragments
      : fallbackFragments;
  const supportPool =
    cleanSupportNumberFragments.length > 0
      ? cleanSupportNumberFragments
      : fallbackFragments;
  const anchorCount = [2, 2, 3, 3, 4][difficultyBandIndex] ?? 3;
  const supportCount = [2, 3, 3, 4, 4][difficultyBandIndex] ?? 3;
  const leadingSegments = chooseTierShapedSpecialtyFragments({
    anchorPool,
    supportPool,
    fallbackPool: fallbackFragments,
    difficultyBandIndex,
    anchorCount: Math.min(anchorCount, anchorPool.length || anchorCount),
    supportCount: Math.min(supportCount, supportPool.length || supportCount),
    kind: "number",
    context,
  });
  const numpadLead =
    options.numpadPracticeEnabled &&
    options.keyboardLayoutId &&
    difficultyBandIndex >= 1
      ? createNumpadSequence()
      : null;

  return [
    numpadLead,
    ...(leadingSegments.length > 0 ? leadingSegments : [createNumericSequence(difficultyBandIndex)]),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildSymbolLesson(options: PassageGenerationOptions) {
  const difficultyBand = getDifficultyBand(options);
  const difficultyBandIndex = getDifficultyBandIndex(difficultyBand);
  const context = createPassageContext(
    buildRecentContentHistory({
      sessionRecords: options.recentSessions,
      languageId: options.languageId,
    }),
  );
  const tierSelection = collectTierFragments(symbolPatternTiers, difficultyBand, {
    activeCharacterSet: options.activeCharacterSet,
    languageId: options.languageId,
    punctuationEnabled: true,
  });
  const cleanCurrentSymbolFragments = tierSelection.currentFragments.filter(isCleanSymbolFragment);
  const cleanSupportSymbolFragments = tierSelection.supportFragments.filter(isCleanSymbolFragment);
  const cleanFallbackSymbolFragments = tierSelection.fallbackFragments.filter(isCleanSymbolFragment);
  const fallbackPatterns = uniqueTextItems([
    ...(
      tierSelection.fallbackFragments.length > 0
        ? [
            ...cleanCurrentSymbolFragments,
            ...cleanSupportSymbolFragments,
            ...cleanFallbackSymbolFragments,
          ]
        : [
            ...symbolPatternSequences.filter(isCleanSymbolFragment),
            ...punctuationClusters.filter(isCleanSymbolFragment),
          ]
    ),
  ]);
  const anchorPool =
    cleanCurrentSymbolFragments.length > 0
      ? cleanCurrentSymbolFragments
      : fallbackPatterns;
  const supportPool =
    cleanSupportSymbolFragments.length > 0
      ? cleanSupportSymbolFragments
      : fallbackPatterns;
  const anchorCount = [2, 2, 3, 3, 4][difficultyBandIndex] ?? 3;
  const supportCount = [2, 3, 3, 4, 4][difficultyBandIndex] ?? 3;
  const selectedPatterns = chooseTierShapedSpecialtyFragments({
    anchorPool,
    supportPool,
    fallbackPool: fallbackPatterns,
    difficultyBandIndex,
    anchorCount: Math.min(anchorCount, anchorPool.length || anchorCount),
    supportCount: Math.min(supportCount, supportPool.length || supportCount),
    kind: "symbol",
    context,
  });

  return (
    selectedPatterns.length > 0
      ? selectedPatterns
      : [createSymbolSequence(options.lessonBalance?.symbolShare ?? 0.08)]
  ).join(" ");
}

function buildMixedLesson(
  options: PassageGenerationOptions,
  history?: RecentContentHistory,
) {
  const difficultyBand = getDifficultyBand(options);
  const difficultyBandIndex = getDifficultyBandIndex(difficultyBand);
  const context = createPassageContext(history);
  const recoveryCharacters = options.recoveryCharacters ?? options.priorityCharacters;
  const reinforcementCharacters = options.reinforcementCharacters ?? options.priorityCharacters;
  const bridgeCharacters = options.bridgeCharacters ?? options.priorityCharacters;
  const newCharacters = options.newCharacters ?? options.explorationCharacters ?? [];
  const fluencyCharacters =
    options.fluencyCharacters ??
    options.stableReviewCharacters ??
    options.activeCharacterSet.slice(0, 8);
  const lexicon = buildLessonLexicon(
    options,
    uniqueCharacters([
      ...options.priorityCharacters,
      ...recoveryCharacters,
      ...reinforcementCharacters,
      ...bridgeCharacters,
      ...newCharacters,
    ]),
  );
  const adaptiveLessonPreference =
    options.adaptiveLessonPreference ??
    (difficultyBandIndex >= 3
      ? "quote-drills"
      : difficultyBandIndex >= 2
        ? "phrase-drills"
        : "common-words");
  const adaptiveNonLetterPressure = countAdaptiveNonLetterPressure(options);
  const restrainedAdaptivePunctuation = shouldUseRestrainedAdaptivePunctuation({
    languageId: options.languageId,
    difficultyBandIndex,
    adaptiveLessonPreference,
    nonLetterPressure: adaptiveNonLetterPressure,
  });
  const adaptiveSentenceEndings = restrainedAdaptivePunctuation
    ? getRestrainedAdaptiveSentenceEndingChoices()
    : getSentenceEndingChoices(options.languageId);
  const adaptivePhraseFragmentEndings = restrainedAdaptivePunctuation
    ? getRestrainedAdaptivePhraseFragmentEndings()
    : getPhraseFragmentEndings(options.languageId);
  const allowAdaptiveClausePunctuation = shouldAllowAdaptiveClausePunctuation({
    restrainedPunctuation: restrainedAdaptivePunctuation,
    adaptiveLessonPreference,
    nonLetterPressure: adaptiveNonLetterPressure,
  });
  const clauseSeparator = getLanguageClauseSeparator(options.languageId);
  const buildTeacherSentence = (words: string[]) => {
    if (words.length === 0) {
      return "";
    }

    const leadWords = words.slice(0, Math.max(3, Math.ceil(words.length * 0.55)));
    const tailWords = words.slice(leadWords.length);

    if (options.punctuationEnabled && allowAdaptiveClausePunctuation && tailWords.length > 0) {
      return `${capitalizeSentenceText(joinLanguageTokens(options.languageId, leadWords))}${clauseSeparator} ${joinLanguageTokens(options.languageId, tailWords)}${chooseRandomItem(
        adaptiveSentenceEndings,
      )}`;
    }

    return `${capitalizeSentenceText(joinLanguageTokens(options.languageId, words))}${chooseRandomItem(adaptiveSentenceEndings)}`;
  };
  const guidedRecoveryWords = buildNaturalWordRun({
    lexicon,
    context,
    targetCount: Math.max(6, Math.round(options.targetWordCount * 0.28)),
    focusCharacters: uniqueCharacters([
      ...recoveryCharacters,
      ...reinforcementCharacters,
      ...(options.hesitationCharacters ?? []).slice(0, 2),
      ...((options.confusionPairs ?? []).slice(0, 2).flatMap((pair) => [
        pair.expectedCharacter,
        pair.enteredCharacter,
      ]) ?? []),
    ]),
    clusterCharacters: uniqueCharacters([
      ...bridgeCharacters,
      ...reinforcementCharacters,
      ...fluencyCharacters,
    ]),
    languageId: options.languageId,
    activeCharacterSet: options.activeCharacterSet,
    bridgeCharacters,
    contentSourceBias: "real",
    difficultyBand,
    allowSyntheticFallback: false,
  });
  const guidedProgressWords = buildNaturalWordRun({
    lexicon,
    context,
    targetCount: Math.max(6, Math.round(options.targetWordCount * 0.26)),
    focusCharacters: uniqueCharacters([
      ...(options.explorationCharacters ?? []),
      ...newCharacters,
      ...(options.unlockPreviewCharacters ?? []),
      ...bridgeCharacters.slice(0, 3),
      ...fluencyCharacters.slice(0, 3),
    ]),
    clusterCharacters: uniqueCharacters([
      ...bridgeCharacters,
      ...fluencyCharacters,
      ...options.priorityCharacters,
    ]),
    languageId: options.languageId,
    activeCharacterSet: options.activeCharacterSet,
    bridgeCharacters,
    contentSourceBias: "real",
    difficultyBand,
    allowSyntheticFallback: false,
  });
  const guidedSentences = [
    buildTeacherSentence(guidedRecoveryWords),
    buildTeacherSentence(guidedProgressWords),
  ].filter((sentence) => sentence.trim().length > 0);
  const shouldLeadWithWords =
    adaptiveLessonPreference === "common-words" ||
    regressionSensitiveAdaptiveLesson(options, difficultyBandIndex);
  const adaptivePhraseSupport =
    lexicon.phraseFragments.length > 0
      ? chooseFreshFragment(lexicon.phraseFragments, context, options.languageId, {
          difficultyBand,
          fragmentKind: "phrase",
        })
      : null;
  if (adaptivePhraseSupport) {
    noteFragmentUsage(context, adaptivePhraseSupport, options.languageId);
  }
  const adaptiveBenchmarkSupport =
    lexicon.benchmarkSentences.length > 0 &&
    (adaptiveLessonPreference === "quote-drills" ||
      (adaptiveLessonPreference === "phrase-drills" &&
        difficultyBandIndex >= 3 &&
        options.targetWordCount >= 22))
      ? chooseFreshFragment(lexicon.benchmarkSentences, context, options.languageId, {
          difficultyBand,
          fragmentKind: "benchmark",
        })
      : null;
  if (adaptiveBenchmarkSupport) {
    noteFragmentUsage(context, adaptiveBenchmarkSupport, options.languageId);
  }
  const phraseLead = adaptivePhraseSupport
    ? `${capitalizeSentenceText(adaptivePhraseSupport)}${chooseRandomItem(
        adaptivePhraseFragmentEndings,
      )}`
    : "";
  const punctuationSupport =
    options.punctuationEnabled &&
    !adaptivePhraseSupport &&
    !adaptiveBenchmarkSupport &&
    adaptiveLessonPreference !== "common-words" &&
    !restrainedAdaptivePunctuation &&
    difficultyBandIndex >= 3 &&
    adaptiveNonLetterPressure >= 2
      ? buildIntentionalPunctuationSegment({
          languageId: options.languageId,
          lexicon,
          context,
          activeCharacterSet: options.activeCharacterSet,
          focusCharacters: options.priorityCharacters,
          bridgeCharacters,
          capitalizationEnabled: options.capitalizationEnabled,
          difficultyBand,
        })
      : "";
  const adaptiveSegments =
    adaptiveLessonPreference === "quote-drills"
      ? [
          adaptiveBenchmarkSupport ?? guidedSentences[0] ?? phraseLead,
          guidedSentences[1] ?? phraseLead,
          !restrainedAdaptivePunctuation ? phraseLead : "",
          punctuationSupport,
        ]
      : adaptiveLessonPreference === "phrase-drills"
        ? [
            phraseLead || guidedSentences[0] || "",
            guidedSentences[1] || guidedSentences[0] || "",
            !restrainedAdaptivePunctuation && difficultyBandIndex >= 3
              ? adaptiveBenchmarkSupport ?? punctuationSupport
              : "",
          ]
        : [guidedSentences[0] ?? phraseLead, guidedSentences[1] ?? phraseLead, punctuationSupport];

  return adaptiveSegments
    .filter((segment, index, segments) => {
      if (!segment || segment.trim().length === 0) {
        return false;
      }

      return segments.indexOf(segment) === index;
    })
    .join(" ");
}

function regressionSensitiveAdaptiveLesson(
  options: PassageGenerationOptions,
  difficultyBandIndex: number,
) {
  return (
    difficultyBandIndex <= 1 ||
    (options.recoveryCharacters?.length ?? 0) >= 2 ||
    (options.forgottenCharacters?.length ?? 0) > 0 ||
    (options.newCharacters?.length ?? 0) > 0
  );
}

function buildShellLesson(options: PassageGenerationOptions) {
  const difficultyBand = getDifficultyBand(options);
  const difficultyBandIndex = getDifficultyBandIndex(difficultyBand);
  const context = createPassageContext(
    buildRecentContentHistory({
      sessionRecords: options.recentSessions,
      languageId: options.languageId,
    }),
  );
  const tierSequenceSelection = collectTierFragments(shellCommandTierSequences, difficultyBand, {
    activeCharacterSet: options.activeCharacterSet,
    languageId: options.languageId,
    punctuationEnabled: true,
  });
  const tierTermSelection = collectTierFragments(shellCommandTermTiers, difficultyBand, {
    activeCharacterSet: options.activeCharacterSet,
    languageId: options.languageId,
    punctuationEnabled: true,
  });
  const fallbackSequences = uniqueTextItems([
    ...(
      tierSequenceSelection.fallbackFragments.length > 0
        ? [
            ...tierSequenceSelection.currentFragments,
            ...tierSequenceSelection.supportFragments,
            ...tierSequenceSelection.fallbackFragments,
          ]
        : [...shellCommandSequences, ...commandLineFragments, ...commandFlagPatterns]
    ),
  ]);
  const fallbackTerms = uniqueTextItems([
    ...(
      tierTermSelection.fallbackFragments.length > 0
        ? [
            ...tierTermSelection.currentFragments,
            ...tierTermSelection.supportFragments,
            ...tierTermSelection.fallbackFragments,
          ]
        : [...shellCommandTerms]
    ),
  ]);
  const anchorPool =
    tierSequenceSelection.currentFragments.length > 0
      ? tierSequenceSelection.currentFragments
      : fallbackSequences;
  const supportPool =
    tierSequenceSelection.supportFragments.length > 0
      ? tierSequenceSelection.supportFragments
      : fallbackSequences;
  const anchorCount = [2, 2, 3, 3, 4][difficultyBandIndex] ?? 3;
  const supportCount = [1, 2, 2, 3, 3][difficultyBandIndex] ?? 2;
  const shellWorkflow = chooseTierShapedSpecialtyFragments({
    anchorPool,
    supportPool,
    fallbackPool: fallbackSequences,
    difficultyBandIndex,
    anchorCount: Math.min(anchorCount, anchorPool.length || anchorCount),
    supportCount: Math.min(supportCount, supportPool.length || supportCount),
    kind: "shell",
    context,
  });
  const selectedTerms =
    fallbackTerms.length > 0
      ? sampleItems(
          fallbackTerms,
          Math.min([1, 2, 2, 3, 3][difficultyBandIndex] ?? 2, fallbackTerms.length),
        )
      : [];

  return {
    text: [...shellWorkflow, ...selectedTerms].join(" "),
    emphasizedCharacters: Array.from(
      new Set([
        ...options.priorityCharacters,
        ...(options.recoveryCharacters ?? []),
        ...(options.bridgeCharacters ?? []),
        "-",
        "/",
        "|",
      ]),
    ),
    contentMetrics: {
      difficultyBand,
      noveltyScore: 0,
      repetitionScore: 0,
      lexicalDiversity: 0,
      contentVariantId: "shell-workflow",
    },
  };
}

function buildCodeLesson(options: PassageGenerationOptions) {
  const programmerDrillPreset = getProgrammerDrillPreset(
    options.programmerDrillPresetId ?? getContentFamily(options.contentFamilyId).programmerPresetId,
  );

  if (programmerDrillPreset.id === "shell-commands") {
    return buildShellLesson(options);
  }

  const compatibleCodeClusters = collectCompatibleFragments(
    [
      ...programmerDrillPreset.fragments,
      ...programmerIdentifiers,
      ...programmerTokenGroups.data,
      ...codeSymbolPatterns,
    ],
    {
      activeCharacterSet: options.activeCharacterSet,
      languageId: options.languageId,
      punctuationEnabled: true,
    },
  ).filter((fragment) => !isShellLikeFragment(fragment));
  const difficultyBandIndex = getDifficultyBandIndex(getDifficultyBand(options));

  return {
    text: sampleItems(
      compatibleCodeClusters.length > 0
        ? compatibleCodeClusters
        : [...programmerDrillPreset.fragments, ...programmerTokenGroups.data],
      Math.max(4, Math.min(7, difficultyBandIndex + 4)),
    ).join(" "),
    emphasizedCharacters: Array.from(
      new Set([
        ...programmerDrillPreset.emphasisCharacters,
        ...options.priorityCharacters,
        ...(options.recoveryCharacters ?? []),
      ]),
    ),
    contentMetrics: {
      difficultyBand: getDifficultyBand(options),
      noveltyScore: 0,
      repetitionScore: 0,
      lexicalDiversity: 0,
      contentVariantId: "code-workflow",
    },
  };
}

const LATIN_TOKEN_PATTERN = /[\p{Script=Latin}][\p{Script=Latin}\p{N}_:/.-]*/gu;

function isTeacherLikeAdaptivePassage(text: string, languageId: string) {
  if (!isCleanNaturalLanguageFragment(text, languageId)) {
    return false;
  }

  if (getLanguageDefinition(languageId).scriptFamily === "latin") {
    return true;
  }

  return (text.match(LATIN_TOKEN_PATTERN) ?? []).length <= 1;
}

function scoreContentPurityPenalty(
  text: string,
  purityProfile: ReturnType<typeof getContentFamily>["purityProfile"],
  languageId: string,
  difficultyBandIndex: number,
) {
  switch (purityProfile) {
    case "natural-language":
      return isCleanNaturalLanguageFragment(text, languageId) ? 0 : 160;
    case "numbers":
      return isCleanNumberFragment(text, difficultyBandIndex) ? 0 : 160;
    case "symbols":
      return isCleanSymbolFragment(text) ? 0 : 160;
    case "shell":
      return isShellLikeFragment(text) ? 0 : 80;
    case "code":
      return isShellLikeFragment(text) ? 70 : 0;
    default:
      return 0;
  }
}

function buildPassageContentMetrics(options: {
  text: string;
  difficultyBand: ContentDifficultyBand;
  languageId: string;
  history: RecentContentHistory;
  contentVariantId: string;
}) {
  const tokens = tokenizePromptText(options.text, options.languageId);
  const uniqueTokenCount = new Set(tokens).size;
  const lexicalDiversity =
    tokens.length === 0 ? 0 : Number((uniqueTokenCount / Math.max(tokens.length, 1)).toFixed(2));
  const historySet = new Set(options.history.recentWords);
  const overlapCount = tokens.filter((token) => historySet.has(token)).length;
  const repeatedCount = tokens.length - uniqueTokenCount;
  const noveltyScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (1 - overlapCount / Math.max(tokens.length, 1)) * 68 +
          lexicalDiversity * 32,
      ),
    ),
  );
  const repetitionScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (repeatedCount / Math.max(tokens.length, 1)) * 55 +
          (overlapCount / Math.max(tokens.length, 1)) * 45,
      ),
    ),
  );

  return {
    difficultyBand: options.difficultyBand,
    noveltyScore,
    repetitionScore,
    lexicalDiversity,
    contentVariantId: options.contentVariantId,
  } satisfies SessionContentMetrics;
}

function scoreAdaptiveTeacherCandidate(
  candidate: GeneratedPassageCandidate,
  options: PassageGenerationOptions,
) {
  const difficultyBandIndex = getDifficultyBandIndex(getDifficultyBand(options));
  const adaptiveLessonPreference =
    options.adaptiveLessonPreference ??
    (difficultyBandIndex >= 3
      ? "quote-drills"
      : difficultyBandIndex >= 2
        ? "phrase-drills"
        : "common-words");
  const tokens = tokenizePromptText(candidate.text, options.languageId);
  const sentenceSegments = candidate.text
    .split(/[.!?؟。！？]+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const sentenceCount = sentenceSegments.length;
  const averageSentenceLength = tokens.length / Math.max(sentenceCount, 1);
  const punctuationCount = (candidate.text.match(/[^\p{L}\p{M}\p{N}\s]/gu) ?? []).length;
  const punctuationDensity = punctuationCount / Math.max(candidate.text.length, 1);
  const ornatePunctuationCount = (candidate.text.match(/[!?؟;:؛"'«»“”]/gu) ?? []).length;
  const maxReuseRatio = getMaxTokenReuseRatio(tokens);
  const sentenceOpeners = sentenceSegments
    .map((segment) => tokenizePromptText(segment, options.languageId)[0]?.toLowerCase() ?? "")
    .filter(Boolean);
  const repeatedSentenceOpeners = sentenceOpeners.length - new Set(sentenceOpeners).size;
  const desiredSentenceCount =
    adaptiveLessonPreference === "quote-drills"
      ? 3
      : adaptiveLessonPreference === "phrase-drills"
        ? 2
        : 2;
  const desiredSentenceLength =
    adaptiveLessonPreference === "quote-drills"
      ? 9.5
      : adaptiveLessonPreference === "phrase-drills"
        ? 8
        : 6.5;
  const clauseCount = (candidate.text.match(/[,;:،؛]/gu) ?? []).length;
  const controlLeakPenalty = isTeacherLikeAdaptivePassage(candidate.text, options.languageId) ? 0 : 120;
  const purityPenalty = scoreContentPurityPenalty(
    candidate.text,
    getContentFamily(options.contentFamilyId).purityProfile,
    options.languageId,
    difficultyBandIndex,
  );
  const punctuationPenaltyMultiplier =
    difficultyBandIndex <= 1
      ? 620
      : options.languageId === "persian" && difficultyBandIndex <= 2
        ? 540
        : 420;

  return (
    candidate.contentMetrics.noveltyScore * 0.85 -
    candidate.contentMetrics.repetitionScore * 2.1 +
    candidate.contentMetrics.lexicalDiversity * 30 -
    Math.abs(sentenceCount - desiredSentenceCount) * 18 -
    Math.abs(averageSentenceLength - desiredSentenceLength) * 4.8 -
    maxReuseRatio * 70 -
    punctuationDensity * punctuationPenaltyMultiplier -
    Math.max(0, clauseCount - Math.max(1, desiredSentenceCount - 1)) * 12 -
    repeatedSentenceOpeners * 14 -
    ornatePunctuationCount * (difficultyBandIndex <= 1 ? 18 : 8) -
    controlLeakPenalty -
    purityPenalty
  );
}

export function generatePracticePassage(options: PassageGenerationOptions): GeneratedPassage {
  const contentFamily = getContentFamily(options.contentFamilyId);
  const history = buildRecentContentHistory({
    sessionRecords: options.recentSessions,
    languageId: options.languageId,
  });
  const difficultyBand = getDifficultyBand(options);
  const emphasizedCharacters = Array.from(
    new Set([
      ...options.priorityCharacters,
      ...(options.newCharacters ?? []),
      ...(options.recoveryCharacters ?? []),
      ...(options.reinforcementCharacters ?? []),
      ...(options.bridgeCharacters ?? []),
      ...(options.hesitationCharacters ?? []),
      ...(options.explorationCharacters ?? []),
      ...(options.unlockPreviewCharacters ?? []),
      ...((options.confusionPairs ?? []).slice(0, 4).flatMap((pair) => [
        pair.expectedCharacter,
        pair.enteredCharacter,
      ]) ?? []),
    ]),
  );
  const buildCandidate = (): GeneratedPassageCandidate => {
    if (contentFamily.id === "quote-drills") {
      const text = buildQuoteLikeLesson(options, history);
      return {
        text,
        emphasizedCharacters,
        contentMetrics: buildPassageContentMetrics({
          text,
          difficultyBand,
          languageId: options.languageId,
          history,
          contentVariantId: "book-passage",
        }),
      };
    }

    if (contentFamily.id === "phrase-drills") {
      const text = buildSentenceLikeLesson(options, history);
      return {
        text,
        emphasizedCharacters,
        contentMetrics: buildPassageContentMetrics({
          text,
          difficultyBand,
          languageId: options.languageId,
          history,
          contentVariantId: "phrase-drill",
        }),
      };
    }

    if (contentFamily.id === "number-drills" || options.sessionFlavor === "numbers") {
      const text = buildNumberLesson(options);
      return {
        text,
        emphasizedCharacters,
        contentMetrics: buildPassageContentMetrics({
          text,
          difficultyBand,
          languageId: options.languageId,
          history,
          contentVariantId: "number-drill",
        }),
      };
    }

    if (contentFamily.id === "symbol-drills" || options.sessionFlavor === "symbols") {
      const text = buildSymbolLesson(options);
      return {
        text,
        emphasizedCharacters,
        contentMetrics: buildPassageContentMetrics({
          text,
          difficultyBand,
          languageId: options.languageId,
          history,
          contentVariantId: "symbol-drill",
        }),
      };
    }

    if (
      contentFamily.id === "code-drills" ||
      contentFamily.id === "shell-drills" ||
      options.sessionFlavor === "code"
    ) {
      const codeCandidate = buildCodeLesson(options);
      return {
        text: codeCandidate.text,
        emphasizedCharacters: codeCandidate.emphasizedCharacters,
        contentMetrics: buildPassageContentMetrics({
          text: codeCandidate.text,
          difficultyBand,
          languageId: options.languageId,
          history,
          contentVariantId: contentFamily.id === "shell-drills" ? "shell-workflow" : "code-workflow",
        }),
      };
    }

    const text =
      contentFamily.id === "adaptive-blend"
        ? buildMixedLesson(options, history)
        : buildPlainWordLesson(options, history);

    return {
      text,
      emphasizedCharacters,
      contentMetrics: buildPassageContentMetrics({
        text,
        difficultyBand,
        languageId: options.languageId,
        history,
        contentVariantId:
          contentFamily.id === "adaptive-blend"
            ? "adaptive-guided"
            : contentFamily.id === "pseudo-words"
              ? "pseudo-word"
              : "common-word",
      }),
    };
  };

  const candidates = Array.from({ length: 8 }, () => buildCandidate());
  const rankedCandidates = candidates.sort((left, right) => {
    if (contentFamily.id === "adaptive-blend") {
      return scoreAdaptiveTeacherCandidate(right, options) - scoreAdaptiveTeacherCandidate(left, options);
    }

    const leftTokenCount = tokenizePromptText(left.text, options.languageId).length;
    const rightTokenCount = tokenizePromptText(right.text, options.languageId).length;
    const leftScore =
      left.contentMetrics.noveltyScore * 1.35 -
      left.contentMetrics.repetitionScore * 1.6 +
      left.contentMetrics.lexicalDiversity * 36 +
      Math.min(leftTokenCount, Math.max(options.targetWordCount, 1)) * 0.22 -
      scoreContentPurityPenalty(
        left.text,
        contentFamily.purityProfile,
        options.languageId,
        getDifficultyBandIndex(difficultyBand),
      );
    const rightScore =
      right.contentMetrics.noveltyScore * 1.35 -
      right.contentMetrics.repetitionScore * 1.6 +
      right.contentMetrics.lexicalDiversity * 36 +
      Math.min(rightTokenCount, Math.max(options.targetWordCount, 1)) * 0.22 -
      scoreContentPurityPenalty(
        right.text,
        contentFamily.purityProfile,
        options.languageId,
        getDifficultyBandIndex(difficultyBand),
      );

    return rightScore - leftScore;
  });

  if (contentFamily.id === "adaptive-blend") {
    return (
      rankedCandidates.find((candidate) =>
        isTeacherLikeAdaptivePassage(candidate.text, options.languageId),
      ) ?? rankedCandidates[0]
    )!;
  }

  return rankedCandidates[0]!;
}
