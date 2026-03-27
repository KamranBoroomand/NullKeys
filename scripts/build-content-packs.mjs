import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const contentPackVersion =
  process.env.NULLKEYS_CONTENT_PACK_VERSION ?? "2026-03-17-public-corpus-v3";
const contentPackRootPath = path.resolve(process.cwd(), "public/content-packs");
const packOutputRootPath = path.join(contentPackRootPath, "packs");
const manifestOutputPath = path.join(contentPackRootPath, "manifest.json");
const auditOutputPath = path.join(contentPackRootPath, "audit-summary.json");
const auditMarkdownOutputPath = path.join(contentPackRootPath, "audit-summary.md");
const seedContentSourcePath = path.resolve(
  process.cwd(),
  "src/content/dictionaries/seed-language-content.generated.ts",
);
const supplementalLexiconSourcePath = path.resolve(
  process.cwd(),
  "src/content/dictionaries/language-layered-lexicons.ts",
);
const languageTextMetadataSourcePath = path.resolve(
  process.cwd(),
  "src/content/languages/language-text-metadata.ts",
);
const languageTextNormalizationSourcePath = path.resolve(
  process.cwd(),
  "src/lib/text/language-text-normalization.ts",
);
const difficultyBands = [
  "foundational",
  "developing",
  "fluent",
  "advanced",
  "expert-control",
];
const tierOrder = ["core", "extended", "deep"];
const firstClassLanguageIds = ["english", "persian", "russian"];

function failBuildPrerequisite(lines) {
  for (const line of lines) {
    console.error(line);
  }

  process.exit(1);
}

function assertRequiredSourceFile(filePath, description, nextStep) {
  if (existsSync(filePath)) {
    return;
  }

  failBuildPrerequisite([
    description,
    `Expected: ${filePath}`,
    nextStep,
  ]);
}

assertRequiredSourceFile(
  seedContentSourcePath,
  "NullKeys cannot build content packs because the generated seed content source is missing.",
  "Restore `src/content/dictionaries/seed-language-content.generated.ts` or rerun `npm run content:seed <path-to-source-archive>`.",
);
assertRequiredSourceFile(
  supplementalLexiconSourcePath,
  "NullKeys cannot build content packs because supplemental lexicon data is missing.",
  "Restore `src/content/dictionaries/language-layered-lexicons.ts`, then retry `npm run content:packs`.",
);
assertRequiredSourceFile(
  languageTextMetadataSourcePath,
  "NullKeys cannot build content packs because language text metadata is missing.",
  "Restore `src/content/languages/language-text-metadata.ts`, then retry `npm run content:packs`.",
);
assertRequiredSourceFile(
  languageTextNormalizationSourcePath,
  "NullKeys cannot build content packs because text normalization helpers are missing.",
  "Restore `src/lib/text/language-text-normalization.ts`, then retry `npm run content:packs`.",
);

function loadPlainObjectExport(filePath, exportName, trailingPattern) {
  const source = readFileSync(filePath, "utf8");
  const match = source.match(
    new RegExp(`export const ${exportName} = (\\{[\\s\\S]*\\}) ${trailingPattern}`, "u"),
  );

  if (!match) {
    throw new Error(`Unable to parse ${exportName} from ${filePath}`);
  }

  return JSON.parse(match[1]);
}

function loadTranspiledModule(filePath) {
  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  });
  const compiledModule = {
    exports: {},
  };
  const sandbox = {
    module: compiledModule,
    exports: compiledModule.exports,
    require(specifier) {
      throw new Error(`Unsupported dependency while loading ${filePath}: ${specifier}`);
    },
  };

  vm.runInNewContext(transpiled.outputText, sandbox, {
    filename: filePath,
  });

  return compiledModule.exports;
}

const {
  buildCharacterSignatureForLanguage,
  normalizeFragmentForLanguage,
  normalizeSentenceForLanguage,
  normalizeTokenForLanguage,
  tokenizeTextForLanguage,
} = loadTranspiledModule(languageTextNormalizationSourcePath);

function normalizeWord(languageId, value) {
  const strippedValue = normalizeTokenForLanguage(value, languageId);
  const characterCount = Array.from(strippedValue).length;

  if (
    strippedValue.length === 0 ||
    characterCount < 2 ||
    characterCount > 24 ||
    !/^[\p{L}\p{M}'’\-\u200c]+$/u.test(strippedValue)
  ) {
    return null;
  }

  return strippedValue;
}

function normalizeSentence(languageId, value) {
  const normalizedValue = normalizeSentenceForLanguage(value, languageId);
  const tokens = tokenizeTextForLanguage(normalizedValue, languageId);

  if (
    normalizedValue.length < 24 ||
    normalizedValue.length > 280 ||
    tokens.length < 4 ||
    tokens.length > 44
  ) {
    return null;
  }

  return normalizedValue;
}

function normalizeFragment(languageId, value) {
  const strippedValue = normalizeFragmentForLanguage(value, languageId);
  const tokens = tokenizeTextForLanguage(strippedValue, languageId);

  if (
    strippedValue.length < 10 ||
    strippedValue.length > 120 ||
    tokens.length < 2 ||
    tokens.length > 18
  ) {
    return null;
  }

  return strippedValue[0]?.toLowerCase() === strippedValue[0]
    ? strippedValue
    : `${strippedValue[0].toLowerCase()}${strippedValue.slice(1)}`;
}

function uniqueNormalizedWords(values, languageId) {
  return Array.from(
    new Set(values.map((value) => normalizeWord(languageId, value)).filter(Boolean)),
  );
}

function uniqueNormalizedTexts(values, languageId, textNormalizer) {
  return Array.from(
    new Set(values.map((value) => textNormalizer(languageId, value)).filter(Boolean)),
  );
}

function buildCharacterSignature(value, languageId) {
  return buildCharacterSignatureForLanguage(value, languageId);
}

function tokenizeWords(value, languageId) {
  return tokenizeTextForLanguage(value, languageId);
}

function getDifficultyBandIndex(difficultyBand) {
  return Math.max(0, difficultyBands.indexOf(difficultyBand));
}

function buildCharacterTransitionDiversity(text, languageId) {
  const characters = Array.from(tokenizeWords(text, languageId).join(""));

  if (characters.length < 2) {
    return 0;
  }

  const transitions = new Set();

  for (let index = 1; index < characters.length; index += 1) {
    transitions.add(`${characters[index - 1]}${characters[index]}`);
  }

  return transitions.size / Math.max(characters.length - 1, 1);
}

function classifyTextDifficultyBand(text, languageId) {
  const tokens = tokenizeWords(text, languageId);
  const punctuationCount = (text.match(/[^\p{L}\p{M}\p{N}\s]/gu) ?? []).length;
  const clauseBreakCount = (text.match(/[,;:،؛]/gu) ?? []).length;
  const uniqueTokenCount = new Set(tokens).size;
  const transitionDiversity = buildCharacterTransitionDiversity(text, languageId);
  const nonWhitespaceCharacterCount = Array.from(text).filter((character) => character.trim()).length;
  const punctuationDensity = punctuationCount / Math.max(nonWhitespaceCharacterCount, 1);
  const averageTokenLength =
    tokens.reduce((sum, token) => sum + Array.from(token).length, 0) /
    Math.max(tokens.length, 1);
  const uniqueTokenShare = uniqueTokenCount / Math.max(tokens.length, 1);
  const complexityScore =
    tokens.length * 0.24 +
    averageTokenLength * 0.82 +
    uniqueTokenCount * 0.36 +
    uniqueTokenShare * 1.8 +
    clauseBreakCount * 0.95 +
    transitionDiversity * 2.4 +
    punctuationDensity * 16;

  if (
    complexityScore <= 11 &&
    tokens.length <= 5 &&
    averageTokenLength <= 5 &&
    punctuationCount <= 1
  ) {
    return "foundational";
  }

  if (
    complexityScore <= 14 &&
    tokens.length <= 8 &&
    averageTokenLength <= 5.6 &&
    punctuationCount <= 2 &&
    clauseBreakCount <= 1
  ) {
    return "developing";
  }

  if (
    complexityScore <= 17 &&
    tokens.length <= 12 &&
    averageTokenLength <= 6.2 &&
    punctuationCount <= 3
  ) {
    return "fluent";
  }

  if (
    complexityScore <= 20 &&
    tokens.length <= 20 &&
    averageTokenLength <= 7.2
  ) {
    return "advanced";
  }

  return "expert-control";
}

function createPackedWordEntry(token, languageId) {
  return {
    token,
    signature: buildCharacterSignature(token, languageId),
    length: Array.from(token).length,
  };
}

function createPackedTextEntry(text, languageId) {
  const tokens = tokenizeWords(text, languageId);

  return {
    text,
    signature: buildCharacterSignature(text, languageId),
    openingToken: tokens[0]?.toLowerCase() ?? "",
    tokenCount: tokens.length,
    difficultyBand: classifyTextDifficultyBand(text, languageId),
  };
}

function dedupeStageWords(stages) {
  const foundationalWords = uniqueNormalizedWords(stages.foundationalWords, stages.languageId);
  const foundationalWordSet = new Set(foundationalWords);
  const developingWords = uniqueNormalizedWords(stages.developingWords, stages.languageId).filter(
    (word) => !foundationalWordSet.has(word),
  );
  const developingWordSet = new Set(developingWords);
  const advancedWords = uniqueNormalizedWords(stages.advancedWords, stages.languageId).filter(
    (word) => !foundationalWordSet.has(word) && !developingWordSet.has(word),
  );

  return {
    foundationalWords,
    developingWords,
    advancedWords,
  };
}

function deriveSupplementalStageWords(words, languageId) {
  const orderedWords = uniqueNormalizedWords(words, languageId);
  const orderIndex = new Map(orderedWords.map((word, index) => [word, index]));
  const readabilitySortedWords = [...orderedWords].sort((leftWord, rightWord) => {
    const leftLength = Array.from(leftWord).length;
    const rightLength = Array.from(rightWord).length;

    return (
      leftLength - rightLength ||
      (orderIndex.get(leftWord) ?? 0) - (orderIndex.get(rightWord) ?? 0)
    );
  });
  const richnessSortedWords = [...orderedWords].sort((leftWord, rightWord) => {
    const leftLength = Array.from(leftWord).length;
    const rightLength = Array.from(rightWord).length;

    return (
      rightLength - leftLength ||
      (orderIndex.get(leftWord) ?? 0) - (orderIndex.get(rightWord) ?? 0)
    );
  });
  const foundationalTarget = Math.min(
    orderedWords.length,
    Math.max(24, Math.round(orderedWords.length * 0.36)),
  );
  const developingTarget = Math.min(
    Math.max(0, orderedWords.length - foundationalTarget),
    Math.max(20, Math.round(orderedWords.length * 0.32)),
  );
  const foundationalWords = readabilitySortedWords.slice(0, foundationalTarget);
  const foundationalWordSet = new Set(foundationalWords);
  const developingWords = orderedWords
    .filter((word) => !foundationalWordSet.has(word))
    .slice(0, developingTarget);
  const developingWordSet = new Set(developingWords);
  const advancedWords = uniqueNormalizedWords([
    ...orderedWords.filter(
      (word) => !foundationalWordSet.has(word) && !developingWordSet.has(word),
    ),
    ...richnessSortedWords.slice(0, Math.min(48, richnessSortedWords.length)),
  ], languageId).filter(
    (word) => !foundationalWordSet.has(word) && !developingWordSet.has(word),
  );

  return {
    foundationalWords,
    developingWords,
    advancedWords,
  };
}

function computeSeedStageTargets(totalWordCount) {
  if (totalWordCount <= 180) {
    const foundationalTarget = Math.max(32, Math.round(totalWordCount * 0.42));
    const developingTarget = Math.max(24, Math.round(totalWordCount * 0.3));

    return {
      foundationalTarget,
      developingTarget,
    };
  }

  return {
    foundationalTarget: Math.min(1400, Math.max(420, Math.round(totalWordCount * 0.16))),
    developingTarget: Math.min(2600, Math.max(560, Math.round(totalWordCount * 0.26))),
  };
}

function splitItemsIntoTiers(items, options) {
  if (items.length === 0) {
    return {
      core: [],
      extended: [],
      deep: [],
    };
  }

  if (items.length <= options.smallSetThreshold) {
    return {
      core: items,
      extended: [],
      deep: [],
    };
  }

  const coreCount = Math.min(
    items.length,
    Math.max(options.coreMin, Math.round(items.length * options.coreShare)),
    options.coreMax,
  );
  const remainingAfterCore = Math.max(0, items.length - coreCount);
  const extendedCount = Math.min(
    remainingAfterCore,
    Math.max(Math.min(options.extendedMin, remainingAfterCore), Math.round(items.length * options.extendedShare)),
    options.extendedMax,
  );

  return {
    core: items.slice(0, coreCount),
    extended: items.slice(coreCount, coreCount + extendedCount),
    deep: items.slice(coreCount + extendedCount),
  };
}

function splitStageWordsIntoTiers(stageWords, stageId) {
  if (stageId === "foundational") {
    return splitItemsIntoTiers(stageWords, {
      smallSetThreshold: 96,
      coreShare: 0.34,
      coreMin: 120,
      coreMax: 540,
      extendedShare: 0.22,
      extendedMin: 120,
      extendedMax: 900,
    });
  }

  if (stageId === "developing") {
    return splitItemsIntoTiers(stageWords, {
      smallSetThreshold: 72,
      coreShare: 0.11,
      coreMin: 36,
      coreMax: 190,
      extendedShare: 0.24,
      extendedMin: 90,
      extendedMax: 780,
    });
  }

  return splitItemsIntoTiers(stageWords, {
    smallSetThreshold: 60,
    coreShare: 0.04,
    coreMin: 12,
    coreMax: 56,
    extendedShare: 0.14,
    extendedMin: 48,
    extendedMax: 540,
  });
}

function buildTieredTextEntries(entries, contentFamilyId, languageId) {
  const normalizedEntries = contentFamilyId === "phrase-drills"
    ? uniqueNormalizedTexts(entries, languageId, normalizeFragment)
    : uniqueNormalizedTexts(entries, languageId, normalizeSentence);
  const packedEntries = normalizedEntries
    .map((entry) => createPackedTextEntry(entry, languageId))
    .sort((leftEntry, rightEntry) => {
      return (
        getDifficultyBandIndex(leftEntry.difficultyBand) -
          getDifficultyBandIndex(rightEntry.difficultyBand) ||
        leftEntry.tokenCount - rightEntry.tokenCount ||
        leftEntry.text.length - rightEntry.text.length ||
        leftEntry.text.localeCompare(rightEntry.text)
      );
    });

  return splitItemsIntoTiers(packedEntries, {
    smallSetThreshold: contentFamilyId === "phrase-drills" ? 36 : 24,
    coreShare: contentFamilyId === "phrase-drills" ? 0.22 : 0.16,
    coreMin: contentFamilyId === "phrase-drills" ? 36 : 24,
    coreMax: contentFamilyId === "phrase-drills" ? 120 : 96,
    extendedShare: contentFamilyId === "phrase-drills" ? 0.28 : 0.22,
    extendedMin: contentFamilyId === "phrase-drills" ? 72 : 48,
    extendedMax: contentFamilyId === "phrase-drills" ? 320 : 260,
  });
}

function buildCommonWordStages(options) {
  const supplementalLexicon = options.supplementalLexicon ?? {};
  const supplementalRealWords = uniqueNormalizedWords([
    ...(supplementalLexicon.realWords ?? []),
    ...(supplementalLexicon.foundationalWords ?? []),
    ...(supplementalLexicon.developingWords ?? []),
    ...(supplementalLexicon.advancedWords ?? []),
  ], options.languageId);
  const seedRankedWords = uniqueNormalizedWords(
    options.seedLexicon?.rankedWords ?? [],
    options.languageId,
  );

  if (seedRankedWords.length === 0) {
    const derivedSupplementalStages = deriveSupplementalStageWords(
      supplementalRealWords,
      options.languageId,
    );

    return {
      stages: dedupeStageWords({
        languageId: options.languageId,
        foundationalWords: [
          ...(supplementalLexicon.foundationalWords ?? []),
          ...derivedSupplementalStages.foundationalWords,
        ],
        developingWords: [
          ...(supplementalLexicon.developingWords ?? []),
          ...derivedSupplementalStages.developingWords,
        ],
        advancedWords: [
          ...(supplementalLexicon.advancedWords ?? []),
          ...derivedSupplementalStages.advancedWords,
        ],
      }),
      seedWordCount: 0,
      fallbackRealWordCount: supplementalRealWords.length,
      totalRankedWordCount: supplementalRealWords.length,
    };
  }

  const mergedRankedWords = uniqueNormalizedWords([
    ...seedRankedWords,
    ...supplementalRealWords,
  ], options.languageId);
  const stageTargets = computeSeedStageTargets(mergedRankedWords.length);

  return {
    stages: dedupeStageWords({
      languageId: options.languageId,
      foundationalWords: [
        ...(supplementalLexicon.foundationalWords ?? []),
        ...mergedRankedWords.slice(0, stageTargets.foundationalTarget),
      ],
      developingWords: [
        ...(supplementalLexicon.developingWords ?? []),
        ...mergedRankedWords.slice(
          stageTargets.foundationalTarget,
          stageTargets.foundationalTarget + stageTargets.developingTarget,
        ),
      ],
      advancedWords: [
        ...(supplementalLexicon.advancedWords ?? []),
        ...mergedRankedWords.slice(
          stageTargets.foundationalTarget + stageTargets.developingTarget,
        ),
        ...supplementalRealWords,
      ],
    }),
    seedWordCount: seedRankedWords.length,
    fallbackRealWordCount: supplementalRealWords.length,
    totalRankedWordCount: mergedRankedWords.length,
  };
}

function buildLanguagePackPayloads(options) {
  const commonWordStages = buildCommonWordStages(options);
  const foundationalTierWords = splitStageWordsIntoTiers(
    commonWordStages.stages.foundationalWords,
    "foundational",
  );
  const developingTierWords = splitStageWordsIntoTiers(
    commonWordStages.stages.developingWords,
    "developing",
  );
  const advancedTierWords = splitStageWordsIntoTiers(
    commonWordStages.stages.advancedWords,
    "advanced",
  );
  const commonWordPacks = tierOrder
    .map((tier) => {
      const tierStages = {
        foundational: foundationalTierWords[tier].map((entry) =>
          createPackedWordEntry(entry, options.languageId)
        ),
        developing: developingTierWords[tier].map((entry) =>
          createPackedWordEntry(entry, options.languageId)
        ),
        advanced: advancedTierWords[tier].map((entry) =>
          createPackedWordEntry(entry, options.languageId)
        ),
      };
      const entryCount =
        tierStages.foundational.length +
        tierStages.developing.length +
        tierStages.advanced.length;

      if (entryCount === 0) {
        return null;
      }

      return {
        packId: `${options.languageId}:common-words:${tier}`,
        languageId: options.languageId,
        contentFamilyId: "common-words",
        tier,
        version: contentPackVersion,
        entryCount,
        stages: tierStages,
      };
    })
    .filter(Boolean);
  const supplementalLexicon = options.supplementalLexicon ?? {};
  const phraseTierEntries = buildTieredTextEntries(
    [
      ...(options.seedLexicon?.phraseFragments ?? []),
      ...(supplementalLexicon.phraseFragments ?? []),
    ],
    "phrase-drills",
    options.languageId,
  );
  const quoteTierEntries = buildTieredTextEntries(
    [
      ...(options.seedLexicon?.benchmarkSentences ?? []),
      ...(supplementalLexicon.benchmarkSentences ?? []),
    ],
    "quote-drills",
    options.languageId,
  );
  const phrasePacks = tierOrder
    .map((tier) => {
      const entries = phraseTierEntries[tier];

      if (entries.length === 0) {
        return null;
      }

      return {
        packId: `${options.languageId}:phrase-drills:${tier}`,
        languageId: options.languageId,
        contentFamilyId: "phrase-drills",
        tier,
        version: contentPackVersion,
        entryCount: entries.length,
        entries,
      };
    })
    .filter(Boolean);
  const quotePacks = tierOrder
    .map((tier) => {
      const entries = quoteTierEntries[tier];

      if (entries.length === 0) {
        return null;
      }

      return {
        packId: `${options.languageId}:quote-drills:${tier}`,
        languageId: options.languageId,
        contentFamilyId: "quote-drills",
        tier,
        version: contentPackVersion,
        entryCount: entries.length,
        entries,
      };
    })
    .filter(Boolean);

  return {
    commonWordPacks,
    phrasePacks,
    quotePacks,
    metrics: {
      seedWordCount: commonWordStages.seedWordCount,
      fallbackRealWordCount: commonWordStages.fallbackRealWordCount,
      totalRankedWordCount: commonWordStages.totalRankedWordCount,
      stageTotals: {
        foundational: commonWordStages.stages.foundationalWords.length,
        developing: commonWordStages.stages.developingWords.length,
        advanced: commonWordStages.stages.advancedWords.length,
      },
      tierTotals: {
        commonWords: Object.fromEntries(
          tierOrder.map((tier) => [
            tier,
            commonWordPacks.find((pack) => pack.tier === tier)?.entryCount ?? 0,
          ]),
        ),
        phraseDrills: Object.fromEntries(
          tierOrder.map((tier) => [
            tier,
            phrasePacks.find((pack) => pack.tier === tier)?.entryCount ?? 0,
          ]),
        ),
        quoteDrills: Object.fromEntries(
          tierOrder.map((tier) => [
            tier,
            quotePacks.find((pack) => pack.tier === tier)?.entryCount ?? 0,
          ]),
        ),
      },
      totals: {
        commonWords: commonWordPacks.reduce((sum, pack) => sum + pack.entryCount, 0),
        phraseDrills: phrasePacks.reduce((sum, pack) => sum + pack.entryCount, 0),
        quoteDrills: quotePacks.reduce((sum, pack) => sum + pack.entryCount, 0),
      },
    },
  };
}

function writePackFile(relativePath, payload) {
  const outputPath = path.join(contentPackRootPath, relativePath);
  mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });
  writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  return {
    outputPath,
    sizeBytes: statSync(outputPath).size,
  };
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildSupplementalSourceOrigins(supplementalLexicon, familyId) {
  const sourceOrigins = supplementalLexicon?.sourceOrigins ?? {};

  if (familyId === "common-words") {
    return uniqueStrings([
      ...(sourceOrigins.commonWords ?? []),
    ]);
  }

  if (familyId === "phrase-drills") {
    return uniqueStrings([
      ...(sourceOrigins.phraseDrills ?? []),
    ]);
  }

  return uniqueStrings([
    ...(sourceOrigins.quoteDrills ?? []),
  ]);
}

function buildFamilySourceOrigins(languageId, seedAuditEntry, supplementalLexicon, familyId) {
  const supplementalOrigins = buildSupplementalSourceOrigins(supplementalLexicon, familyId);
  const seedOrigins =
    familyId === "common-words" ||
    ((familyId === "phrase-drills" || familyId === "quote-drills") &&
      ((familyId === "phrase-drills"
        ? seedLanguageContent[languageId]?.phraseFragments?.length
        : seedLanguageContent[languageId]?.benchmarkSentences?.length) ?? 0) > 0)
      ? seedAuditEntry?.sourceLabels ?? []
      : [];

  return uniqueStrings([...seedOrigins, ...supplementalOrigins]);
}

function buildSupportStatus(totals) {
  if (totals.commonWords > 0 && totals.phraseDrills > 0 && totals.quoteDrills > 0) {
    return "full-support";
  }

  if (totals.commonWords > 0 && (totals.phraseDrills > 0 || totals.quoteDrills > 0)) {
    return "partial-multi-family";
  }

  if (totals.commonWords > 0) {
    return "common-words-only";
  }

  return "no-pack-support";
}

function buildProgressionCoverage(metrics) {
  const hasFoundationalStage = metrics.stageTotals.foundational > 0;
  const hasDevelopingStage = metrics.stageTotals.developing > 0;
  const hasAdvancedStage = metrics.stageTotals.advanced > 0;
  const supportsBeginner = hasFoundationalStage && metrics.totals.commonWords > 0;
  const supportsIntermediate =
    hasDevelopingStage &&
    (metrics.totals.commonWords > metrics.stageTotals.foundational ||
      metrics.totals.phraseDrills > 0);
  const supportsAdvanced =
    hasAdvancedStage &&
    (metrics.totals.quoteDrills > 0 || metrics.stageTotals.advanced >= 24);
  const usableStageCount = [
    hasFoundationalStage,
    hasDevelopingStage,
    hasAdvancedStage,
  ].filter(Boolean).length;

  return {
    usableStageCount,
    hasFoundationalStage,
    hasDevelopingStage,
    hasAdvancedStage,
    supportsBeginner,
    supportsIntermediate,
    supportsAdvanced,
    progressionPathStatus:
      supportsBeginner && supportsIntermediate && supportsAdvanced
        ? "complete"
        : usableStageCount >= 2
          ? "partial"
          : "insufficient",
  };
}

function buildSupportTier(languageId, supportStatus) {
  if (firstClassLanguageIds.includes(languageId)) {
    return "first-class";
  }

  return supportStatus === "full-support" ? "well-supported" : "long-tail";
}

function buildRepetitionRobustness(languageId, metrics) {
  const foundationalPool = metrics.stageTotals.foundational;
  const developingPool = metrics.stageTotals.developing;
  const advancedPool = metrics.stageTotals.advanced;
  const phrasePool = metrics.totals.phraseDrills;
  const quotePool = metrics.totals.quoteDrills;
  const beginnerBreadth = foundationalPool + Math.min(developingPool, 240);
  let status = "fragile";

  if (
    firstClassLanguageIds.includes(languageId) &&
    beginnerBreadth >= 700 &&
    phrasePool >= 800 &&
    quotePool >= 280
  ) {
    status = "premium";
  } else if (beginnerBreadth >= 500 && phrasePool >= 240 && quotePool >= 120) {
    status = "strong";
  } else if (beginnerBreadth >= 120 && (phrasePool >= 40 || quotePool >= 24)) {
    status = "moderate";
  }

  return {
    status,
    constrainedCharacterSetReady: beginnerBreadth >= 120,
    beginnerBreadth,
    foundationalPool,
    developingPool,
    advancedPool,
    phrasePool,
    quotePool,
  };
}

function buildBenchmarkReadiness(languageId, metrics, progressionCoverage) {
  const quotePool = metrics.totals.quoteDrills;
  const phrasePool = metrics.totals.phraseDrills;
  const supportsBenchmarks = progressionCoverage.supportsAdvanced && quotePool > 0;
  let status = "not-ready";

  if (
    firstClassLanguageIds.includes(languageId) &&
    progressionCoverage.supportsAdvanced &&
    quotePool >= 280 &&
    phrasePool >= 800
  ) {
    status = "premium-ready";
  } else if (progressionCoverage.supportsAdvanced && quotePool >= 120) {
    status = "ready";
  } else if (supportsBenchmarks) {
    status = "baseline";
  }

  return {
    status,
    supportsBenchmarks,
    quotePool,
    phrasePool,
  };
}

function buildRenderingStatus(languageId, textMetadata) {
  const baseStatus = {
    scriptFamily: textMetadata?.scriptFamily ?? "latin",
    numberingSystem: textMetadata?.numberingSystem ?? "latin",
    imeProfile: textMetadata?.imeProfile ?? "direct",
    usesWordSpacing: textMetadata?.usesWordSpacing ?? true,
    promptBoard:
      textMetadata?.scriptFamily === "arabic" ? "joined-script-rtl" : "unicode-bidi-plaintext",
    benchmarkReplay:
      textMetadata?.scriptFamily === "arabic" ? "joined-script-rtl" : "unicode-bidi-plaintext",
    status: "standard",
    notes: "Language metadata drives locale, direction, and plaintext-friendly prompt rendering.",
  };

  if (languageId === "english") {
    return {
      ...baseStatus,
      status: "premium-verified",
      promptBoard: "latin-editorial",
      benchmarkReplay: "latin-editorial",
      notes:
        "Readable sentence shaping, pretty wrapping, and teacher-style benchmark presentation are enabled across core practice surfaces.",
    };
  }

  if (languageId === "persian") {
    return {
      ...baseStatus,
      status: "premium-verified",
      promptBoard: "joined-script-rtl",
      benchmarkReplay: "joined-script-rtl",
      notes:
        "Joined-script RTL rendering, ZWNJ-safe normalization, bidi-aware punctuation spacing, and benchmark replay support are enabled.",
    };
  }

  if (languageId === "russian") {
    return {
      ...baseStatus,
      status: "premium-verified",
      promptBoard: "cyrillic-tuned",
      benchmarkReplay: "cyrillic-tuned",
      notes:
        "Cyrillic prompt spacing and benchmark previews use script-aware rendering with tuned tracking and readable wrapping.",
    };
  }

  if (languageId === "japanese") {
    return {
      ...baseStatus,
      status: "verified-script-aware",
      promptBoard: "hiragana-wrap-aware",
      benchmarkReplay: "hiragana-wrap-aware",
      notes:
        "Script-aware font selection and strict line-breaking are enabled for practice and benchmark text.",
    };
  }

  if (textMetadata?.scriptFamily === "arabic") {
    return {
      ...baseStatus,
      status: "rtl-aware",
      promptBoard: "joined-script-rtl",
      benchmarkReplay: "joined-script-rtl",
      notes:
        "RTL joined-script rendering and bidi-safe punctuation spacing are enabled for practice and replay surfaces.",
    };
  }

  if (
    textMetadata?.scriptFamily === "hiragana" ||
    textMetadata?.scriptFamily === "thai" ||
    textMetadata?.scriptFamily === "devanagari"
  ) {
    return {
      ...baseStatus,
      status: "script-aware",
      promptBoard: "non-latin-wrap-aware",
      benchmarkReplay: "non-latin-wrap-aware",
      notes:
        "Non-Latin practice text uses script-aware rendering, font selection, and wrap handling across visible prompt surfaces.",
    };
  }

  if (textMetadata?.scriptFamily === "cyrillic") {
    return {
      ...baseStatus,
      status: "script-aware",
      promptBoard: "cyrillic-tuned",
      benchmarkReplay: "cyrillic-tuned",
      notes:
        "Cyrillic languages use script-aware prompt metadata and readable preview rendering.",
    };
  }

  return baseStatus;
}

function buildAuditMarkdown(audit) {
  const languageRows = Object.entries(audit.languages).map(([languageId, entry]) => {
    return `| ${languageId} | ${entry.firstClassTarget ? "first-class" : entry.supportTier} | ${entry.supportedFamilies.join(", ") || "none"} | ${entry.commonWords.total} | ${entry.phraseDrills.total} | ${entry.quoteDrills.total} | ${entry.progressionCoverage.progressionPathStatus} | ${entry.renderingStatus.status} | ${entry.repetitionRobustness.status} | ${entry.benchmarkReadiness.status} | ${entry.supportStatus} |`;
  });

  return [
    "# NullKeys Language Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    `Version: ${audit.version}`,
    "",
    `First-class target languages: ${firstClassLanguageIds.join(", ")}`,
    `Long-tail languages: ${(audit.coverage.longTailLanguageIds ?? []).join(", ") || "none"}`,
    "",
    "| Language | Target | Families | Common | Phrases | Passages | Progression | Rendering | Repetition | Benchmark | Status |",
    "| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |",
    ...languageRows,
    "",
  ].join("\n");
}

const seedLanguageContent = loadPlainObjectExport(
  seedContentSourcePath,
  "seedLanguageContent",
  "as const satisfies",
);
const seedContentAudit = loadPlainObjectExport(
  seedContentSourcePath,
  "seedContentAudit",
  "as const;",
);
const { languageTextMetadata } = loadTranspiledModule(languageTextMetadataSourcePath);
const { supplementalLanguageLexicons } = loadTranspiledModule(supplementalLexiconSourcePath);
const manifest = {
  version: contentPackVersion,
  generatedAt: new Date().toISOString(),
  packs: [],
};
const auditSummary = {
  version: contentPackVersion,
  generatedAt: manifest.generatedAt,
  sourceFiles: {
    seedContentSourcePath: path.relative(process.cwd(), seedContentSourcePath),
    supplementalLexiconSourcePath: path.relative(process.cwd(), supplementalLexiconSourcePath),
    languageTextMetadataSourcePath: path.relative(process.cwd(), languageTextMetadataSourcePath),
    languageTextNormalizationSourcePath: path.relative(
      process.cwd(),
      languageTextNormalizationSourcePath,
    ),
  },
  coverage: {
    totalPackCount: 0,
    commonWordPackCount: 0,
    phrasePackCount: 0,
    quotePackCount: 0,
    overlapLanguageCount: 0,
    fullSupportLanguageCount: 0,
    firstClassLanguageIds,
    longTailLanguageIds: [],
  },
  languages: {},
};
const languageIds = Array.from(
  new Set([
    ...Object.keys(seedLanguageContent),
    ...Object.keys(supplementalLanguageLexicons),
  ]),
).sort((leftId, rightId) => leftId.localeCompare(rightId));

rmSync(contentPackRootPath, {
  recursive: true,
  force: true,
});

for (const languageId of languageIds) {
  const seedLexicon = seedLanguageContent[languageId];
  const supplementalLexicon = supplementalLanguageLexicons[languageId];
  const packPayloads = buildLanguagePackPayloads({
    languageId,
    seedLexicon,
    supplementalLexicon,
  });
  const languageManifestEntries = [];

  for (const commonWordPack of packPayloads.commonWordPacks) {
    const relativePath = `packs/${languageId}/common-words.${commonWordPack.tier}.json`;
    const writtenPack = writePackFile(relativePath, commonWordPack);

    languageManifestEntries.push({
      packId: commonWordPack.packId,
      languageId,
      contentFamilyId: "common-words",
      tier: commonWordPack.tier,
      version: contentPackVersion,
      path: `/content-packs/${relativePath}`,
      sizeBytes: writtenPack.sizeBytes,
      entryCount: commonWordPack.entryCount,
      stageCounts: {
        foundational: commonWordPack.stages.foundational.length,
        developing: commonWordPack.stages.developing.length,
        advanced: commonWordPack.stages.advanced.length,
      },
    });
  }

  for (const phrasePack of packPayloads.phrasePacks) {
    const relativePath = `packs/${languageId}/phrase-drills.${phrasePack.tier}.json`;
    const writtenPack = writePackFile(relativePath, phrasePack);

    languageManifestEntries.push({
      packId: phrasePack.packId,
      languageId,
      contentFamilyId: "phrase-drills",
      tier: phrasePack.tier,
      version: contentPackVersion,
      path: `/content-packs/${relativePath}`,
      sizeBytes: writtenPack.sizeBytes,
      entryCount: phrasePack.entryCount,
    });
  }

  for (const quotePack of packPayloads.quotePacks) {
    const relativePath = `packs/${languageId}/quote-drills.${quotePack.tier}.json`;
    const writtenPack = writePackFile(relativePath, quotePack);

    languageManifestEntries.push({
      packId: quotePack.packId,
      languageId,
      contentFamilyId: "quote-drills",
      tier: quotePack.tier,
      version: contentPackVersion,
      path: `/content-packs/${relativePath}`,
      sizeBytes: writtenPack.sizeBytes,
      entryCount: quotePack.entryCount,
    });
  }

  manifest.packs.push(...languageManifestEntries);
  const seedAuditEntry = seedContentAudit[languageId];
  const supportStatus = buildSupportStatus(packPayloads.metrics.totals);
  const progressionCoverage = buildProgressionCoverage(packPayloads.metrics);
  const supportTier = buildSupportTier(languageId, supportStatus);
  const renderingStatus = buildRenderingStatus(languageId, languageTextMetadata[languageId]);
  const repetitionRobustness = buildRepetitionRobustness(languageId, packPayloads.metrics);
  const benchmarkReadiness = buildBenchmarkReadiness(
    languageId,
    packPayloads.metrics,
    progressionCoverage,
  );
  auditSummary.languages[languageId] = {
    sourceWordCount: seedAuditEntry?.sourceWordCount ?? 0,
    seedWordCount: packPayloads.metrics.seedWordCount,
    fallbackRealWordCount: packPayloads.metrics.fallbackRealWordCount,
    totalRankedWordCount: packPayloads.metrics.totalRankedWordCount,
    supportedFamilies: ["common-words", "phrase-drills", "quote-drills"].filter(
      (familyId) =>
        familyId === "common-words"
          ? packPayloads.metrics.totals.commonWords > 0
          : familyId === "phrase-drills"
            ? packPayloads.metrics.totals.phraseDrills > 0
            : packPayloads.metrics.totals.quoteDrills > 0,
    ),
    firstClassTarget: firstClassLanguageIds.includes(languageId),
    supportTier,
    qualifiesAsFullSupport: supportStatus === "full-support",
    supportStatus,
    progressionCoverage,
    renderingStatus,
    repetitionRobustness,
    benchmarkReadiness,
    commonWords: {
      stages: packPayloads.metrics.stageTotals,
      tiers: packPayloads.metrics.tierTotals.commonWords,
      total: packPayloads.metrics.totals.commonWords,
      sourceOrigins: buildFamilySourceOrigins(
        languageId,
        seedAuditEntry,
        supplementalLexicon,
        "common-words",
      ),
    },
    phraseDrills: {
      tiers: packPayloads.metrics.tierTotals.phraseDrills,
      total: packPayloads.metrics.totals.phraseDrills,
      sourceOrigins: buildFamilySourceOrigins(
        languageId,
        seedAuditEntry,
        supplementalLexicon,
        "phrase-drills",
      ),
    },
    quoteDrills: {
      tiers: packPayloads.metrics.tierTotals.quoteDrills,
      total: packPayloads.metrics.totals.quoteDrills,
      sourceOrigins: buildFamilySourceOrigins(
        languageId,
        seedAuditEntry,
        supplementalLexicon,
        "quote-drills",
      ),
    },
    sourceLabels: seedAuditEntry?.sourceLabels ?? [],
  };
}

manifest.packs.sort((leftPack, rightPack) => {
  return (
    leftPack.languageId.localeCompare(rightPack.languageId) ||
    leftPack.contentFamilyId.localeCompare(rightPack.contentFamilyId) ||
    tierOrder.indexOf(leftPack.tier) - tierOrder.indexOf(rightPack.tier)
  );
});

auditSummary.coverage.totalPackCount = manifest.packs.length;
auditSummary.coverage.commonWordPackCount = manifest.packs.filter(
  (pack) => pack.contentFamilyId === "common-words",
).length;
auditSummary.coverage.phrasePackCount = manifest.packs.filter(
  (pack) => pack.contentFamilyId === "phrase-drills",
).length;
auditSummary.coverage.quotePackCount = manifest.packs.filter(
  (pack) => pack.contentFamilyId === "quote-drills",
).length;
auditSummary.coverage.overlapLanguageCount = Object.values(auditSummary.languages).filter(
  (entry) => entry.seedWordCount > 0,
).length;
auditSummary.coverage.fullSupportLanguageCount = Object.values(auditSummary.languages).filter(
  (entry) => entry.qualifiesAsFullSupport,
).length;
auditSummary.coverage.longTailLanguageIds = Object.entries(auditSummary.languages)
  .filter(([, entry]) => entry.supportTier === "long-tail")
  .map(([languageId]) => languageId);

mkdirSync(contentPackRootPath, {
  recursive: true,
});
writeFileSync(manifestOutputPath, JSON.stringify(manifest, null, 2));
writeFileSync(auditOutputPath, JSON.stringify(auditSummary, null, 2));
writeFileSync(auditMarkdownOutputPath, buildAuditMarkdown(auditSummary));

console.log(`Built ${manifest.packs.length} content packs into ${packOutputRootPath}`);
console.log(`Manifest: ${manifestOutputPath}`);
console.log(`Audit: ${auditOutputPath}`);
