import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const defaultZipPath = path.resolve(process.cwd(), "input/source-content.zip");
const zipPath = resolveZipPath();
const outputPath = path.resolve(
  process.cwd(),
  "src/content/dictionaries/seed-language-content.generated.ts",
);
const zipEntries = readZipEntries();

const SOURCE_LABELS = {
  commonWords: "seed/common-words",
  bookPassages: "seed/book-passages",
  benchmarkPassages: "seed/benchmark-passages",
};

function resolveZipPath() {
  const requestedZipPath =
    process.argv[2] ?? process.env.NULLKEYS_CONTENT_SEED_ARCHIVE ?? defaultZipPath;
  const resolvedZipPath = path.resolve(requestedZipPath);

  if (existsSync(resolvedZipPath)) {
    return resolvedZipPath;
  }

  console.error("NullKeys source archive not found.");
  console.error(`Expected archive at: ${resolvedZipPath}`);
  console.error(
    "Pass a path as the first argument or set NULLKEYS_CONTENT_SEED_ARCHIVE.",
  );
  process.exit(1);
}

function readZipEntries() {
  const result = spawnSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed to inspect ${zipPath}`);
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function findZipEntry(description, predicate) {
  const entry = zipEntries.find(predicate);

  if (!entry) {
    throw new Error(`Unable to locate ${description} inside ${zipPath}`);
  }

  return entry;
}

const seedWordSources = {
  arabic: "ar",
  belarusian: "be",
  croatian: "hr",
  czech: "cs",
  danish: "da",
  dutch: "nl",
  english: "en",
  estonian: "et",
  finnish: "fi",
  french: "fr",
  german: "de",
  greek: "el",
  hebrew: "he",
  hungarian: "hu",
  italian: "it",
  japanese: "ja",
  latvian: "lv",
  lithuanian: "lt",
  norwegian: "nb",
  "norwegian-bokmal": "nb",
  persian: "fa",
  polish: "pl",
  portuguese: "pt",
  romanian: "ro",
  russian: "ru",
  slovenian: "sl",
  spanish: "es",
  swedish: "sv",
  thai: "th",
  turkish: "tr",
  ukrainian: "uk",
};

const seedBookSources = {
  english: [
    "en-alice-wonderland.json",
    "en-call-wild.json",
    "en-jekyll-hyde.json",
  ],
  german: ["de-alice-wonderland.json"],
  spanish: ["es-marianela.json"],
  french: ["fr-alice-wonderland.json"],
};

function readZipEntry(entry) {
  const result = spawnSync("unzip", ["-p", zipPath, entry], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed to read ${entry} from ${zipPath}`);
  }

  return result.stdout;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeWord(value) {
  const normalizedValue = normalizeWhitespace(value).normalize("NFC").toLowerCase();
  const strippedValue = normalizedValue.replace(
    /^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}'’-]+$/gu,
    "",
  );
  const characterCount = Array.from(strippedValue).length;

  if (
    strippedValue.length === 0 ||
    characterCount < 2 ||
    characterCount > 24 ||
    !/^[\p{L}\p{M}'’-]+$/u.test(strippedValue)
  ) {
    return null;
  }

  return strippedValue;
}

function normalizeSentence(value) {
  const normalizedValue = normalizeWhitespace(value)
    .normalize("NFC")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'");
  const tokens = normalizedValue.match(/[\p{L}\p{M}\p{N}'’-]+/gu) ?? [];

  if (
    normalizedValue.length < 24 ||
    normalizedValue.length > 280 ||
    tokens.length < 4 ||
    tokens.length > 44
  ) {
    return null;
  }

  return /[.!?。！？؟]$/u.test(normalizedValue) ? normalizedValue : `${normalizedValue}.`;
}

function normalizeFragment(value) {
  const normalizedValue = normalizeWhitespace(value)
    .normalize("NFC")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'");
  const strippedValue = normalizedValue.replace(/[.!?;:,]+$/u, "").trim();
  const tokens = strippedValue.match(/[\p{L}\p{M}\p{N}'’-]+/gu) ?? [];

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

function uniqueList(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function resolveWordsEntry(sourceLanguageId) {
  return findZipEntry(
    `common-word data for ${sourceLanguageId}`,
    (entry) => entry.endsWith(`/words-${sourceLanguageId}.json`) || entry === `words-${sourceLanguageId}.json`,
  );
}

function resolveBookEntry(bookFileName) {
  return findZipEntry(
    `book data ${bookFileName}`,
    (entry) => entry.endsWith(`/${bookFileName}`) || entry === bookFileName,
  );
}

function resolveQuotesEntry() {
  return findZipEntry(
    "benchmark quote data",
    (entry) => entry.endsWith("/quotes.json") || entry === "quotes.json",
  );
}

function parseSeedWords(sourceLanguageId) {
  const words = JSON.parse(readZipEntry(resolveWordsEntry(sourceLanguageId)));
  const normalizedWords = uniqueList(words.map(normalizeWord));

  return {
    rankedWords: normalizedWords,
    sourceWordCount: words.length,
    importedWordCount: normalizedWords.length,
  };
}

function splitIntoSentences(paragraph) {
  const normalizedParagraph = normalizeWhitespace(paragraph);
  const matches = normalizedParagraph.match(/[^.!?]+[.!?]+["')\]]*/gu);

  if (matches?.length) {
    return matches;
  }

  return [normalizedParagraph];
}

function parseBookSentences(bookFileName) {
  const book = JSON.parse(readZipEntry(resolveBookEntry(bookFileName)));
  const sentences = [];

  for (const [, paragraphs] of book) {
    for (const paragraph of paragraphs) {
      for (const sentence of splitIntoSentences(paragraph)) {
        const normalizedSentence = normalizeSentence(sentence);
        if (normalizedSentence) {
          sentences.push(normalizedSentence);
        }
      }
    }
  }

  return uniqueList(sentences);
}

function derivePhraseFragments(sentences) {
  const fragments = [];

  for (const sentence of sentences) {
    const parts = sentence.split(/[,:;—-]\s+/u);

    for (const part of parts) {
      const normalizedFragment = normalizeFragment(part);
      if (normalizedFragment) {
        fragments.push(normalizedFragment);
      }
    }

    const wholeSentenceFragment = normalizeFragment(sentence);
    if (wholeSentenceFragment) {
      fragments.push(wholeSentenceFragment);
    }
  }

  return uniqueList(fragments);
}

function parseSeedBenchmarks() {
  const quotes = JSON.parse(readZipEntry(resolveQuotesEntry()));
  const benchmarkSentences = uniqueList(
    quotes
      .map(([quote]) => normalizeSentence(quote))
      .filter(Boolean),
  );

  return {
    benchmarkSentences,
    phraseFragments: derivePhraseFragments(benchmarkSentences),
  };
}

const seedLanguageContent = {};
const audit = {};
const englishBenchmarks = parseSeedBenchmarks();

for (const [languageId, sourceLanguageId] of Object.entries(seedWordSources)) {
  const wordSource = parseSeedWords(sourceLanguageId);
  const sourceLabels = [SOURCE_LABELS.commonWords];
  let phraseFragments = [];
  let benchmarkSentences = [];

  for (const bookFileName of seedBookSources[languageId] ?? []) {
    const bookSentences = parseBookSentences(bookFileName);
    sourceLabels.push(SOURCE_LABELS.bookPassages);
    benchmarkSentences.push(...bookSentences);
    phraseFragments.push(...derivePhraseFragments(bookSentences));
  }

  if (languageId === "english") {
    sourceLabels.push(SOURCE_LABELS.benchmarkPassages);
    benchmarkSentences.push(...englishBenchmarks.benchmarkSentences);
    phraseFragments.push(...englishBenchmarks.phraseFragments);
  }

  const normalizedPhraseFragments = uniqueList(phraseFragments);
  const normalizedBenchmarkSentences = uniqueList(benchmarkSentences);

  seedLanguageContent[languageId] = {
    sourceLanguageId,
    sourceLabels: uniqueList(sourceLabels),
    sourceWordCount: wordSource.sourceWordCount,
    importedWordCount: wordSource.importedWordCount,
    rankedWords: wordSource.rankedWords,
    phraseFragments: normalizedPhraseFragments,
    benchmarkSentences: normalizedBenchmarkSentences,
  };

  audit[languageId] = {
    sourceLanguageId,
    sourceWordCount: wordSource.sourceWordCount,
    importedWordCount: wordSource.importedWordCount,
    phraseFragmentCount: normalizedPhraseFragments.length,
    benchmarkSentenceCount: normalizedBenchmarkSentences.length,
    sourceLabels: seedLanguageContent[languageId].sourceLabels,
  };
}

const auditComment = Object.entries(audit)
  .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
  .map(
    ([languageId, entry]) =>
      `// ${languageId}: source ${entry.sourceWordCount} -> imported ${entry.importedWordCount}, ` +
      `phrases ${entry.phraseFragmentCount}, benchmark ${entry.benchmarkSentenceCount}`,
  )
  .join("\n");

const output = `// Generated by scripts/build-seed-content.mjs
// Seed content summary:
${auditComment}

export interface SeedLanguageContent {
  sourceLanguageId: string;
  sourceLabels: readonly string[];
  sourceWordCount: number;
  importedWordCount: number;
  rankedWords: readonly string[];
  phraseFragments: readonly string[];
  benchmarkSentences: readonly string[];
}

export const seedLanguageContent = ${JSON.stringify(
  seedLanguageContent,
  null,
  2,
)} as const satisfies Record<string, SeedLanguageContent>;

export const seedContentAudit = ${JSON.stringify(audit, null, 2)} as const;
`;

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output);
console.log(`Built seed content into ${outputPath}`);
