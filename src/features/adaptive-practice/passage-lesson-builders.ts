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
import {
  chooseDistinctFreshFragments,
  chooseFreshFragment,
  chooseTierShapedSpecialtyFragments,
  collectTierShapedSpecialtyWindow,
  createNumericSequence,
  createNumpadSequence,
  createSymbolSequence,
  filterReadableNaturalFragments,
  isCleanNumberFragment,
  isCleanSymbolFragment,
  isShellLikeFragment,
  noteFragmentUsage,
} from "@/features/adaptive-practice/passage-fragment-policy";
import {
  buildIntentionalPunctuationSegment,
  buildLessonLexicon,
  buildNaturalWordRun,
} from "@/features/adaptive-practice/passage-natural-generator";
import {
  capitalizeSentenceText,
  collectCompatibleFragments,
  collectTierFragments,
  countAdaptiveNonLetterPressure,
  createPassageContext,
  getDifficultyBand,
  getLanguageClauseSeparator,
  getPhraseFragmentEndings,
  getRestrainedAdaptivePhraseFragmentEndings,
  getRestrainedAdaptiveSentenceEndingChoices,
  getSentenceEndingChoices,
  joinLanguageTokens,
  shouldAllowAdaptiveClausePunctuation,
  shouldUseRestrainedAdaptivePunctuation,
  uniqueCharacters,
  uniqueTextItems,
  type PassageGenerationOptions,
} from "@/features/adaptive-practice/passage-generation-policy";

export function buildSentenceLikeLesson(
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

export function buildPlainWordLesson(
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

export function buildQuoteLikeLesson(
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

export function buildNumberLesson(options: PassageGenerationOptions) {
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

export function buildSymbolLesson(options: PassageGenerationOptions) {
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

export function buildMixedLesson(
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

export function regressionSensitiveAdaptiveLesson(
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

export function buildShellLesson(options: PassageGenerationOptions) {
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

export function buildCodeLesson(options: PassageGenerationOptions) {
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
