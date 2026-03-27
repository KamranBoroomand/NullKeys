import type {
  ContentDifficultyBand,
} from "@/lib/scoring/session-models";

export type LanguageContentFamilyId =
  | "common-words"
  | "phrase-drills"
  | "quote-drills";
export type LanguageContentPackTier = "core" | "extended" | "deep" | "merged";

export interface PackedWordEntry {
  token: string;
  signature: string;
  length: number;
}

export interface PackedTextEntry {
  text: string;
  signature: string;
  openingToken: string;
  tokenCount: number;
  difficultyBand: ContentDifficultyBand;
}

export interface CommonWordsContentPack {
  packId: string;
  languageId: string;
  contentFamilyId: "common-words";
  tier?: LanguageContentPackTier;
  version: string;
  entryCount: number;
  stages: {
    foundational: PackedWordEntry[];
    developing: PackedWordEntry[];
    advanced: PackedWordEntry[];
  };
}

export interface TextContentPack {
  packId: string;
  languageId: string;
  contentFamilyId: "phrase-drills" | "quote-drills";
  tier?: LanguageContentPackTier;
  version: string;
  entryCount: number;
  entries: PackedTextEntry[];
}

export type LanguageContentPack = CommonWordsContentPack | TextContentPack;

export interface ContentPackManifestEntry {
  packId: string;
  languageId: string;
  contentFamilyId: LanguageContentFamilyId;
  tier: Exclude<LanguageContentPackTier, "merged">;
  version: string;
  path: string;
  sizeBytes: number;
  entryCount: number;
  stageCounts?: {
    foundational: number;
    developing: number;
    advanced: number;
  };
}

export interface ContentPackManifest {
  version: string;
  generatedAt: string;
  packs: ContentPackManifestEntry[];
}

export interface LoadedLanguageContentBundle {
  manifestVersion: string;
  languageId: string;
  commonWordsPack: CommonWordsContentPack | null;
  phrasePack: TextContentPack | null;
  quotePack: TextContentPack | null;
  loadedTiers: Partial<Record<LanguageContentFamilyId, Array<Exclude<LanguageContentPackTier, "merged">>>>;
}
