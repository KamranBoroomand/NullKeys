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
import { filterReadableNaturalFragments } from "@/features/adaptive-practice/passage-fragment-policy";
import {
  buildAllowedCharacterSet,
  buildPackWordSelection,
  buildTokenReuseLimit,
  buildWordFamilies,
  buildWordTransitionDiversity,
  capitalizeSentenceText,
  collectCompatiblePackedTexts,
  collectCompatiblePackedWords,
  collectCompatibleWords,
  countSharedCharacters,
  createsRepeatingLoop,
  getDifficultyBand,
  getLanguageClauseSeparator,
  joinLanguageTokens,
  looksLoopCollapsed,
  normalizeWord,
  noteWordUsage,
  scoreFragmentMachineryPenalty,
  selectFoundationalPersianWordPool,
  sharedPrefixLength,
  sharedSuffixLength,
  uniqueCharacters,
  uniquePackedWordEntries,
  uniqueWords,
  usesActiveCharacterSet,
  usesActiveCharacterSetInText,
  type LessonLexicon,
  type PassageContext,
  type PassageGenerationOptions,
  type WordFamily,
} from "@/features/adaptive-practice/passage-generation-policy";

export function buildLessonLexicon(options: PassageGenerationOptions, emphasisCharacters: string[]) {
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
  const rawCompatibleWords = packWordSelection
    ? collectCompatiblePackedWords(
        uniquePackedWordEntries([
          ...packWordSelection.preferredEntries,
          ...packWordSelection.allEntries.filter((entry) => realWordPool.includes(entry.token)),
        ]),
        allowedCharacters,
      )
    : collectCompatibleWords(realWordPool, options.activeCharacterSet);
  const rawBroaderCompatibleWords = packWordSelection
    ? collectCompatiblePackedWords(packWordSelection.allEntries, allowedCharacters)
    : collectCompatibleWords(languageDefinition.realWordBank, options.activeCharacterSet);
  const shouldUseCalmPersianWords = options.languageId === "persian" && difficultyBandIndex <= 1;
  const compatibleWords = shouldUseCalmPersianWords
    ? selectFoundationalPersianWordPool(rawCompatibleWords, options.targetWordCount)
    : rawCompatibleWords;
  const broaderCompatibleWords = shouldUseCalmPersianWords
    ? selectFoundationalPersianWordPool(rawBroaderCompatibleWords, options.targetWordCount)
    : rawBroaderCompatibleWords;
  const rawFallbackWords = uniqueWords(
    compatibleWords.length >= 6 ? compatibleWords : [...compatibleWords, ...broaderCompatibleWords],
  );
  const fallbackWords = shouldUseCalmPersianWords
    ? selectFoundationalPersianWordPool(rawFallbackWords, options.targetWordCount)
    : rawFallbackWords;
  const focusWords = (shouldUseCalmPersianWords
    ? selectFoundationalPersianWordPool(compatibleWords, options.targetWordCount)
    : compatibleWords
  ).filter((word) =>
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

export function scoreCandidateWord(options: {
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

export function chooseRelatedWord(options: {
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

export function chooseWordFamily(options: {
  families: WordFamily[];
  focusCharacters: string[];
  clusterCharacters: string[];
  context: PassageContext;
  targetCount: number;
}) {
  const familiesWithUnusedWords = options.families.filter((family) =>
    family.words.some((word) => !options.context.recentWords.includes(normalizeWord(word))),
  );
  const familyPool = familiesWithUnusedWords.length > 0 ? familiesWithUnusedWords : options.families;
  const weightedFamilies = familyPool
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

export function createPseudoWord(options: {
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

export function repairLoopingWordRun(options: {
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

export function buildNaturalWordRun(options: {
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

export function buildIntentionalPunctuationSegment(options: {
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
