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
  getMaxTokenReuseRatio,
  normalizeFragmentKey,
  normalizeWord,
  noteWordUsage,
  scoreFragmentMachineryPenalty,
  uniqueTextItems,
  type PassageContext,
} from "@/features/adaptive-practice/passage-generation-policy";

const LATIN_TOKEN_PATTERN = /[\p{Script=Latin}][\p{Script=Latin}\p{N}_:/.-]*/gu;

export function createNumericSequence(difficultyBandIndex: number) {
  return shuffleItems(numericClusters.filter((fragment) => isCleanNumberFragment(fragment, difficultyBandIndex)))
    .slice(0, 5)
    .join(" ");
}

export function createNumpadSequence() {
  return shuffleItems(numpadDrillFragments)
    .slice(0, 2)
    .join(" ");
}

export function createSymbolSequence(symbolPressure: number) {
  return shuffleItems(punctuationClusters.filter(isCleanSymbolFragment))
    .slice(0, Math.max(3, Math.round(symbolPressure * 12)))
    .join(" ");
}

export function clamp(value: number, min: number, max: number) {
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

export function getAllowedNumberAlphaPattern(difficultyBandIndex: number) {
  return difficultyBandIndex <= 1
    ? FOUNDATIONAL_ALLOWED_NUMBER_ALPHA_TOKEN_PATTERN
    : ADVANCED_ALLOWED_NUMBER_ALPHA_TOKEN_PATTERN;
}

export function isCleanNumberFragment(fragment: string, difficultyBandIndex = 4) {
  if (DISALLOWED_NUMBER_LEXICAL_TOKEN_PATTERN.test(fragment)) {
    return false;
  }

  return (fragment.match(NUMBER_ALPHA_TOKEN_PATTERN) ?? []).every((token) =>
    getAllowedNumberAlphaPattern(difficultyBandIndex).test(token),
  );
}

export function isCleanSymbolFragment(fragment: string) {
  return !SYMBOL_IDENTIFIER_PATTERN.test(fragment) && !SYMBOL_ALPHA_NUMERIC_PATTERN.test(fragment);
}

export function isShellLikeFragment(fragment: string) {
  return SHELL_FRAGMENT_PATTERN.test(fragment);
}

export function isCodeLikeFragment(fragment: string) {
  return CODE_FRAGMENT_PATTERN.test(fragment);
}

export function isCleanNaturalLanguageFragment(fragment: string, languageId: string) {
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

export function startsWithConnector(fragment: string, languageId: string) {
  const trimmed = fragment.trim();

  if (languageId === "persian") {
    return /^(?:و|اما|یا|بعد|وقتی|اگر)\b/u.test(trimmed);
  }

  if (languageId === "russian") {
    return /^(?:и|но|или|потом|когда|если)\b/iu.test(trimmed);
  }

  return /^(?:and|but|or|then|while|because|if|when)\b/iu.test(trimmed);
}

export function scoreFragmentAbstractionPenalty(
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

export function isReadableNaturalFragment(options: {
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

export function filterReadableNaturalFragments(options: {
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

export function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

export function scoreSpecialtyFragmentComplexity(
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

export function collectTierShapedSpecialtyWindow(options: {
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

export function chooseTierShapedSpecialtyFragments(options: {
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

export function chooseFreshFragment(
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

export function fragmentOverlapRatio(leftFragment: string, rightFragment: string, languageId: string) {
  const leftTokens = tokenizePromptText(leftFragment, languageId).map(normalizeWord);
  const rightTokenSet = new Set(tokenizePromptText(rightFragment, languageId).map(normalizeWord));

  return leftTokens.filter((token) => rightTokenSet.has(token)).length / Math.max(leftTokens.length, 1);
}

export function fragmentsAreDistinctEnough(leftFragment: string, rightFragment: string, languageId: string) {
  const leftTokens = tokenizePromptText(leftFragment, languageId);
  const rightTokens = tokenizePromptText(rightFragment, languageId);

  return (
    leftTokens[0] !== rightTokens[0] &&
    fragmentOverlapRatio(leftFragment, rightFragment, languageId) < 0.55
  );
}

export function chooseDistinctFreshFragments(options: {
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

export function noteFragmentUsage(context: PassageContext, fragment: string, languageId: string) {
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
