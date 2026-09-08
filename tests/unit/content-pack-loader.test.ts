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

  it("publishes only the three v1 language-family pack sets", () => {
    const manifest = readPublicJson<ContentPackManifest>("/content-packs/manifest.json");
    const auditSummary = readPublicJson<{
      coverage: {
        totalPackCount: number;
        commonWordPackCount: number;
        phrasePackCount: number;
        quotePackCount: number;
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
          corpusQuality: {
            automatedValidationPassed: boolean;
            humanEditorialReview: string;
            phraseDrills: {
              exactDuplicateCount: number;
              normalizedDuplicateCount: number;
              malformedWhitespaceCount: number;
              scriptViolationCount: number;
              lengthViolationCount: number;
              repeatedFourGramFraction: number;
              maximumOpeningFraction: number;
              metaVocabularyCount: number;
            };
            quoteDrills: {
              exactDuplicateCount: number;
              normalizedDuplicateCount: number;
              malformedWhitespaceCount: number;
              scriptViolationCount: number;
              lengthViolationCount: number;
              repeatedFourGramFraction: number;
              maximumOpeningFraction: number;
              metaVocabularyCount: number;
            };
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
    const releaseLanguageIds = ["english", "persian", "russian"];
    const expectedEntryCounts = {
      english: { commonWords: 153, phraseDrills: 24, quoteDrills: 18 },
      persian: { commonWords: 149, phraseDrills: 24, quoteDrills: 18 },
      russian: { commonWords: 137, phraseDrills: 24, quoteDrills: 18 },
    } as const;

    expect(manifest.version).toBe("2026-08-30-curated-corpus-v1");
    expect(auditSummary.coverage).toMatchObject({
      totalPackCount: 9,
      commonWordPackCount: 3,
      phrasePackCount: 3,
      quotePackCount: 3,
      overlapLanguageCount: 0,
      fullSupportLanguageCount: 3,
      firstClassLanguageIds: releaseLanguageIds,
      longTailLanguageIds: [],
    });
    expect(manifest.packs).toHaveLength(9);
    expect(Array.from(new Set(manifest.packs.map((pack) => pack.languageId))).sort()).toEqual(
      releaseLanguageIds,
    );
    expect(Object.keys(auditSummary.languages).sort()).toEqual(releaseLanguageIds);

    for (const languageId of releaseLanguageIds) {
      const languageSummary = auditSummary.languages[languageId];
      const expectedCounts = expectedEntryCounts[languageId as keyof typeof expectedEntryCounts];

      expect(languageSummary).toBeDefined();
      expect(languageSummary.seedWordCount).toBe(0);
      expect(languageSummary.firstClassTarget).toBe(true);
      expect(languageSummary.supportTier).toBe("first-class");
      expect(languageSummary.qualifiesAsFullSupport).toBe(true);
      expect(languageSummary.supportStatus).toBe("full-support");
      expect(languageSummary.progressionCoverage.progressionPathStatus).toBe("complete");
      expect(languageSummary.renderingStatus.status).toBe("configured");
      expect(languageSummary.repetitionRobustness).toMatchObject({
        status: "thresholds-met",
        constrainedCharacterSetReady: true,
        phrasePool: 24,
        quotePool: 18,
      });
      expect(languageSummary.benchmarkReadiness).toMatchObject({
        status: "supported",
        supportsBenchmarks: true,
        quotePool: 18,
      });
      expect(languageSummary.commonWords.total).toBe(expectedCounts.commonWords);
      expect(languageSummary.phraseDrills.total).toBe(expectedCounts.phraseDrills);
      expect(languageSummary.quoteDrills.total).toBe(expectedCounts.quoteDrills);
      expect(languageSummary.commonWords.sourceOrigins?.length).toBeGreaterThan(0);
      expect(languageSummary.phraseDrills.sourceOrigins?.length).toBeGreaterThan(0);
      expect(languageSummary.quoteDrills.sourceOrigins?.length).toBeGreaterThan(0);
      expect(languageSummary.corpusQuality.automatedValidationPassed).toBe(true);
      expect(languageSummary.corpusQuality.humanEditorialReview).toBe("not-recorded");

      for (const familyQuality of [
        languageSummary.corpusQuality.phraseDrills,
        languageSummary.corpusQuality.quoteDrills,
      ]) {
        expect(familyQuality).toMatchObject({
          exactDuplicateCount: 0,
          normalizedDuplicateCount: 0,
          malformedWhitespaceCount: 0,
          scriptViolationCount: 0,
          lengthViolationCount: 0,
          metaVocabularyCount: 0,
        });
        expect(familyQuality.repeatedFourGramFraction).toBeLessThanOrEqual(0.08);
        expect(familyQuality.maximumOpeningFraction).toBeLessThanOrEqual(0.2);
      }

      expect(
        manifest.packs.filter((pack) => pack.languageId === languageId),
      ).toHaveLength(3);
    }

    expect(auditSummary.languages.persian.renderingStatus.promptBoard).toBe(
      "joined-script-rtl",
    );
    expect(auditSummary.languages.russian.renderingStatus.promptBoard).toBe(
      "cyrillic-tuned",
    );
  });

  it("loads adaptive-blend bundles across every v1 language", async () => {
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
    const englishBundle = await loadLanguageContentBundle({
      languageId: "english",
      contentFamilyId: "adaptive-blend",
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz.,!?;:"),
      punctuationEnabled: true,
      difficultyBand: "developing",
      targetWordCount: 20,
      allowWarmup: false,
    });

    expect(persianBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(140);
    expect(persianBundle.phrasePack?.entryCount).toBe(24);
    expect(persianBundle.quotePack?.entryCount).toBe(18);
    expect(russianBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(80);
    expect(russianBundle.phrasePack?.entryCount).toBe(24);
    expect(russianBundle.quotePack?.entryCount).toBe(18);
    expect(englishBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(130);
    expect(englishBundle.phrasePack?.entryCount).toBe(24);
    expect(englishBundle.quotePack?.entryCount).toBe(18);
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

    expect(loadedBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(130);
    expect(compatibleWords.length).toBeGreaterThanOrEqual(24);
    expect(loadedBundle.loadedTiers["common-words"]?.length).toBeGreaterThanOrEqual(1);

    const cachedManifest = await readContentCacheEntry<ContentPackManifest>("content-pack:manifest");
    const cachedCommonWordsPack = await readContentCacheEntry<{
      entryCount: number;
    }>(`content-pack:${loadedBundle.manifestVersion}:english:common-words:core`);

    expect(cachedManifest?.version).toBe(loadedBundle.manifestVersion);
    expect(cachedCommonWordsPack?.entryCount).toBeGreaterThanOrEqual(130);

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

    expect(offlineBundle.commonWordsPack?.entryCount).toBeGreaterThanOrEqual(130);
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
    const warmedQuoteCore = await readContentCacheEntry<{
      entryCount: number;
    }>(`content-pack:${loadedBundle.manifestVersion}:english:quote-drills:core`);

    expect(warmedPhraseCore?.entryCount).toBe(24);
    expect(warmedQuoteCore?.entryCount).toBe(18);
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
