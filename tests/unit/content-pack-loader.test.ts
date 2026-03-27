import type { ContentPackManifest } from "@/features/content-packs/content-pack-types";
import {
  flushScheduledContentPackWarmupsForTests,
  loadContentPackManifest,
  loadLanguageContentBundle,
  resetContentPackLoaderState,
} from "@/features/content-packs/content-pack-loader";
import {
  clearStoredHistory,
  listContentCacheEntries,
  readContentCacheEntry,
  saveContentCacheEntry,
} from "@/lib/persistence/session-repository";
import { installContentPackFetchMock, readPublicJson } from "./helpers/content-pack-test-helpers";

installContentPackFetchMock();

describe("content pack architecture", () => {
  beforeEach(async () => {
    resetContentPackLoaderState();
    await clearStoredHistory();
  });

  it("publishes tiered multilingual language-family packs with substantial seed-corpus depth", () => {
    const manifest = readPublicJson<ContentPackManifest>("/content-packs/manifest.json");
    const auditSummary = readPublicJson<{
      coverage: {
        totalPackCount: number;
        overlapLanguageCount: number;
        fullSupportLanguageCount: number;
        firstClassLanguageIds: string[];
        longTailLanguageIds: string[];
      };
      languages: Record<
        string,
        {
          seedWordCount: number;
          totalRankedWordCount: number;
          firstClassTarget?: boolean;
          supportTier?: string;
          qualifiesAsFullSupport?: boolean;
          supportStatus?: string;
          renderingStatus: {
            status: string;
            promptBoard: string;
            benchmarkReplay: string;
          };
          repetitionRobustness: {
            status: string;
            constrainedCharacterSetReady: boolean;
            foundationalPool: number;
            phrasePool: number;
            quotePool: number;
          };
          benchmarkReadiness: {
            status: string;
            supportsBenchmarks: boolean;
            quotePool: number;
          };
          progressionCoverage: {
            supportsBeginner: boolean;
            supportsIntermediate: boolean;
            supportsAdvanced: boolean;
            progressionPathStatus: string;
          };
          commonWords: {
            tiers: Record<string, number>;
            total: number;
            sourceOrigins?: string[];
          };
          phraseDrills: {
            tiers: Record<string, number>;
            total: number;
            sourceOrigins?: string[];
          };
          quoteDrills: {
            tiers: Record<string, number>;
            total: number;
            sourceOrigins?: string[];
          };
        }
      >;
    }>("/content-packs/audit-summary.json");
    const overlapLanguages = Object.values(auditSummary.languages).filter(
      (languageSummary) => languageSummary.seedWordCount >= 9000,
    );

    expect(manifest.version).toBeTruthy();
    expect(auditSummary.coverage.totalPackCount).toBeGreaterThanOrEqual(110);
    expect(manifest.packs.length).toBeGreaterThanOrEqual(110);
    expect(auditSummary.coverage.overlapLanguageCount).toBeGreaterThanOrEqual(31);
    expect(auditSummary.coverage.fullSupportLanguageCount).toBeGreaterThanOrEqual(7);
    expect(auditSummary.coverage.firstClassLanguageIds).toEqual(["english", "persian", "russian"]);
    expect(auditSummary.coverage.longTailLanguageIds).toContain("arabic");
    expect(overlapLanguages.length).toBeGreaterThanOrEqual(26);
    for (const languageSummary of Object.values(auditSummary.languages)) {
      expect(languageSummary.progressionCoverage.supportsBeginner).toBe(true);
      expect(languageSummary.progressionCoverage.supportsIntermediate).toBe(true);
      expect(languageSummary.progressionCoverage.supportsAdvanced).toBe(true);
      expect(languageSummary.progressionCoverage.progressionPathStatus).toBe("complete");
    }
    expect(auditSummary.languages.english.commonWords.total).toBeGreaterThanOrEqual(10_000);
    expect(auditSummary.languages.spanish.commonWords.total).toBeGreaterThanOrEqual(9_500);
    expect(auditSummary.languages.french.commonWords.total).toBeGreaterThanOrEqual(9_500);
    expect(auditSummary.languages.german.commonWords.total).toBeGreaterThanOrEqual(9_500);
    expect(auditSummary.languages.belarusian.commonWords.total).toBeGreaterThanOrEqual(9_500);
    expect(auditSummary.languages.belarusian.commonWords.total).toBeGreaterThanOrEqual(100);
    expect(auditSummary.languages.hindi.commonWords.total).toBeGreaterThanOrEqual(110);
    expect(auditSummary.languages.indonesian.commonWords.total).toBeGreaterThanOrEqual(90);
    expect(auditSummary.languages.english.phraseDrills.total).toBeGreaterThanOrEqual(10_200);
    expect(auditSummary.languages.english.quoteDrills.total).toBeGreaterThanOrEqual(8_200);
    expect(auditSummary.languages.spanish.quoteDrills.total).toBeGreaterThanOrEqual(2_000);
    expect(auditSummary.languages.french.quoteDrills.total).toBeGreaterThanOrEqual(1_000);
    expect(auditSummary.languages.german.quoteDrills.total).toBeGreaterThanOrEqual(1_000);
    expect(auditSummary.languages.persian.commonWords.total).toBeGreaterThanOrEqual(9_880);
    expect(auditSummary.languages.persian.phraseDrills.total).toBeGreaterThanOrEqual(980);
    expect(auditSummary.languages.persian.quoteDrills.total).toBeGreaterThanOrEqual(560);
    expect(auditSummary.languages.english.firstClassTarget).toBe(true);
    expect(auditSummary.languages.english.supportTier).toBe("first-class");
    expect(auditSummary.languages.english.renderingStatus.status).toBe("premium-verified");
    expect(auditSummary.languages.english.repetitionRobustness.status).toBe("premium");
    expect(auditSummary.languages.english.benchmarkReadiness.status).toBe("premium-ready");
    expect(auditSummary.languages.persian.firstClassTarget).toBe(true);
    expect(auditSummary.languages.persian.supportTier).toBe("first-class");
    expect(auditSummary.languages.persian.qualifiesAsFullSupport).toBe(true);
    expect(auditSummary.languages.persian.supportStatus).toBe("full-support");
    expect(auditSummary.languages.persian.renderingStatus.status).toBe("premium-verified");
    expect(auditSummary.languages.persian.renderingStatus.promptBoard).toBe("joined-script-rtl");
    expect(auditSummary.languages.persian.repetitionRobustness.status).toBe("premium");
    expect(auditSummary.languages.persian.repetitionRobustness.constrainedCharacterSetReady).toBe(
      true,
    );
    expect(auditSummary.languages.persian.benchmarkReadiness.status).toBe("premium-ready");
    expect(auditSummary.languages.persian.commonWords.sourceOrigins?.length).toBeGreaterThan(0);
    expect(auditSummary.languages.persian.phraseDrills.sourceOrigins?.length).toBeGreaterThan(0);
    expect(auditSummary.languages.persian.quoteDrills.sourceOrigins?.length).toBeGreaterThan(0);
    expect(auditSummary.languages.russian.phraseDrills.total).toBeGreaterThanOrEqual(880);
    expect(auditSummary.languages.russian.quoteDrills.total).toBeGreaterThanOrEqual(320);
    expect(auditSummary.languages.russian.firstClassTarget).toBe(true);
    expect(auditSummary.languages.russian.supportTier).toBe("first-class");
    expect(auditSummary.languages.russian.qualifiesAsFullSupport).toBe(true);
    expect(auditSummary.languages.russian.supportStatus).toBe("full-support");
    expect(auditSummary.languages.russian.renderingStatus.status).toBe("premium-verified");
    expect(auditSummary.languages.russian.renderingStatus.promptBoard).toBe("cyrillic-tuned");
    expect(auditSummary.languages.russian.repetitionRobustness.status).toBe("premium");
    expect(auditSummary.languages.russian.benchmarkReadiness.status).toBe("premium-ready");
    expect(auditSummary.languages.russian.commonWords.sourceOrigins?.length).toBeGreaterThan(0);
    expect(auditSummary.languages.russian.phraseDrills.sourceOrigins?.length).toBeGreaterThan(0);
    expect(auditSummary.languages.russian.quoteDrills.sourceOrigins?.length).toBeGreaterThan(0);
    expect(auditSummary.languages.spanish.supportTier).toBe("well-supported");
    expect(auditSummary.languages.belarusian.supportTier).toBe("long-tail");
    expect(auditSummary.languages.english.commonWords.tiers.core).toBeGreaterThanOrEqual(700);
    expect(auditSummary.languages.english.commonWords.tiers.extended).toBeGreaterThanOrEqual(1_400);
    expect(auditSummary.languages.english.commonWords.tiers.deep).toBeGreaterThanOrEqual(7_000);
    expect(
      manifest.packs.some(
        (pack) =>
          pack.languageId === "english" &&
          pack.contentFamilyId === "common-words" &&
          pack.tier === "deep",
      ),
    ).toBe(true);
    expect(
      manifest.packs.some(
        (pack) =>
          pack.languageId === "english" &&
          pack.contentFamilyId === "quote-drills" &&
          pack.tier === "core",
      ),
    ).toBe(true);
  });

  it("treats Persian, Russian, and Japanese adaptive-blend bundles as fully multi-family", async () => {
    const persianBundle = await loadLanguageContentBundle({
      languageId: "persian",
      contentFamilyId: "adaptive-blend",
      activeCharacterSet: Array.from("اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی،؛؟.:۰۱۲۳۴۵۶۷۸۹"),
      punctuationEnabled: true,
      difficultyBand: "developing",
      targetWordCount: 20,
      allowWarmup: false,
    });
    const russianBundle = await loadLanguageContentBundle({
      languageId: "russian",
      contentFamilyId: "adaptive-blend",
      activeCharacterSet: Array.from("абвгдеёжзийклмнопрстуфхцчшщъыьэюя.,!?;:"),
      punctuationEnabled: true,
      difficultyBand: "developing",
      targetWordCount: 20,
      allowWarmup: false,
    });
    const japaneseBundle = await loadLanguageContentBundle({
      languageId: "japanese",
      contentFamilyId: "adaptive-blend",
      activeCharacterSet: Array.from("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん。、「」！？・"),
      punctuationEnabled: true,
      difficultyBand: "developing",
      targetWordCount: 20,
      allowWarmup: false,
    });

    expect(persianBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(700);
    expect(persianBundle.phrasePack?.entryCount).toBeGreaterThanOrEqual(100);
    expect(persianBundle.quotePack?.entryCount).toBeGreaterThanOrEqual(48);
    expect(russianBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(700);
    expect(russianBundle.phrasePack?.entryCount).toBeGreaterThanOrEqual(100);
    expect(russianBundle.quotePack?.entryCount).toBeGreaterThanOrEqual(48);
    expect(japaneseBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(700);
    expect(japaneseBundle.phrasePack?.entryCount).toBeGreaterThanOrEqual(10);
    expect(japaneseBundle.quotePack?.entryCount).toBeGreaterThanOrEqual(10);
  });

  it("loads tiered packs, expands compatible pools, and persists them for offline reuse", async () => {
    const loadedBundle = await loadLanguageContentBundle({
      languageId: "english",
      contentFamilyId: "common-words",
      activeCharacterSet: Array.from("asetrlin"),
      targetWordCount: 16,
      difficultyBand: "foundational",
      allowWarmup: false,
    });
    const compatibleCoreCharacters = new Set(Array.from("asetrlin"));
    const compatibleWords = [
      ...(loadedBundle.commonWordsPack?.stages.foundational ?? []),
      ...(loadedBundle.commonWordsPack?.stages.developing ?? []),
      ...(loadedBundle.commonWordsPack?.stages.advanced ?? []),
    ].filter((entry) => Array.from(entry.token).every((character) => compatibleCoreCharacters.has(character)));

    expect(loadedBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(700);
    expect(compatibleWords.length).toBeGreaterThanOrEqual(24);
    expect(loadedBundle.loadedTiers["common-words"]?.length).toBeGreaterThanOrEqual(1);

    const cachedManifest = await readContentCacheEntry<ContentPackManifest>("content-pack:manifest");
    const cachedCommonWordsPack = await readContentCacheEntry<{
      entryCount: number;
    }>(`content-pack:${loadedBundle.manifestVersion}:english:common-words:core`);

    expect(cachedManifest?.version).toBe(loadedBundle.manifestVersion);
    expect(cachedCommonWordsPack?.entryCount).toBeGreaterThanOrEqual(700);

    resetContentPackLoaderState();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const offlineBundle = await loadLanguageContentBundle({
      languageId: "english",
      contentFamilyId: "common-words",
      activeCharacterSet: Array.from("asetrlin"),
      targetWordCount: 16,
      difficultyBand: "foundational",
      allowWarmup: false,
    });

    expect(offlineBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(700);
  });

  it("rejects manifests with unsafe pack paths instead of trusting them", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          version: "security-test",
          generatedAt: "2026-03-23T12:00:00.000Z",
          packs: [
            {
              packId: "english:common-words:core",
              languageId: "english",
              contentFamilyId: "common-words",
              tier: "core",
              version: "security-test",
              path: "https://evil.example/packs/english/common-words.core.json",
              sizeBytes: 512,
              entryCount: 1,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const manifest = await loadContentPackManifest();

    expect(manifest.version).toBe("unavailable");
    expect(manifest.packs).toEqual([]);
    expect(await readContentCacheEntry("content-pack:manifest")).toBeNull();
  });

  it("ignores malformed content-pack payloads instead of persisting them", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (resource) => {
      const pathname =
        typeof resource === "string"
          ? resource
          : resource instanceof URL
            ? resource.pathname
            : new URL(resource.url, "http://localhost").pathname;

      if (pathname === "/content-packs/manifest.json") {
        return new Response(
          JSON.stringify({
            version: "security-pack-test",
            generatedAt: "2026-03-23T12:00:00.000Z",
            packs: [
              {
                packId: "english:common-words:core",
                languageId: "english",
                contentFamilyId: "common-words",
                tier: "core",
                version: "security-pack-test",
                path: "/content-packs/packs/english/common-words.core.json",
                sizeBytes: 1_024,
                entryCount: 1,
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (pathname === "/content-packs/packs/english/common-words.core.json") {
        return new Response(
          JSON.stringify({
            packId: "english:common-words:core",
            languageId: "english",
            contentFamilyId: "common-words",
            version: "security-pack-test",
            entryCount: 1,
            stages: {
              foundational: "not-an-array",
              developing: [],
              advanced: [],
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return new Response("Not found", { status: 404 });
    });

    const bundle = await loadLanguageContentBundle({
      languageId: "english",
      contentFamilyId: "common-words",
      activeCharacterSet: Array.from("asetrlin"),
      targetWordCount: 16,
      difficultyBand: "foundational",
      allowWarmup: false,
    });

    expect(bundle.manifestVersion).toBe("security-pack-test");
    expect(bundle.commonWordsPack).toBeNull();
    expect(
      await readContentCacheEntry("content-pack:security-pack-test:english:common-words:core"),
    ).toBeNull();
  });

  it("warms nearby same-language packs after the first load", async () => {
    const loadedBundle = await loadLanguageContentBundle({
      languageId: "english",
      contentFamilyId: "common-words",
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      targetWordCount: 18,
      difficultyBand: "developing",
    });

    expect(loadedBundle.loadedTiers["common-words"]).toContain("core");

    await flushScheduledContentPackWarmupsForTests();

    const warmedPhraseCore = await readContentCacheEntry<{
      entryCount: number;
    }>(`content-pack:${loadedBundle.manifestVersion}:english:phrase-drills:core`);
    const warmedCommonDeep = await readContentCacheEntry<{
      entryCount: number;
    }>(`content-pack:${loadedBundle.manifestVersion}:english:common-words:deep`);

    expect(warmedPhraseCore?.entryCount).toBeGreaterThanOrEqual(100);
    expect(warmedCommonDeep?.entryCount).toBeGreaterThanOrEqual(7_000);
  });

  it("invalidates stale cached pack versions when a newer manifest is active", async () => {
    await saveContentCacheEntry("content-pack:stale-v1:english:common-words:core", {
      packId: "english:common-words:core",
      version: "stale-v1",
      entryCount: 12,
    });
    await saveContentCacheEntry("content-pack:stale-v1:english:phrase-drills:core", {
      packId: "english:phrase-drills:core",
      version: "stale-v1",
      entryCount: 6,
    });

    await loadLanguageContentBundle({
      languageId: "english",
      contentFamilyId: "common-words",
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      targetWordCount: 18,
      difficultyBand: "developing",
      allowWarmup: false,
    });

    const cacheEntries = await listContentCacheEntries();
    const cacheKeys = cacheEntries.map((entry) => entry.cacheKey);

    expect(cacheKeys).not.toContain("content-pack:stale-v1:english:common-words:core");
    expect(cacheKeys).not.toContain("content-pack:stale-v1:english:phrase-drills:core");
  });
});
