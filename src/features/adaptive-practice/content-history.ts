import { getLanguageDefinition } from "@/features/language-support/language-registry";
import {
  normalizeFragmentKeyForLanguage,
  normalizeTokenForLanguage,
  tokenizeTextForLanguage,
} from "@/lib/text/language-text-normalization";
import type { SessionRecord } from "@/lib/scoring/session-models";

export interface RecentContentHistory {
  recentWords: string[];
  recentFamilyKeys: string[];
  usageCounts: Map<string, number>;
  recentContentFamilyIds: string[];
  fragmentUsageCounts: Map<string, number>;
  openingTokenCounts: Map<string, number>;
}

function deriveFamilyKeys(token: string, languageId: string) {
  const normalizedToken = normalizeTokenForLanguage(token, languageId).replace(
    /^[^\p{L}\p{N}\u200c]+|[^\p{L}\p{N}\u200c]+$/gu,
    "",
  );

  if (normalizedToken.length < 4) {
    return normalizedToken ? [`token:${normalizedToken}`] : [];
  }

  return [
    `prefix:${normalizedToken.slice(0, 3)}`,
    `suffix:${normalizedToken.slice(-3)}`,
  ];
}

export function tokenizePromptText(text: string, languageId: string) {
  const languageDefinition = getLanguageDefinition(languageId);

  const tokens = tokenizeTextForLanguage(text, languageId).filter((token) => token.length >= 2);

  if (languageDefinition.usesWordSpacing) {
    return tokens;
  }

  return tokens;
}

export function buildRecentContentHistory(options: {
  sessionRecords?: SessionRecord[];
  languageId: string;
}) {
  const recentWords: string[] = [];
  const recentFamilyKeys: string[] = [];
  const usageCounts = new Map<string, number>();
  const fragmentUsageCounts = new Map<string, number>();
  const openingTokenCounts = new Map<string, number>();
  const relevantSessions = (options.sessionRecords ?? [])
    .filter((sessionRecord) => sessionRecord.languageId === options.languageId)
    .slice(0, 24);

  for (const sessionRecord of relevantSessions) {
    const tokens = tokenizePromptText(sessionRecord.promptText, options.languageId);

    for (const token of tokens) {
      usageCounts.set(token, (usageCounts.get(token) ?? 0) + 1);
      recentWords.push(token);

      for (const familyKey of deriveFamilyKeys(token, options.languageId)) {
        recentFamilyKeys.push(familyKey);
      }
    }

    const fragments = sessionRecord.promptText
      .split(/[.!?؟。！？]+/u)
      .map((fragment) => fragment.trim())
      .filter(Boolean)
      .slice(0, 6);

    for (const fragment of fragments) {
      const normalizedFragment = normalizeFragmentKeyForLanguage(
        fragment,
        options.languageId,
      );
      fragmentUsageCounts.set(
        normalizedFragment,
        (fragmentUsageCounts.get(normalizedFragment) ?? 0) + 1,
      );

      const openingToken = tokenizePromptText(fragment, options.languageId)[0];
      if (openingToken) {
        openingTokenCounts.set(
          openingToken,
          (openingTokenCounts.get(openingToken) ?? 0) + 1,
        );
      }
    }
  }

  return {
    recentWords: recentWords.slice(-120),
    recentFamilyKeys: recentFamilyKeys.slice(-80),
    usageCounts,
    fragmentUsageCounts,
    openingTokenCounts,
    recentContentFamilyIds: relevantSessions
      .map((sessionRecord) => sessionRecord.contentFamilyId)
      .filter((contentFamilyId): contentFamilyId is string => Boolean(contentFamilyId))
      .slice(0, 16),
  } satisfies RecentContentHistory;
}
