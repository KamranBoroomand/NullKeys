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
  isCleanNaturalLanguageFragment,
  isCleanNumberFragment,
  isCleanSymbolFragment,
  isShellLikeFragment,
} from "@/features/adaptive-practice/passage-fragment-policy";
import {
  buildCodeLesson,
  buildMixedLesson,
  buildNumberLesson,
  buildPlainWordLesson,
  buildQuoteLikeLesson,
  buildSentenceLikeLesson,
  buildSymbolLesson,
} from "@/features/adaptive-practice/passage-lesson-builders";
import {
  getDifficultyBand,
  getMaxTokenReuseRatio,
  type GeneratedPassage,
  type GeneratedPassageCandidate,
  type PassageGenerationOptions,
} from "@/features/adaptive-practice/passage-generation-policy";

export type { GeneratedPassage, PassageGenerationOptions } from "@/features/adaptive-practice/passage-generation-policy";

const LATIN_TOKEN_PATTERN = /[\p{Script=Latin}][\p{Script=Latin}\p{N}_:/.-]*/gu;

function isTeacherLikeAdaptivePassage(text: string, languageId: string) {
  if (!isCleanNaturalLanguageFragment(text, languageId)) {
    return false;
  }

  const sentenceCount = text
    .split(/[.!?؟。！？]+/u)
    .map((segment) => segment.trim())
    .filter(Boolean).length;

  if (sentenceCount < 2) {
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
