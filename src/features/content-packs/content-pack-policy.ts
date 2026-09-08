import type { ContentDifficultyBand } from "@/lib/scoring/session-models";
import type {
  CommonWordsContentPack,
  ContentPackManifest,
  ContentPackManifestEntry,
  LanguageContentFamilyId,
  LanguageContentPack,
  LanguageContentPackTier,
  PackedTextEntry,
  PackedWordEntry,
  TextContentPack,
} from "@/features/content-packs/content-pack-types";
import { getLanguageDefinition } from "@/features/language-support/language-registry";
import { INLINE_WORD_CHARACTERS } from "@/lib/text/language-text-normalization";

const MAX_CONTENT_PACK_MANIFEST_ENTRIES = 512;
const MAX_CONTENT_PACK_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_CONTENT_PACK_ENTRY_COUNT = 25_000;
const WORD_INLINE_CHARACTERS = new Set(INLINE_WORD_CHARACTERS);

export const tierOrder = ["core", "extended", "deep"] as const;

export type StoredPackTier = Exclude<LanguageContentPackTier, "merged">;

export interface ContentPackSelectionOptions {
  languageId: string;
  contentFamilyId?: string;
  activeCharacterSet?: string[];
  punctuationEnabled?: boolean;
  difficultyBand?: ContentDifficultyBand;
  targetWordCount?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength = 4_096): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isValidManifestPath(value: unknown): value is string {
  return (
    isNonEmptyString(value, 256) &&
    value.startsWith("/content-packs/packs/") &&
    value.endsWith(".json") &&
    !value.includes("..") &&
    !value.includes("\\") &&
    !value.includes("?") &&
    !value.includes("#")
  );
}

function isValidContentPackManifestEntry(value: unknown): value is ContentPackManifestEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.packId, 160) &&
    isNonEmptyString(value.languageId, 80) &&
    (value.contentFamilyId === "common-words" ||
      value.contentFamilyId === "phrase-drills" ||
      value.contentFamilyId === "quote-drills") &&
    (value.tier === "core" || value.tier === "extended" || value.tier === "deep") &&
    isNonEmptyString(value.version, 120) &&
    isValidManifestPath(value.path) &&
    isNonNegativeInteger(value.sizeBytes) &&
    value.sizeBytes <= MAX_CONTENT_PACK_FILE_SIZE_BYTES &&
    isNonNegativeInteger(value.entryCount) &&
    value.entryCount <= MAX_CONTENT_PACK_ENTRY_COUNT
  );
}

export function isValidContentPackManifest(value: unknown): value is ContentPackManifest {
  return (
    isRecord(value) &&
    isNonEmptyString(value.version, 120) &&
    isNonEmptyString(value.generatedAt, 80) &&
    Number.isFinite(Date.parse(value.generatedAt)) &&
    Array.isArray(value.packs) &&
    value.packs.length <= MAX_CONTENT_PACK_MANIFEST_ENTRIES &&
    value.packs.every((entry) => isValidContentPackManifestEntry(entry))
  );
}

function isValidPackedWordEntry(value: unknown): value is PackedWordEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.token, 256) &&
    isNonEmptyString(value.signature, 256) &&
    isNonNegativeInteger(value.length)
  );
}

function isValidPackedTextEntry(value: unknown): value is PackedTextEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.text, 12_000) &&
    isNonEmptyString(value.signature, 12_000) &&
    isNonEmptyString(value.openingToken, 256) &&
    isNonNegativeInteger(value.tokenCount) &&
    (value.difficultyBand === "foundational" ||
      value.difficultyBand === "developing" ||
      value.difficultyBand === "fluent" ||
      value.difficultyBand === "advanced" ||
      value.difficultyBand === "expert-control")
  );
}

export function isValidLanguageContentPack(
  value: unknown,
  expectedEntry: ContentPackManifestEntry,
): value is LanguageContentPack {
  if (
    !isRecord(value) ||
    value.packId !== expectedEntry.packId ||
    value.languageId !== expectedEntry.languageId ||
    value.contentFamilyId !== expectedEntry.contentFamilyId ||
    value.version !== expectedEntry.version ||
    !isNonNegativeInteger(value.entryCount) ||
    value.entryCount > MAX_CONTENT_PACK_ENTRY_COUNT
  ) {
    return false;
  }

  if (expectedEntry.contentFamilyId === "common-words") {
    return (
      isRecord(value.stages) &&
      Array.isArray(value.stages.foundational) &&
      Array.isArray(value.stages.developing) &&
      Array.isArray(value.stages.advanced) &&
      value.stages.foundational.every((entry) => isValidPackedWordEntry(entry)) &&
      value.stages.developing.every((entry) => isValidPackedWordEntry(entry)) &&
      value.stages.advanced.every((entry) => isValidPackedWordEntry(entry))
    );
  }

  return Array.isArray(value.entries) && value.entries.every((entry) => isValidPackedTextEntry(entry));
}

export function createEmptyManifest(): ContentPackManifest {
  return {
    version: "unavailable",
    generatedAt: new Date(0).toISOString(),
    packs: [],
  };
}

export function buildAllowedCharacterSet(options: Pick<
  ContentPackSelectionOptions,
  "activeCharacterSet" | "languageId" | "punctuationEnabled"
>) {
  const languageDefinition = getLanguageDefinition(options.languageId);

  return new Set([
    ...(options.activeCharacterSet ?? []).map((character) => character.toLowerCase()),
    ...WORD_INLINE_CHARACTERS,
    ...(options.punctuationEnabled
      ? [...languageDefinition.punctuation, ...languageDefinition.quotes]
      : []),
  ]);
}

function usesPackedSignature(signature: string, allowedCharacters: Set<string>) {
  return Array.from(signature).every((character) => allowedCharacters.has(character));
}

function uniqueWordEntries(entries: readonly PackedWordEntry[]) {
  const seenTokens = new Set<string>();
  const uniqueEntries: PackedWordEntry[] = [];

  for (const entry of entries) {
    if (!seenTokens.has(entry.token)) {
      seenTokens.add(entry.token);
      uniqueEntries.push(entry);
    }
  }

  return uniqueEntries;
}

function uniqueTextEntries(entries: readonly PackedTextEntry[]) {
  const seenTexts = new Set<string>();
  const uniqueEntries: PackedTextEntry[] = [];

  for (const entry of entries) {
    if (!seenTexts.has(entry.text)) {
      seenTexts.add(entry.text);
      uniqueEntries.push(entry);
    }
  }

  return uniqueEntries;
}

export function mergeCommonWordPacks(
  languageId: string,
  manifestVersion: string,
  packs: readonly CommonWordsContentPack[],
) {
  if (packs.length === 0) {
    return null;
  }

  return {
    packId: `${languageId}:common-words:merged`,
    languageId,
    contentFamilyId: "common-words",
    tier: "merged",
    version: manifestVersion,
    entryCount: packs.reduce((sum, pack) => sum + pack.entryCount, 0),
    stages: {
      foundational: uniqueWordEntries(packs.flatMap((pack) => pack.stages.foundational)),
      developing: uniqueWordEntries(packs.flatMap((pack) => pack.stages.developing)),
      advanced: uniqueWordEntries(packs.flatMap((pack) => pack.stages.advanced)),
    },
  } satisfies CommonWordsContentPack;
}

export function mergeTextPacks(
  languageId: string,
  manifestVersion: string,
  contentFamilyId: "phrase-drills" | "quote-drills",
  packs: readonly TextContentPack[],
) {
  if (packs.length === 0) {
    return null;
  }

  return {
    packId: `${languageId}:${contentFamilyId}:merged`,
    languageId,
    contentFamilyId,
    tier: "merged",
    version: manifestVersion,
    entryCount: packs.reduce((sum, pack) => sum + pack.entryCount, 0),
    entries: uniqueTextEntries(packs.flatMap((pack) => pack.entries)),
  } satisfies TextContentPack;
}

export function countCompatibleCommonWordEntries(
  commonWordsPack: CommonWordsContentPack | null,
  allowedCharacters: Set<string> | null,
) {
  if (!commonWordsPack || !allowedCharacters) {
    return 0;
  }

  return [
    ...commonWordsPack.stages.foundational,
    ...commonWordsPack.stages.developing,
    ...commonWordsPack.stages.advanced,
  ].filter((entry) => usesPackedSignature(entry.signature, allowedCharacters)).length;
}

export function countCompatibleTextEntries(
  textPack: TextContentPack | null,
  allowedCharacters: Set<string> | null,
) {
  if (!textPack || !allowedCharacters) {
    return 0;
  }

  return textPack.entries.filter((entry) => usesPackedSignature(entry.signature, allowedCharacters))
    .length;
}

function getDifficultyBandIndex(difficultyBand?: ContentDifficultyBand) {
  switch (difficultyBand) {
    case "expert-control":
      return 4;
    case "advanced":
      return 3;
    case "fluent":
      return 2;
    case "developing":
      return 1;
    default:
      return 0;
  }
}

export function getBaseTiersForFamily(
  familyId: LanguageContentFamilyId,
  options: Pick<ContentPackSelectionOptions, "contentFamilyId" | "difficultyBand">,
): StoredPackTier[] {
  const difficultyBandIndex = getDifficultyBandIndex(options.difficultyBand);

  if (familyId === "quote-drills") {
    return difficultyBandIndex >= 2 ? ["core", "extended"] : ["core"];
  }

  if (familyId === "phrase-drills") {
    return difficultyBandIndex >= 3 ? ["core", "extended"] : ["core"];
  }

  if (
    familyId === "common-words" &&
    (options.contentFamilyId === "quote-drills" || difficultyBandIndex >= 3)
  ) {
    return ["core", "extended"];
  }

  return ["core"];
}

export function getRemainingHigherTiers(loadedTiers: readonly StoredPackTier[]) {
  return tierOrder.filter((tier) => !loadedTiers.includes(tier));
}

export function getRequiredWordCompatibilityThreshold(options: ContentPackSelectionOptions) {
  const baseThreshold = Math.max(24, Math.round((options.targetWordCount ?? 16) * 2.1));
  const difficultyBandIndex = getDifficultyBandIndex(options.difficultyBand);

  if (options.contentFamilyId === "quote-drills") {
    return baseThreshold + 12 + difficultyBandIndex * 4;
  }

  if (options.contentFamilyId === "phrase-drills" || options.contentFamilyId === "adaptive-blend") {
    return baseThreshold + 8 + difficultyBandIndex * 3;
  }

  return baseThreshold + difficultyBandIndex * 2;
}

export function getRequiredTextCompatibilityThreshold(
  contentFamilyId: "phrase-drills" | "quote-drills",
  options: ContentPackSelectionOptions,
) {
  if (contentFamilyId === "phrase-drills") {
    return Math.max(8, Math.round((options.targetWordCount ?? 18) / 2.5));
  }

  return Math.max(6, Math.round((options.targetWordCount ?? 24) / 5));
}

export function findManifestEntry(
  manifest: ContentPackManifest,
  languageId: string,
  contentFamilyId: LanguageContentFamilyId,
  tier: StoredPackTier,
) {
  return manifest.packs.find(
    (entry) =>
      entry.languageId === languageId &&
      entry.contentFamilyId === contentFamilyId &&
      entry.tier === tier,
  );
}
