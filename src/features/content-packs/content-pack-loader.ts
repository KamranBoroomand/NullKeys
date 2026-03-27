import type { ContentDifficultyBand } from "@/lib/scoring/session-models";
import type {
  CommonWordsContentPack,
  ContentPackManifest,
  ContentPackManifestEntry,
  LanguageContentFamilyId,
  LanguageContentPack,
  LanguageContentPackTier,
  LoadedLanguageContentBundle,
  PackedTextEntry,
  PackedWordEntry,
  TextContentPack,
} from "@/features/content-packs/content-pack-types";
import { getLanguageDefinition } from "@/features/language-support/language-registry";
import { INLINE_WORD_CHARACTERS } from "@/lib/text/language-text-normalization";
import {
  listContentCacheEntries,
  readContentCacheEntry,
  removeContentCacheEntries,
  saveContentCacheEntry,
} from "@/lib/persistence/session-repository";

const CONTENT_PACK_MANIFEST_PATH = "/content-packs/manifest.json";
const CONTENT_PACK_MANIFEST_CACHE_KEY = "content-pack:manifest";
const MAX_ACTIVE_PACK_CACHE_SIZE = 8;
const MAX_CONTENT_PACK_MANIFEST_ENTRIES = 512;
const MAX_CONTENT_PACK_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_CONTENT_PACK_ENTRY_COUNT = 25_000;
const WORD_INLINE_CHARACTERS = new Set(INLINE_WORD_CHARACTERS);
const tierOrder = ["core", "extended", "deep"] as const;

type StoredPackTier = Exclude<LanguageContentPackTier, "merged">;

interface ContentBundleLoadOptions {
  languageId: string;
  contentFamilyId?: string;
  activeCharacterSet?: string[];
  punctuationEnabled?: boolean;
  difficultyBand?: ContentDifficultyBand;
  targetWordCount?: number;
  allowWarmup?: boolean;
}

let manifestPromise: Promise<ContentPackManifest> | null = null;
const activePackCache = new Map<string, LanguageContentPack>();
const pendingWarmupPackIds = new Set<string>();
const pendingWarmupPromises = new Set<Promise<void>>();

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

function isValidContentPackManifest(value: unknown): value is ContentPackManifest {
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

function isValidLanguageContentPack(
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

function createEmptyManifest(): ContentPackManifest {
  return {
    version: "unavailable",
    generatedAt: new Date(0).toISOString(),
    packs: [],
  };
}

function buildPackCacheKey(manifestVersion: string, packId: string) {
  return `content-pack:${manifestVersion}:${packId}`;
}

function rememberActivePack(memoryCacheKey: string, pack: LanguageContentPack) {
  if (activePackCache.has(memoryCacheKey)) {
    activePackCache.delete(memoryCacheKey);
  }

  activePackCache.set(memoryCacheKey, pack);

  while (activePackCache.size > MAX_ACTIVE_PACK_CACHE_SIZE) {
    const oldestCacheKey = activePackCache.keys().next().value;

    if (!oldestCacheKey) {
      break;
    }

    activePackCache.delete(oldestCacheKey);
  }
}

function clearStaleActivePacks(activeManifestVersion: string) {
  for (const cacheKey of activePackCache.keys()) {
    if (!cacheKey.startsWith(`${activeManifestVersion}:`)) {
      activePackCache.delete(cacheKey);
    }
  }
}

async function fetchJson<T>(resourcePath: string) {
  const response = await fetch(resourcePath, {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${resourcePath}: ${response.status}`);
  }

  return (await response.json()) as T;
}

function buildAllowedCharacterSet(options: Pick<
  ContentBundleLoadOptions,
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
    if (seenTokens.has(entry.token)) {
      continue;
    }

    seenTokens.add(entry.token);
    uniqueEntries.push(entry);
  }

  return uniqueEntries;
}

function uniqueTextEntries(entries: readonly PackedTextEntry[]) {
  const seenTexts = new Set<string>();
  const uniqueEntries: PackedTextEntry[] = [];

  for (const entry of entries) {
    if (seenTexts.has(entry.text)) {
      continue;
    }

    seenTexts.add(entry.text);
    uniqueEntries.push(entry);
  }

  return uniqueEntries;
}

function mergeCommonWordPacks(
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
      foundational: uniqueWordEntries(
        packs.flatMap((pack) => pack.stages.foundational),
      ),
      developing: uniqueWordEntries(
        packs.flatMap((pack) => pack.stages.developing),
      ),
      advanced: uniqueWordEntries(packs.flatMap((pack) => pack.stages.advanced)),
    },
  } satisfies CommonWordsContentPack;
}

function mergeTextPacks(
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

function countCompatibleCommonWordEntries(
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

function countCompatibleTextEntries(
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

function getBaseTiersForFamily(
  familyId: LanguageContentFamilyId,
  options: Pick<ContentBundleLoadOptions, "contentFamilyId" | "difficultyBand">,
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

function getRemainingHigherTiers(loadedTiers: readonly StoredPackTier[]) {
  return tierOrder.filter((tier) => !loadedTiers.includes(tier));
}

function getRequiredWordCompatibilityThreshold(options: ContentBundleLoadOptions) {
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

function getRequiredTextCompatibilityThreshold(
  contentFamilyId: "phrase-drills" | "quote-drills",
  options: ContentBundleLoadOptions,
) {
  if (contentFamilyId === "phrase-drills") {
    return Math.max(8, Math.round((options.targetWordCount ?? 18) / 2.5));
  }

  return Math.max(6, Math.round((options.targetWordCount ?? 24) / 5));
}

function findManifestEntry(
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

async function pruneStaleContentPackCaches(activeManifestVersion: string) {
  clearStaleActivePacks(activeManifestVersion);
  const cacheEntries = await listContentCacheEntries();
  const staleCacheKeys = cacheEntries
    .map((entry) => entry.cacheKey)
    .filter(
      (cacheKey) =>
        cacheKey.startsWith("content-pack:") &&
        cacheKey !== CONTENT_PACK_MANIFEST_CACHE_KEY &&
        !cacheKey.startsWith(`content-pack:${activeManifestVersion}:`),
    );

  await removeContentCacheEntries(staleCacheKeys);
}

export function getRequiredLanguageContentPackFamilies(
  contentFamilyId?: string,
): LanguageContentFamilyId[] {
  switch (contentFamilyId) {
    case "common-words":
    case "pseudo-words":
    case undefined:
      return ["common-words"];
    case "adaptive-blend":
      return ["common-words", "phrase-drills", "quote-drills"];
    case "phrase-drills":
      return ["common-words", "phrase-drills"];
    case "quote-drills":
      return ["common-words", "phrase-drills", "quote-drills"];
    default:
      return [];
  }
}

export async function loadContentPackManifest() {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      const cachedManifest = await readContentCacheEntry<unknown>(
        CONTENT_PACK_MANIFEST_CACHE_KEY,
      );
      const validatedCachedManifest = isValidContentPackManifest(cachedManifest)
        ? cachedManifest
        : null;

      if (cachedManifest && !validatedCachedManifest) {
        await removeContentCacheEntries([CONTENT_PACK_MANIFEST_CACHE_KEY]);
      }

      try {
        const nextManifest = await fetchJson<unknown>(CONTENT_PACK_MANIFEST_PATH);

        if (!isValidContentPackManifest(nextManifest)) {
          throw new Error("Invalid content-pack manifest.");
        }

        await saveContentCacheEntry(CONTENT_PACK_MANIFEST_CACHE_KEY, nextManifest);
        await pruneStaleContentPackCaches(nextManifest.version);
        return nextManifest;
      } catch {
        if (validatedCachedManifest) {
          await pruneStaleContentPackCaches(validatedCachedManifest.version);
          return validatedCachedManifest;
        }

        return createEmptyManifest();
      }
    })();
  }

  return manifestPromise;
}

async function loadSingleContentPack(
  manifestVersion: string,
  entry: ContentPackManifestEntry | undefined,
  options?: {
    cacheOnly?: boolean;
  },
) {
  if (!entry) {
    return null;
  }

  const memoryCacheKey = `${manifestVersion}:${entry.packId}`;
  const cachedActivePack = activePackCache.get(memoryCacheKey);

  if (cachedActivePack) {
    rememberActivePack(memoryCacheKey, cachedActivePack);
    return cachedActivePack;
  }

  const persistentCacheKey = buildPackCacheKey(manifestVersion, entry.packId);
  const cachedPack = await readContentCacheEntry<unknown>(persistentCacheKey);
  const validatedCachedPack =
    cachedPack && isValidLanguageContentPack(cachedPack, entry) ? cachedPack : null;

  if (cachedPack && !validatedCachedPack) {
    await removeContentCacheEntries([persistentCacheKey]);
  }

  if (validatedCachedPack) {
    rememberActivePack(memoryCacheKey, validatedCachedPack);
    return validatedCachedPack;
  }

  if (options?.cacheOnly) {
    return null;
  }

  try {
    const nextPack = await fetchJson<unknown>(entry.path);

    if (!isValidLanguageContentPack(nextPack, entry)) {
      throw new Error("Invalid content pack.");
    }

    await saveContentCacheEntry(persistentCacheKey, nextPack);
    rememberActivePack(memoryCacheKey, nextPack);
    return nextPack;
  } catch {
    if (validatedCachedPack) {
      rememberActivePack(memoryCacheKey, validatedCachedPack);
      return validatedCachedPack;
    }

    return null;
  }
}

async function loadFamilyPacks(options: {
  manifest: ContentPackManifest;
  languageId: string;
  contentFamilyId: LanguageContentFamilyId;
  tiers: readonly StoredPackTier[];
  cacheOnly?: boolean;
}) {
  const packs = (
    await Promise.all(
      options.tiers.map((tier) =>
        loadSingleContentPack(
          options.manifest.version,
          findManifestEntry(options.manifest, options.languageId, options.contentFamilyId, tier),
          {
            cacheOnly: options.cacheOnly,
          },
        ),
      ),
    )
  ).filter(Boolean) as LanguageContentPack[];

  return packs
    .slice()
    .sort(
      (leftPack, rightPack) =>
        tierOrder.indexOf((leftPack.tier ?? "core") as StoredPackTier) -
        tierOrder.indexOf((rightPack.tier ?? "core") as StoredPackTier),
    );
}

function appendUniquePacks(
  existingPacks: readonly LanguageContentPack[],
  nextPacks: readonly LanguageContentPack[],
) {
  const existingPackIds = new Set(existingPacks.map((pack) => pack.packId));

  return [
    ...existingPacks,
    ...nextPacks.filter((pack) => !existingPackIds.has(pack.packId)),
  ].sort(
    (leftPack, rightPack) =>
      tierOrder.indexOf((leftPack.tier ?? "core") as StoredPackTier) -
      tierOrder.indexOf((rightPack.tier ?? "core") as StoredPackTier),
  );
}

function collectLoadedTiers(packs: readonly LanguageContentPack[]) {
  return packs
    .map((pack) => pack.tier)
    .filter((tier): tier is StoredPackTier => tier === "core" || tier === "extended" || tier === "deep");
}

function createLoadedBundle(options: {
  manifestVersion: string;
  languageId: string;
  commonWordPacks: readonly LanguageContentPack[];
  phrasePacks: readonly LanguageContentPack[];
  quotePacks: readonly LanguageContentPack[];
}) {
  return {
    manifestVersion: options.manifestVersion,
    languageId: options.languageId,
    commonWordsPack: mergeCommonWordPacks(
      options.languageId,
      options.manifestVersion,
      options.commonWordPacks as CommonWordsContentPack[],
    ),
    phrasePack: mergeTextPacks(
      options.languageId,
      options.manifestVersion,
      "phrase-drills",
      options.phrasePacks as TextContentPack[],
    ),
    quotePack: mergeTextPacks(
      options.languageId,
      options.manifestVersion,
      "quote-drills",
      options.quotePacks as TextContentPack[],
    ),
    loadedTiers: {
      "common-words": collectLoadedTiers(options.commonWordPacks),
      "phrase-drills": collectLoadedTiers(options.phrasePacks),
      "quote-drills": collectLoadedTiers(options.quotePacks),
    },
  } satisfies LoadedLanguageContentBundle;
}

function getWarmupPlan(options: {
  manifest: ContentPackManifest;
  languageId: string;
  contentFamilyId?: string;
  loadedTiers: LoadedLanguageContentBundle["loadedTiers"];
}) {
  const prioritizedFamilies: LanguageContentFamilyId[] =
    options.contentFamilyId === "quote-drills"
      ? ["quote-drills", "phrase-drills", "common-words"]
      : options.contentFamilyId === "phrase-drills"
        ? ["phrase-drills", "quote-drills", "common-words"]
        : ["common-words", "phrase-drills", "quote-drills"];
  const entries: ContentPackManifestEntry[] = [];

  for (const contentFamilyId of prioritizedFamilies) {
    const loadedTiers = options.loadedTiers[contentFamilyId] ?? [];
    const desiredWarmupTiers =
      contentFamilyId === "common-words"
        ? getRemainingHigherTiers(loadedTiers)
        : loadedTiers.includes("core")
          ? getRemainingHigherTiers(loadedTiers)
          : (["core", "extended"] as StoredPackTier[]);

    for (const tier of desiredWarmupTiers) {
      const entry = findManifestEntry(options.manifest, options.languageId, contentFamilyId, tier);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

function scheduleIdleCallback(callback: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(() => callback(), {
      timeout: 900,
    });
    return;
  }

  setTimeout(callback, 45);
}

async function warmPackEntry(
  manifestVersion: string,
  entry: ContentPackManifestEntry,
) {
  await loadSingleContentPack(manifestVersion, entry);
}

export function scheduleLanguageContentWarmup(options: {
  manifest: ContentPackManifest;
  languageId: string;
  contentFamilyId?: string;
  loadedTiers: LoadedLanguageContentBundle["loadedTiers"];
}) {
  const warmupEntries = getWarmupPlan(options).filter((entry) => !pendingWarmupPackIds.has(entry.packId));

  if (warmupEntries.length === 0) {
    return;
  }

  for (const entry of warmupEntries) {
    pendingWarmupPackIds.add(entry.packId);
  }

  const warmupPromise = new Promise<void>((resolve) => {
    scheduleIdleCallback(() => {
      void (async () => {
        for (const entry of warmupEntries) {
          try {
            await warmPackEntry(options.manifest.version, entry);
          } finally {
            pendingWarmupPackIds.delete(entry.packId);
          }
        }

        resolve();
      })();
    });
  });

  pendingWarmupPromises.add(warmupPromise);
  void warmupPromise.finally(() => {
    pendingWarmupPromises.delete(warmupPromise);
  });
}

export async function flushScheduledContentPackWarmupsForTests() {
  await Promise.all(Array.from(pendingWarmupPromises));
}

export async function loadLanguageContentBundle(
  options: ContentBundleLoadOptions,
): Promise<LoadedLanguageContentBundle> {
  const requiredFamilies = getRequiredLanguageContentPackFamilies(options.contentFamilyId);

  if (requiredFamilies.length === 0) {
    return {
      manifestVersion: "not-required",
      languageId: options.languageId,
      commonWordsPack: null,
      phrasePack: null,
      quotePack: null,
      loadedTiers: {
        "common-words": [],
        "phrase-drills": [],
        "quote-drills": [],
      },
    } satisfies LoadedLanguageContentBundle;
  }

  const manifest = await loadContentPackManifest();
  const allowedCharacters =
    options.activeCharacterSet && options.activeCharacterSet.length > 0
      ? buildAllowedCharacterSet({
          activeCharacterSet: options.activeCharacterSet,
          languageId: options.languageId,
          punctuationEnabled: options.punctuationEnabled,
        })
      : null;
  let commonWordPacks: LanguageContentPack[] = [];
  let phrasePacks: LanguageContentPack[] = [];
  let quotePacks: LanguageContentPack[] = [];

  for (const contentFamilyId of requiredFamilies) {
    const baseTiers = getBaseTiersForFamily(contentFamilyId, options);
    const basePacks = await loadFamilyPacks({
      manifest,
      languageId: options.languageId,
      contentFamilyId,
      tiers: baseTiers,
    });
    const cachedWarmPacks = await loadFamilyPacks({
      manifest,
      languageId: options.languageId,
      contentFamilyId,
      tiers: getRemainingHigherTiers(baseTiers),
      cacheOnly: true,
    });
    const combinedPacks = appendUniquePacks(basePacks, cachedWarmPacks);

    if (contentFamilyId === "common-words") {
      commonWordPacks = combinedPacks;
    } else if (contentFamilyId === "phrase-drills") {
      phrasePacks = combinedPacks;
    } else if (contentFamilyId === "quote-drills") {
      quotePacks = combinedPacks;
    }
  }

  let loadedBundle = createLoadedBundle({
    manifestVersion: manifest.version,
    languageId: options.languageId,
    commonWordPacks,
    phrasePacks,
    quotePacks,
  });

  if (requiredFamilies.includes("common-words") && allowedCharacters) {
    const requiredWordCompatibilityThreshold = getRequiredWordCompatibilityThreshold(options);

    while (
      countCompatibleCommonWordEntries(loadedBundle.commonWordsPack, allowedCharacters) <
        requiredWordCompatibilityThreshold &&
      loadedBundle.loadedTiers["common-words"]?.length !== tierOrder.length
    ) {
      const nextTier = getRemainingHigherTiers(
        loadedBundle.loadedTiers["common-words"] ?? [],
      )[0];

      if (!nextTier) {
        break;
      }

      const previousPackCount = commonWordPacks.length;
      commonWordPacks = appendUniquePacks(
        commonWordPacks,
        await loadFamilyPacks({
          manifest,
          languageId: options.languageId,
          contentFamilyId: "common-words",
          tiers: [nextTier],
        }),
      );
      if (commonWordPacks.length === previousPackCount) {
        break;
      }
      loadedBundle = createLoadedBundle({
        manifestVersion: manifest.version,
        languageId: options.languageId,
        commonWordPacks,
        phrasePacks,
        quotePacks,
      });
    }
  }

  if (requiredFamilies.includes("phrase-drills") && allowedCharacters) {
    const requiredPhraseCompatibilityThreshold = getRequiredTextCompatibilityThreshold(
      "phrase-drills",
      options,
    );

    while (
      countCompatibleTextEntries(loadedBundle.phrasePack, allowedCharacters) <
        requiredPhraseCompatibilityThreshold &&
      loadedBundle.loadedTiers["phrase-drills"]?.length !== tierOrder.length
    ) {
      const nextTier = getRemainingHigherTiers(
        loadedBundle.loadedTiers["phrase-drills"] ?? [],
      )[0];

      if (!nextTier) {
        break;
      }

      const previousPackCount = phrasePacks.length;
      phrasePacks = appendUniquePacks(
        phrasePacks,
        await loadFamilyPacks({
          manifest,
          languageId: options.languageId,
          contentFamilyId: "phrase-drills",
          tiers: [nextTier],
        }),
      );
      if (phrasePacks.length === previousPackCount) {
        break;
      }
      loadedBundle = createLoadedBundle({
        manifestVersion: manifest.version,
        languageId: options.languageId,
        commonWordPacks,
        phrasePacks,
        quotePacks,
      });
    }
  }

  if (requiredFamilies.includes("quote-drills") && allowedCharacters) {
    const requiredQuoteCompatibilityThreshold = getRequiredTextCompatibilityThreshold(
      "quote-drills",
      options,
    );

    while (
      countCompatibleTextEntries(loadedBundle.quotePack, allowedCharacters) <
        requiredQuoteCompatibilityThreshold &&
      loadedBundle.loadedTiers["quote-drills"]?.length !== tierOrder.length
    ) {
      const nextTier = getRemainingHigherTiers(
        loadedBundle.loadedTiers["quote-drills"] ?? [],
      )[0];

      if (!nextTier) {
        break;
      }

      const previousPackCount = quotePacks.length;
      quotePacks = appendUniquePacks(
        quotePacks,
        await loadFamilyPacks({
          manifest,
          languageId: options.languageId,
          contentFamilyId: "quote-drills",
          tiers: [nextTier],
        }),
      );
      if (quotePacks.length === previousPackCount) {
        break;
      }
      loadedBundle = createLoadedBundle({
        manifestVersion: manifest.version,
        languageId: options.languageId,
        commonWordPacks,
        phrasePacks,
        quotePacks,
      });
    }
  }

  if (options.allowWarmup !== false) {
    scheduleLanguageContentWarmup({
      manifest,
      languageId: options.languageId,
      contentFamilyId: options.contentFamilyId,
      loadedTiers: loadedBundle.loadedTiers,
    });
  }

  return loadedBundle;
}

export function resetContentPackLoaderState() {
  manifestPromise = null;
  activePackCache.clear();
  pendingWarmupPackIds.clear();
  pendingWarmupPromises.clear();
}
