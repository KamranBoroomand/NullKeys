import {
  shellCommandSequences,
  shellCommandTerms,
} from "@/content/code-snippets/programmer-fragments";
import {
  benchmarkNumberPatterns,
  dateAndTimePatterns,
  measurementPatterns,
  numericClusters,
  numberPatternTiers,
  numpadDrillFragments,
  punctuationClusters,
  symbolPatternTiers,
  symbolPatternSequences,
} from "@/content/drills/symbol-drills";
import { tokenizePromptText } from "@/features/adaptive-practice/content-history";
import {
  generatePracticePassage,
  type PassageGenerationOptions,
} from "@/features/adaptive-practice/passage-generator";
import {
  loadLanguageContentBundle,
  resetContentPackLoaderState,
} from "@/features/content-packs/content-pack-loader";
import { buildLanguageCharacterPool } from "@/features/language-support/language-registry";
import { installContentPackFetchMock } from "./helpers/content-pack-test-helpers";

installContentPackFetchMock();

beforeEach(() => {
  resetContentPackLoaderState();
});

function averageWordLength(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.reduce((sum, word) => sum + word.length, 0) / Math.max(words.length, 1);
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[\s.,!?;:()[\]{}<>"`~/_|\\-]+/u)
    .filter(Boolean);
}

function splitSymbolFragments(text: string) {
  return text.split(/\s+/u).filter(Boolean);
}

function tokenizeForLanguage(text: string, languageId: string) {
  return tokenizePromptText(text, languageId);
}

function maxTokenReuseRatio(tokens: string[]) {
  const counts = tokens.reduce((map, token) => {
    map.set(token, (map.get(token) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  return Math.max(...counts.values()) / Math.max(tokens.length, 1);
}

function hasAlternatingLoop(tokens: string[]) {
  for (let index = 3; index < tokens.length; index += 1) {
    if (tokens[index] === tokens[index - 2] && tokens[index - 1] === tokens[index - 3]) {
      return true;
    }
  }

  return false;
}

function overlapRatio(leftTokens: string[], rightTokens: string[]) {
  const rightTokenSet = new Set(rightTokens);
  return (
    leftTokens.filter((token) => rightTokenSet.has(token)).length / Math.max(leftTokens.length, 1)
  );
}

function punctuationRatio(text: string) {
  const punctuationCount = (text.match(/[^\p{L}\p{N}\s]/gu) ?? []).length;
  return punctuationCount / Math.max(text.length, 1);
}

function digitRatio(text: string) {
  const digitCount = (text.match(/\d/gu) ?? []).length;
  return digitCount / Math.max(text.length, 1);
}

function separatorDensity(text: string) {
  return (text.match(/[:/=><|&%$\\-]/gu) ?? []).length / Math.max(text.length, 1);
}

function extractAlphaTokens(text: string) {
  return text.match(/[A-Za-z]+/g) ?? [];
}

const adaptiveNoisePattern =
  /\b(cmd|alt|ctrl|delete|systemctl|grep|git|npm|sudo|ssh|sed|awk|printf|chmod|docker|journalctl|kubectl)\b|&&|\|\||=>/iu;
const latinTokenPattern = /[\p{Script=Latin}][\p{Script=Latin}\p{N}_:/.-]*/gu;
const persianMachineryPattern = /درس|مرحله|شاگرد|مرور|بازبینی|معیار|نشانه‌گذاری/u;
const disallowedNumberLexicalTokenPattern =
  /\b(?:cm|kg|km|ms|px|lane|gate|seat|batch|local|cpu|ram|node|shard|load|temp|rack|invoice|due|net|lat|lon|enter)\b/iu;
const symbolIdentifierPattern = /\b[a-z_][a-z0-9_]{2,}\b/iu;
const naturalLanguageLeakPattern =
  /\b(?:git|npm|docker|journalctl|curl|ssh|grep|find|sed|awk|printf|const|return|async|function|SELECT|INSERT)\b|=>|--[a-z0-9-]+|<\/?[a-z][^>]*>|\$\(|\[[a-z_][a-z0-9_]*\]/iu;

function latinTokenCount(text: string) {
  return (text.match(latinTokenPattern) ?? []).length;
}

function sentenceCount(text: string) {
  return text.split(/[.!?؟。！？]/u).filter((segment) => segment.trim().length > 0).length;
}

function sentenceOpeners(text: string, languageId: string) {
  return text
    .split(/[.!?؟。！？]/u)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => tokenizeForLanguage(segment, languageId)[0] ?? "")
    .filter(Boolean);
}

async function generatePackedPassage(options: PassageGenerationOptions) {
  const contentBundle = await loadLanguageContentBundle({
    languageId: options.languageId,
    contentFamilyId: options.contentFamilyId,
    activeCharacterSet: options.activeCharacterSet,
    punctuationEnabled: options.punctuationEnabled,
    difficultyBand: options.difficultyBand,
    targetWordCount: options.targetWordCount,
    allowWarmup: false,
  });

  return generatePracticePassage({
    ...options,
    contentBundle,
  });
}

function buildRecentSession(options: {
  languageId: string;
  promptText: string;
  activeCharacterSet: string[];
  priorityCharacters: string[];
  contentFamilyId: string;
  sessionFlavor: PassageGenerationOptions["sessionFlavor"];
}) {
  return {
    sessionId: `${options.languageId}:${options.contentFamilyId}:recent`,
    sessionKind: "adaptive" as const,
    sessionFlavor: options.sessionFlavor,
    contentFamilyId: options.contentFamilyId,
    languageId: options.languageId,
    keyboardFamilyId: "ansi-tenkeyless",
    keyboardLayoutId: "ansi-us-tenkeyless",
    inputMode: "hardware" as const,
    promptText: options.promptText,
    typedText: options.promptText,
    startedAt: "2026-03-16T12:00:00.000Z",
    endedAt: "2026-03-16T12:01:00.000Z",
    completed: true,
    priorityCharacters: options.priorityCharacters,
    activeCharacterSet: options.activeCharacterSet,
    unlockedCharacters: options.activeCharacterSet,
    attemptLog: [],
    perCharacterPerformance: {},
    grossWpm: 70,
    netWpm: 68,
    accuracy: 97,
    correctedErrorCount: 1,
    uncorrectedErrorCount: 0,
    durationMs: 60_000,
  };
}

describe("passage generator", () => {
  it("emphasizes priority characters in mixed passages", () => {
    const generatedPassage = generatePracticePassage({
      languageId: "english",
      targetWordCount: 16,
      sessionFlavor: "mixed",
      priorityCharacters: ["q", "z"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
    });

    expect(generatedPassage.text.length).toBeGreaterThan(10);
    expect(generatedPassage.emphasizedCharacters).toEqual(["q", "z"]);
  });

  it("builds code-oriented passages for programmer drills", () => {
    const generatedPassage = generatePracticePassage({
      languageId: "english",
      targetWordCount: 10,
      sessionFlavor: "code",
      priorityCharacters: ["[", "]"],
      reinforcementCharacters: ["{", "}"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz[]"),
      contentSourceBias: "real",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      keyboardLayoutId: "linux-terminal-tkl",
      programmerDrillPresetId: "shell-commands",
    });

    expect(generatedPassage.text).toMatch(
      /git|cd|find|grep|chmod|sudo|rsync|printf|ssh|tail|ls|sed|echo|npm run|tar|mkdir|rm|cp|mv/,
    );
  });

  it("mixes recovery, bridge, and exploration segments into adaptive lessons", () => {
    const generatedPassage = generatePracticePassage({
      languageId: "english",
      targetWordCount: 20,
      sessionFlavor: "mixed",
      priorityCharacters: ["q", "z"],
      recoveryCharacters: ["q"],
      reinforcementCharacters: ["z"],
      bridgeCharacters: ["a", "w"],
      explorationCharacters: ["x", "v"],
      fluencyCharacters: ["e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      keyboardLayoutId: "ansi-us-tenkeyless",
      lessonBalance: {
        recoveryShare: 0.4,
        reinforcementShare: 0.15,
        bridgeShare: 0.2,
        explorationShare: 0.2,
        fluencyShare: 0.15,
        symbolShare: 0.05,
      },
    });

    expect(generatedPassage.text.split(" ").length).toBeGreaterThanOrEqual(12);
    expect(generatedPassage.emphasizedCharacters).toEqual(
      expect.arrayContaining(["q", "a", "w", "x", "v"]),
    );
  });

  it("uses numpad drills when a numpad-capable layout is selected", () => {
    const generatedPassage = generatePracticePassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "numbers",
      priorityCharacters: ["1", "2", "3"],
      activeCharacterSet: Array.from("1234567890"),
      contentSourceBias: "synthetic",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      keyboardLayoutId: "ansi-us-full",
      numpadPracticeEnabled: true,
    });

    expect(numpadDrillFragments.some((fragment) => generatedPassage.text.includes(fragment))).toBe(true);
    expect(generatedPassage.text).not.toMatch(disallowedNumberLexicalTokenPattern);
  });

  it("filters natural words to the active character set before building readable lessons", async () => {
    const generatedPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "s"],
      bridgeCharacters: ["t", "r", "e", "l", "i", "n"],
      reinforcementCharacters: ["n", "t"],
      activeCharacterSet: Array.from("asetrlin"),
      contentSourceBias: "real",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
    });

    const normalizedCharacters = generatedPassage.text.replace(/\s+/g, "");
    expect(normalizedCharacters).toMatch(/^[asetrlin]+$/);
  });

  it("keeps narrow common-word lessons out of tiny repeated loops", async () => {
    const generatedPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 16,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "s", "t"],
      bridgeCharacters: ["e", "r", "l", "i", "n"],
      activeCharacterSet: Array.from("asetrlin"),
      contentSourceBias: "real",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
      difficultyBand: "foundational",
    });

    const tokens = tokenize(generatedPassage.text);
    expect(new Set(tokens).size).toBeGreaterThanOrEqual(7);
    expect(maxTokenReuseRatio(tokens)).toBeLessThanOrEqual(0.25);
    expect(hasAlternatingLoop(tokens)).toBe(false);
  });

  it("uses seeded real-word pools to keep non-English common-word lessons varied", async () => {
    const spanishPassage = await generatePackedPassage({
      languageId: "spanish",
      targetWordCount: 16,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "e", "o"],
      activeCharacterSet: Array.from("abcdefghijklmnñopqrstuvwxyzáéíóúü"),
      contentSourceBias: "real",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
      difficultyBand: "developing",
    });

    const tokens = tokenize(spanishPassage.text);
    expect(new Set(tokens).size).toBeGreaterThanOrEqual(10);
    expect(maxTokenReuseRatio(tokens)).toBeLessThanOrEqual(0.2);
    expect(hasAlternatingLoop(tokens)).toBe(false);
  });

  it("falls back to pseudo-words when no natural words fit the active character set", async () => {
    const generatedPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 8,
      sessionFlavor: "plain",
      priorityCharacters: ["q", "z"],
      activeCharacterSet: ["q", "z", "x"],
      contentSourceBias: "real",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
    });

    expect(generatedPassage.text.length).toBeGreaterThan(0);
    expect(generatedPassage.text.replace(/\s+/g, "")).toMatch(/^[qzx]+$/);
  });

  it("scales common-word difficulty toward longer vocabulary for stronger learners", async () => {
    const foundationalPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 14,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "real",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
      difficultyBand: "foundational",
    });
    const advancedPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 14,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "real",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
      difficultyBand: "advanced",
    });

    expect(averageWordLength(advancedPassage.text)).toBeGreaterThan(
      averageWordLength(foundationalPassage.text),
    );
  });

  it("attaches passage novelty metrics and cools down recent vocabulary", async () => {
    const firstPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "plain",
      priorityCharacters: ["r", "s", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "real",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
      difficultyBand: "developing",
    });
    const secondPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "plain",
      priorityCharacters: ["r", "s", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "real",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
      difficultyBand: "developing",
      recentSessions: [
        {
          sessionId: "recent-common",
          sessionKind: "adaptive",
          sessionFlavor: "plain",
          contentFamilyId: "common-words",
          languageId: "english",
          keyboardFamilyId: "ansi-tenkeyless",
          keyboardLayoutId: "ansi-us-tenkeyless",
          inputMode: "hardware",
          promptText: firstPassage.text,
          typedText: firstPassage.text,
          startedAt: "2026-03-16T12:00:00.000Z",
          endedAt: "2026-03-16T12:01:00.000Z",
          completed: true,
          priorityCharacters: ["r", "s", "t"],
          activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
          unlockedCharacters: Array.from("abcdefghijklmnopqrstuvwxyz"),
          attemptLog: [],
          perCharacterPerformance: {},
          grossWpm: 72,
          netWpm: 70,
          accuracy: 98,
          correctedErrorCount: 1,
          uncorrectedErrorCount: 0,
          durationMs: 60_000,
        },
      ],
    });

    expect(secondPassage.contentMetrics.noveltyScore).toBeGreaterThan(0);
    expect(secondPassage.contentMetrics.repetitionScore).toBeLessThan(65);
  });

  it("separates phrase and book passage families into different text shapes", async () => {
    const phrasePassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 18,
      sessionFlavor: "mixed",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.!?"),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      contentFamilyId: "phrase-drills",
      difficultyBand: "developing",
    });
    const bookPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 26,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.!?"),
      contentSourceBias: "real",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      contentFamilyId: "quote-drills",
      difficultyBand: "advanced",
    });

    expect(phrasePassage.text).not.toEqual(bookPassage.text);
    expect(bookPassage.text.split(/[.!?]/).filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect(bookPassage.contentMetrics.contentVariantId).toBe("book-passage");
  });

  it("keeps phrase drills sentence-shaped instead of plain word lists", async () => {
    const phrasePassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 20,
      sessionFlavor: "mixed",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.!?"),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      contentFamilyId: "phrase-drills",
      difficultyBand: "developing",
    });

    const sentences = phrasePassage.text.split(/[.!?]/u).filter((segment) => segment.trim().length > 0);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences.some((sentence) => tokenize(sentence).length >= 4)).toBe(true);
    expect(phrasePassage.text).toMatch(/[,:"]| then\./u);
    expect(hasAlternatingLoop(tokenize(phrasePassage.text))).toBe(false);
  });

  it("keeps premium-language benchmark passages readable and editorially tight", async () => {
    const persianCharacterPool = buildLanguageCharacterPool({
      languageId: "persian",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      activeCharacterRange: "full",
    });
    const russianCharacterPool = buildLanguageCharacterPool({
      languageId: "russian",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      activeCharacterRange: "full",
    });
    const [englishBenchmark, persianBenchmark, russianBenchmark] = await Promise.all([
      generatePackedPassage({
        languageId: "english",
        targetWordCount: 28,
        sessionFlavor: "plain",
        priorityCharacters: ["a", "e", "r", "t"],
        activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.!?"),
        contentSourceBias: "real",
        punctuationEnabled: true,
        capitalizationEnabled: true,
        contentFamilyId: "quote-drills",
        difficultyBand: "advanced",
      }),
      generatePackedPassage({
        languageId: "persian",
        targetWordCount: 28,
        sessionFlavor: "plain",
        priorityCharacters: ["ر", "ت", "م", "د"],
        activeCharacterSet: persianCharacterPool,
        contentSourceBias: "real",
        punctuationEnabled: true,
        capitalizationEnabled: false,
        contentFamilyId: "quote-drills",
        difficultyBand: "advanced",
      }),
      generatePackedPassage({
        languageId: "russian",
        targetWordCount: 28,
        sessionFlavor: "plain",
        priorityCharacters: ["р", "т", "н", "о"],
        activeCharacterSet: russianCharacterPool,
        contentSourceBias: "real",
        punctuationEnabled: true,
        capitalizationEnabled: true,
        contentFamilyId: "quote-drills",
        difficultyBand: "advanced",
      }),
    ]);

    expect(sentenceCount(englishBenchmark.text)).toBeGreaterThanOrEqual(2);
    expect(englishBenchmark.contentMetrics.lexicalDiversity).toBeGreaterThanOrEqual(0.5);
    expect(englishBenchmark.text).not.toMatch(adaptiveNoisePattern);

    const persianTokens = tokenizeForLanguage(persianBenchmark.text, "persian");
    expect(sentenceCount(persianBenchmark.text)).toBeGreaterThanOrEqual(2);
    expect(persianBenchmark.contentMetrics.lexicalDiversity).toBeGreaterThanOrEqual(0.45);
    expect(maxTokenReuseRatio(persianTokens)).toBeLessThanOrEqual(0.3);
    expect(persianBenchmark.text).not.toMatch(/\s[،؛؟]/u);
    expect(persianBenchmark.text).not.toMatch(/\u200c\s|\s\u200c/u);

    const russianTokens = tokenizeForLanguage(russianBenchmark.text, "russian");
    expect(sentenceCount(russianBenchmark.text)).toBeGreaterThanOrEqual(2);
    expect(russianBenchmark.contentMetrics.lexicalDiversity).toBeGreaterThanOrEqual(0.45);
    expect(new Set(russianTokens).size).toBeGreaterThanOrEqual(12);
    expect(maxTokenReuseRatio(russianTokens)).toBeLessThanOrEqual(0.3);
  });

  it("keeps adaptive blend readable instead of turning into slurry", async () => {
    const adaptivePassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 22,
      sessionFlavor: "mixed",
      priorityCharacters: ["a", "e", "r", "t"],
      recoveryCharacters: ["a", "s"],
      reinforcementCharacters: ["r", "t"],
      bridgeCharacters: ["l", "i", "n"],
      explorationCharacters: ["o", "d"],
      fluencyCharacters: ["h", "m", "c"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.!?"),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      contentFamilyId: "adaptive-blend",
      difficultyBand: "developing",
      lessonBalance: {
        recoveryShare: 0.35,
        reinforcementShare: 0.16,
        bridgeShare: 0.18,
        explorationShare: 0.12,
        fluencyShare: 0.14,
        symbolShare: 0.05,
        confusionShare: 0.0,
        transitionShare: 0.0,
      },
    });

    expect(adaptivePassage.contentMetrics.repetitionScore).toBeLessThan(55);
    expect(adaptivePassage.contentMetrics.lexicalDiversity).toBeGreaterThanOrEqual(0.6);
    expect(adaptivePassage.text).not.toMatch(adaptiveNoisePattern);
    expect(sentenceCount(adaptivePassage.text)).toBeGreaterThanOrEqual(2);
  });

  it("keeps foundational adaptive lessons calm instead of turning noisy under early pressure", async () => {
    const foundationalRuns = await Promise.all(
      Array.from({ length: 6 }, () =>
        generatePackedPassage({
          languageId: "english",
          targetWordCount: 20,
          sessionFlavor: "mixed",
          priorityCharacters: ["a", "e", "r", "t"],
          recoveryCharacters: ["a", "s"],
          reinforcementCharacters: ["r", "t"],
          bridgeCharacters: ["l", "i", "n"],
          explorationCharacters: ["o"],
          activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.!?"),
          contentSourceBias: "mixed",
          punctuationEnabled: true,
          capitalizationEnabled: true,
          contentFamilyId: "adaptive-blend",
          difficultyBand: "foundational",
        }),
      ),
    );

    const calmRuns = foundationalRuns.filter((passage) => {
      const clauseCount = (passage.text.match(/[,;:]/gu) ?? []).length;
      return (
        sentenceCount(passage.text) >= 2 &&
        punctuationRatio(passage.text) <= 0.035 &&
        clauseCount <= 1 &&
        !adaptiveNoisePattern.test(passage.text)
      );
    });

    expect(calmRuns.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps content families visibly distinct in token composition", async () => {
    const commonPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 16,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz0123456789-_/.,!?[]{}()"),
      contentSourceBias: "real",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
      difficultyBand: "developing",
    });
    const pseudoPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 16,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "synthetic",
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "pseudo-words",
      difficultyBand: "advanced",
    });
    const symbolPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "symbols",
      priorityCharacters: ["[", "]", "{", "}"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz0123456789-_/.,!?[]{}()<>=+&|:\"'`~"),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "symbol-drills",
      difficultyBand: "advanced",
    });
    const numberPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "numbers",
      priorityCharacters: ["1", "2", "3"],
      activeCharacterSet: Array.from("0123456789-/:.+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "number-drills",
      difficultyBand: "advanced",
    });
    const codePassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "code",
      priorityCharacters: ["(", ")", "{", "}"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.,!?[]{}()<>=+&|:\"'`~$"),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "code-drills",
      difficultyBand: "advanced",
    });
    const shellPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "code",
      priorityCharacters: ["-", "/", "|"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.,!?[]{}()<>=+&|:\"'`~$"),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "shell-drills",
      difficultyBand: "advanced",
      programmerDrillPresetId: "shell-commands",
    });

    const englishWordBundle = await loadLanguageContentBundle({
      languageId: "english",
      contentFamilyId: "common-words",
    });
    const englishRealWords = new Set(
      [
        ...(englishWordBundle.commonWordsPack?.stages.foundational ?? []),
        ...(englishWordBundle.commonWordsPack?.stages.developing ?? []),
        ...(englishWordBundle.commonWordsPack?.stages.advanced ?? []),
      ].map((entry) => entry.token.toLowerCase()),
    );
    const pseudoTokens = tokenize(pseudoPassage.text);
    const pseudoRealShare =
      pseudoTokens.filter((token) => englishRealWords.has(token)).length /
      Math.max(pseudoTokens.length, 1);

    expect(punctuationRatio(commonPassage.text)).toBeLessThan(0.08);
    expect(overlapRatio(tokenize(commonPassage.text), pseudoTokens)).toBeLessThan(0.45);
    expect(pseudoRealShare).toBeLessThan(0.35);
    expect(punctuationRatio(symbolPassage.text)).toBeGreaterThan(0.18);
    expect(digitRatio(numberPassage.text)).toBeGreaterThan(0.18);
    expect(codePassage.text).toMatch(/=>|\w+\.\w+|\(|\)|\{|\}|\[/u);
    expect(shellPassage.text).toMatch(/--|\/|~\/|\|/u);
  });

  it("keeps shell, number, and symbol corpora substantially populated", () => {
    expect(shellCommandSequences.length).toBeGreaterThanOrEqual(90);
    expect(shellCommandTerms.length).toBeGreaterThanOrEqual(55);
    expect(symbolPatternSequences.length + punctuationClusters.length).toBeGreaterThanOrEqual(105);
    expect(
      numericClusters.length +
        dateAndTimePatterns.length +
        measurementPatterns.length +
        benchmarkNumberPatterns.length,
    ).toBeGreaterThanOrEqual(58);
  });

  it("keeps foundational and developing number drills numerically coherent", async () => {
    const foundationalAndDevelopingNumberLibrary = [
      ...numberPatternTiers.foundational,
      ...numberPatternTiers.developing,
    ].join(" ");
    const foundationalNumberPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "numbers",
      priorityCharacters: ["1", "2", "3"],
      activeCharacterSet: Array.from("0123456789-/:.+#ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$€£¥% "),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "number-drills",
      difficultyBand: "foundational",
    });
    const developingNumberPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "numbers",
      priorityCharacters: ["1", "2", "3"],
      activeCharacterSet: Array.from("0123456789-/:.+#ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$€£¥% "),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "number-drills",
      difficultyBand: "developing",
    });

    expect(foundationalAndDevelopingNumberLibrary).not.toMatch(disallowedNumberLexicalTokenPattern);
    expect(numpadDrillFragments.join(" ")).not.toMatch(disallowedNumberLexicalTokenPattern);
    expect(foundationalNumberPassage.text).not.toMatch(disallowedNumberLexicalTokenPattern);
    expect(developingNumberPassage.text).not.toMatch(disallowedNumberLexicalTokenPattern);
    expect(extractAlphaTokens(foundationalNumberPassage.text).every((token) => ["ID", "v"].includes(token))).toBe(
      true,
    );
    expect(extractAlphaTokens(developingNumberPassage.text).every((token) => ["ID", "v"].includes(token))).toBe(
      true,
    );
  });

  it("keeps symbol drills identifier-free and code-free", async () => {
    const symbolLibrary = [...Object.values(symbolPatternTiers).flat(), ...punctuationClusters].join(" ");
    const foundationalSymbolPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "symbols",
      priorityCharacters: ["(", ")", "[", "]"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz[]{}()<>/\\\\\"'`~+-_=;:,.!?|&$%#@ "),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "symbol-drills",
      difficultyBand: "foundational",
    });
    const expertSymbolPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "symbols",
      priorityCharacters: ["(", ")", "[", "]"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz[]{}()<>/\\\\\"'`~+-_=;:,.!?|&$%#@ "),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "symbol-drills",
      difficultyBand: "expert-control",
    });

    expect(symbolLibrary).not.toMatch(symbolIdentifierPattern);
    expect(foundationalSymbolPassage.text).not.toMatch(symbolIdentifierPattern);
    expect(expertSymbolPassage.text).not.toMatch(symbolIdentifierPattern);
    expect(foundationalSymbolPassage.text).not.toMatch(/\d/u);
    expect(expertSymbolPassage.text).not.toMatch(/\d/u);
  });

  it("makes specialty-mode difficulty bands structurally distinct", async () => {
    const shellFoundational = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "code",
      priorityCharacters: ["-", "/"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.:\"' "),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "shell-drills",
      difficultyBand: "foundational",
      programmerDrillPresetId: "shell-commands",
    });
    const shellExpert = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "code",
      priorityCharacters: ["-", "/", "|"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.:\"'()|&$=<> "),
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "shell-drills",
      difficultyBand: "expert-control",
      programmerDrillPresetId: "shell-commands",
    });
    const numberFoundational = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "numbers",
      priorityCharacters: ["1", "2", "3"],
      activeCharacterSet: Array.from("0123456789-/:.+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz "),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "number-drills",
      difficultyBand: "foundational",
    });
    const numberExpert = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "numbers",
      priorityCharacters: ["1", "2", "3"],
      activeCharacterSet: Array.from("0123456789-/:.+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$=, "),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "number-drills",
      difficultyBand: "expert-control",
    });
    const symbolFoundational = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "symbols",
      priorityCharacters: ["(", ")", "[", "]"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz[]{}()<>/\\\\\"'`~+-_=;:,.!? "),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "symbol-drills",
      difficultyBand: "foundational",
    });
    const symbolExpert = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 12,
      sessionFlavor: "symbols",
      priorityCharacters: ["(", ")", "[", "]"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz[]{}()<>/\\\\\"'`~+-_=;:,.!?|&$%#@ "),
      contentSourceBias: "synthetic",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "symbol-drills",
      difficultyBand: "expert-control",
    });

    expect(shellFoundational.text).not.toMatch(/\||2>&1|\$\(git|journalctl|docker/u);
    expect(shellExpert.text).toMatch(/\||2>&1|\$\(git|journalctl|docker|tee/u);
    expect(numberFoundational.text).not.toMatch(/SN-|T\d{2}:\d{2}:\d{2}|Q\d|W\d|Z\b/u);
    expect(numberExpert.text).toMatch(/SN-|T\d{2}:\d{2}:\d{2}|Q\d|W\d|Z\b|\$/u);
    expect(symbolFoundational.text).not.toMatch(/=>|&&|\|\||\/\*|\*\/|<<>>/u);
    expect(symbolExpert.text).toMatch(/=>|&&|\|\||\/\*|\*\/|<<>>/u);
    expect(separatorDensity(shellExpert.text)).toBeGreaterThan(separatorDensity(shellFoundational.text));
    expect(punctuationRatio(symbolExpert.text)).toBeGreaterThan(punctuationRatio(symbolFoundational.text));
  });

  it("keeps specialty passages broader and less repetitive across consecutive lessons", async () => {
    const shellBase = {
      languageId: "english" as const,
      targetWordCount: 12,
      sessionFlavor: "code" as const,
      priorityCharacters: ["-", "/", "|"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.:\"'()|&$=<> "),
      contentSourceBias: "mixed" as const,
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "shell-drills" as const,
      difficultyBand: "advanced" as const,
      programmerDrillPresetId: "shell-commands",
    };
    const numberBase = {
      languageId: "english" as const,
      targetWordCount: 12,
      sessionFlavor: "numbers" as const,
      priorityCharacters: ["1", "2", "3"],
      activeCharacterSet: Array.from("0123456789-/:.+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$=, "),
      contentSourceBias: "synthetic" as const,
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "number-drills" as const,
      difficultyBand: "advanced" as const,
    };
    const symbolBase = {
      languageId: "english" as const,
      targetWordCount: 12,
      sessionFlavor: "symbols" as const,
      priorityCharacters: ["(", ")", "[", "]"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz[]{}()<>/\\\\\"'`~+-_=;:,.!?|&$%#@ "),
      contentSourceBias: "synthetic" as const,
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "symbol-drills" as const,
      difficultyBand: "advanced" as const,
    };

    const firstShell = await generatePackedPassage(shellBase);
    const secondShell = await generatePackedPassage({
      ...shellBase,
      recentSessions: [
        buildRecentSession({
          languageId: "english",
          promptText: firstShell.text,
          activeCharacterSet: shellBase.activeCharacterSet,
          priorityCharacters: shellBase.priorityCharacters,
          contentFamilyId: "shell-drills",
          sessionFlavor: "code",
        }),
      ],
    });
    const firstNumber = await generatePackedPassage(numberBase);
    const secondNumber = await generatePackedPassage({
      ...numberBase,
      recentSessions: [
        buildRecentSession({
          languageId: "english",
          promptText: firstNumber.text,
          activeCharacterSet: numberBase.activeCharacterSet,
          priorityCharacters: numberBase.priorityCharacters,
          contentFamilyId: "number-drills",
          sessionFlavor: "numbers",
        }),
      ],
    });
    const firstSymbol = await generatePackedPassage(symbolBase);
    const secondSymbol = await generatePackedPassage({
      ...symbolBase,
      recentSessions: [
        buildRecentSession({
          languageId: "english",
          promptText: firstSymbol.text,
          activeCharacterSet: symbolBase.activeCharacterSet,
          priorityCharacters: symbolBase.priorityCharacters,
          contentFamilyId: "symbol-drills",
          sessionFlavor: "symbols",
        }),
      ],
    });

    const secondShellTokens = tokenize(secondShell.text);
    const secondNumberTokens = tokenize(secondNumber.text);
    const secondSymbolTokens = splitSymbolFragments(secondSymbol.text);

    expect(new Set(secondShellTokens).size).toBeGreaterThanOrEqual(10);
    expect(new Set(secondNumberTokens).size).toBeGreaterThanOrEqual(10);
    expect(new Set(secondSymbolTokens).size).toBeGreaterThanOrEqual(5);
    expect(overlapRatio(secondShellTokens, tokenize(firstShell.text))).toBeLessThan(0.72);
    expect(overlapRatio(secondNumberTokens, tokenize(firstNumber.text))).toBeLessThan(0.72);
    expect(overlapRatio(secondSymbolTokens, splitSymbolFragments(firstSymbol.text))).toBeLessThan(0.82);
    expect(maxTokenReuseRatio(secondShellTokens)).toBeLessThanOrEqual(0.3);
    expect(maxTokenReuseRatio(secondNumberTokens)).toBeLessThanOrEqual(0.3);
    expect(maxTokenReuseRatio(secondSymbolTokens)).toBeLessThanOrEqual(0.4);
  });

  it("cools repeated-token ratios across consecutive common-word sessions", async () => {
    const baseOptions = {
      languageId: "english" as const,
      targetWordCount: 14,
      sessionFlavor: "plain" as const,
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
      contentSourceBias: "real" as const,
      punctuationEnabled: false,
      capitalizationEnabled: false,
      contentFamilyId: "common-words",
      difficultyBand: "developing" as const,
    };
    const firstPassage = await generatePackedPassage(baseOptions);
    const secondPassage = await generatePackedPassage({
      ...baseOptions,
      recentSessions: [
        {
          sessionId: "recent-common-1",
          sessionKind: "adaptive",
          sessionFlavor: "plain",
          contentFamilyId: "common-words",
          languageId: "english",
          keyboardFamilyId: "ansi-tenkeyless",
          keyboardLayoutId: "ansi-us-tenkeyless",
          inputMode: "hardware",
          promptText: firstPassage.text,
          typedText: firstPassage.text,
          startedAt: "2026-03-16T12:00:00.000Z",
          endedAt: "2026-03-16T12:01:00.000Z",
          completed: true,
          priorityCharacters: ["a", "e", "r", "t"],
          activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
          unlockedCharacters: Array.from("abcdefghijklmnopqrstuvwxyz"),
          attemptLog: [],
          perCharacterPerformance: {},
          grossWpm: 72,
          netWpm: 70,
          accuracy: 98,
          correctedErrorCount: 1,
          uncorrectedErrorCount: 0,
          durationMs: 60_000,
        },
      ],
    });
    const thirdPassage = await generatePackedPassage({
      ...baseOptions,
      recentSessions: [
        {
          sessionId: "recent-common-1",
          sessionKind: "adaptive",
          sessionFlavor: "plain",
          contentFamilyId: "common-words",
          languageId: "english",
          keyboardFamilyId: "ansi-tenkeyless",
          keyboardLayoutId: "ansi-us-tenkeyless",
          inputMode: "hardware",
          promptText: firstPassage.text,
          typedText: firstPassage.text,
          startedAt: "2026-03-16T12:00:00.000Z",
          endedAt: "2026-03-16T12:01:00.000Z",
          completed: true,
          priorityCharacters: ["a", "e", "r", "t"],
          activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
          unlockedCharacters: Array.from("abcdefghijklmnopqrstuvwxyz"),
          attemptLog: [],
          perCharacterPerformance: {},
          grossWpm: 72,
          netWpm: 70,
          accuracy: 98,
          correctedErrorCount: 1,
          uncorrectedErrorCount: 0,
          durationMs: 60_000,
        },
        {
          sessionId: "recent-common-2",
          sessionKind: "adaptive",
          sessionFlavor: "plain",
          contentFamilyId: "common-words",
          languageId: "english",
          keyboardFamilyId: "ansi-tenkeyless",
          keyboardLayoutId: "ansi-us-tenkeyless",
          inputMode: "hardware",
          promptText: secondPassage.text,
          typedText: secondPassage.text,
          startedAt: "2026-03-16T12:02:00.000Z",
          endedAt: "2026-03-16T12:03:00.000Z",
          completed: true,
          priorityCharacters: ["a", "e", "r", "t"],
          activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz"),
          unlockedCharacters: Array.from("abcdefghijklmnopqrstuvwxyz"),
          attemptLog: [],
          perCharacterPerformance: {},
          grossWpm: 71,
          netWpm: 69,
          accuracy: 97,
          correctedErrorCount: 2,
          uncorrectedErrorCount: 0,
          durationMs: 60_000,
        },
      ],
    });

    const priorTokens = [...tokenize(firstPassage.text), ...tokenize(secondPassage.text)];
    const thirdTokens = tokenize(thirdPassage.text);

    expect(overlapRatio(thirdTokens, priorTokens)).toBeLessThan(0.7);
    expect(maxTokenReuseRatio(thirdTokens)).toBeLessThanOrEqual(0.25);
  });

  it("keeps Persian phrase drills readable with stable RTL spacing", async () => {
    const persianCharacterPool = buildLanguageCharacterPool({
      languageId: "persian",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      activeCharacterRange: "full",
    });
    const phrasePassage = await generatePackedPassage({
      languageId: "persian",
      targetWordCount: 20,
      sessionFlavor: "mixed",
      priorityCharacters: ["ر", "ت", "م", "د"],
      activeCharacterSet: persianCharacterPool,
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "phrase-drills",
      difficultyBand: "developing",
    });

    const tokens = tokenizeForLanguage(phrasePassage.text, "persian");

    expect(tokens.length).toBeGreaterThanOrEqual(10);
    expect(phrasePassage.text).toMatch(/[.،؛؟]/u);
    expect(phrasePassage.text).not.toMatch(/\s[،؛؟]/u);
    expect(phrasePassage.text).not.toMatch(/\u200c\s|\s\u200c/u);
    expect(hasAlternatingLoop(tokens)).toBe(false);
  });

  it("keeps Persian benchmark passages multi-sentence and benchmark-like", async () => {
    const persianCharacterPool = buildLanguageCharacterPool({
      languageId: "persian",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      activeCharacterRange: "full",
    });
    const bookPassage = await generatePackedPassage({
      languageId: "persian",
      targetWordCount: 28,
      sessionFlavor: "plain",
      priorityCharacters: ["ر", "ت", "م", "د"],
      activeCharacterSet: persianCharacterPool,
      contentSourceBias: "real",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "quote-drills",
      difficultyBand: "advanced",
    });

    const tokens = tokenizeForLanguage(bookPassage.text, "persian");
    const sentences = bookPassage.text.split(/[.!؟]/u).filter((segment) => segment.trim().length > 0);

    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(bookPassage.contentMetrics.contentVariantId).toBe("book-passage");
    expect(bookPassage.contentMetrics.lexicalDiversity).toBeGreaterThanOrEqual(0.45);
    expect(maxTokenReuseRatio(tokens)).toBeLessThanOrEqual(0.3);
  });

  it("keeps natural-language phrase and benchmark families free of code and shell leakage", async () => {
    const broadCharacterSet = Array.from(
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.,!?[]{}()<>:\"'`~",
    );
    const phrasePassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 20,
      sessionFlavor: "mixed",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: broadCharacterSet,
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      contentFamilyId: "phrase-drills",
      difficultyBand: "developing",
    });
    const benchmarkPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 28,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: broadCharacterSet,
      contentSourceBias: "real",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      contentFamilyId: "quote-drills",
      difficultyBand: "advanced",
    });

    expect(phrasePassage.text).not.toMatch(naturalLanguageLeakPattern);
    expect(benchmarkPassage.text).not.toMatch(naturalLanguageLeakPattern);
  });

  it("keeps benchmark passages from repeating the same sentence opener", async () => {
    const benchmarkPassage = await generatePackedPassage({
      languageId: "english",
      targetWordCount: 28,
      sessionFlavor: "plain",
      priorityCharacters: ["a", "e", "r", "t"],
      activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.!?"),
      contentSourceBias: "real",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      contentFamilyId: "quote-drills",
      difficultyBand: "advanced",
    });

    const openers = sentenceOpeners(benchmarkPassage.text, "english");

    expect(openers.length).toBeGreaterThanOrEqual(2);
    expect(new Set(openers).size).toBe(openers.length);
  });

  it("keeps Russian phrase drills readable under full Cyrillic coverage", async () => {
    const russianCharacterPool = buildLanguageCharacterPool({
      languageId: "russian",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      activeCharacterRange: "full",
    });
    const phrasePassage = await generatePackedPassage({
      languageId: "russian",
      targetWordCount: 20,
      sessionFlavor: "mixed",
      priorityCharacters: ["р", "т", "н", "о"],
      activeCharacterSet: russianCharacterPool,
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      contentFamilyId: "phrase-drills",
      difficultyBand: "developing",
    });

    const tokens = tokenizeForLanguage(phrasePassage.text, "russian");

    expect(tokens.length).toBeGreaterThanOrEqual(10);
    expect(new Set(tokens).size).toBeGreaterThanOrEqual(8);
    expect(maxTokenReuseRatio(tokens)).toBeLessThanOrEqual(0.3);
    expect(hasAlternatingLoop(tokens)).toBe(false);
  });

  it("keeps adaptive blend language-pure across Persian, Japanese, and Russian", async () => {
    const persianCharacterPool = buildLanguageCharacterPool({
      languageId: "persian",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      activeCharacterRange: "full",
    });
    const japaneseCharacterPool = buildLanguageCharacterPool({
      languageId: "japanese",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      activeCharacterRange: "full",
    });
    const russianCharacterPool = buildLanguageCharacterPool({
      languageId: "russian",
      punctuationEnabled: true,
      capitalizationEnabled: true,
      activeCharacterRange: "full",
    });

    const [persianAdaptive, japaneseAdaptive, russianAdaptive] = await Promise.all([
      generatePackedPassage({
        languageId: "persian",
        targetWordCount: 22,
        sessionFlavor: "mixed",
        priorityCharacters: ["ر", "ت", "م", "د"],
        bridgeCharacters: ["ا", "ن", "ی"],
        reinforcementCharacters: ["ه", "ش"],
        activeCharacterSet: persianCharacterPool,
        contentSourceBias: "mixed",
        punctuationEnabled: true,
        capitalizationEnabled: false,
        contentFamilyId: "adaptive-blend",
        difficultyBand: "developing",
      }),
      generatePackedPassage({
        languageId: "japanese",
        targetWordCount: 20,
        sessionFlavor: "mixed",
        priorityCharacters: ["し", "て", "り", "ず"],
        bridgeCharacters: ["な", "い", "う"],
        reinforcementCharacters: ["も", "と"],
        activeCharacterSet: japaneseCharacterPool,
        contentSourceBias: "mixed",
        punctuationEnabled: true,
        capitalizationEnabled: false,
        contentFamilyId: "adaptive-blend",
        difficultyBand: "developing",
      }),
      generatePackedPassage({
        languageId: "russian",
        targetWordCount: 22,
        sessionFlavor: "mixed",
        priorityCharacters: ["р", "т", "н", "о"],
        bridgeCharacters: ["а", "е", "и"],
        reinforcementCharacters: ["с", "л"],
        activeCharacterSet: russianCharacterPool,
        contentSourceBias: "mixed",
        punctuationEnabled: true,
        capitalizationEnabled: true,
        contentFamilyId: "adaptive-blend",
        difficultyBand: "developing",
      }),
    ]);

    for (const passage of [persianAdaptive, japaneseAdaptive, russianAdaptive]) {
      expect(passage.text).not.toMatch(adaptiveNoisePattern);
      expect(sentenceCount(passage.text)).toBeGreaterThanOrEqual(2);
      expect(latinTokenCount(passage.text)).toBeLessThanOrEqual(1);
    }

    expect(tokenizeForLanguage(persianAdaptive.text, "persian").length).toBeGreaterThanOrEqual(10);
    expect(tokenizeForLanguage(japaneseAdaptive.text, "japanese").length).toBeGreaterThanOrEqual(10);
    expect(tokenizeForLanguage(russianAdaptive.text, "russian").length).toBeGreaterThanOrEqual(10);
  });

  it("keeps foundational Persian adaptive lessons lightly punctuated and non-meta", async () => {
    const persianCharacters = Array.from("اردمنتویهلکپسب");
    const persianRuns = await Promise.all(
      Array.from({ length: 4 }, () =>
        generatePackedPassage({
          languageId: "persian",
          targetWordCount: 18,
          sessionFlavor: "mixed",
          priorityCharacters: ["ر", "ت", "م"],
          bridgeCharacters: ["ا", "ن", "د"],
          reinforcementCharacters: ["ی", "ه"],
          activeCharacterSet: persianCharacters,
          contentSourceBias: "mixed",
          punctuationEnabled: true,
          capitalizationEnabled: false,
          contentFamilyId: "adaptive-blend",
          difficultyBand: "foundational",
        }),
      ),
    );

    const calmRuns = persianRuns.filter((passage) => {
      const tokens = tokenizeForLanguage(passage.text, "persian");
      const punctuationCount = (passage.text.match(/[^\p{L}\p{N}\s]/gu) ?? []).length;
      const visibleSentenceCount = sentenceCount(passage.text);
      return (
        tokens.length >= 10 &&
        punctuationCount <= visibleSentenceCount &&
        !/[،؛؟"'«»“”]/u.test(passage.text) &&
        !persianMachineryPattern.test(passage.text) &&
        !hasAlternatingLoop(tokens)
      );
    });

    expect(calmRuns.length).toBeGreaterThanOrEqual(3);
  });

  it("leans on sentence support instead of token soup in adaptive blend", async () => {
    const englishAdaptiveRuns = await Promise.all(
      Array.from({ length: 6 }, () =>
        generatePackedPassage({
          languageId: "english",
          targetWordCount: 24,
          sessionFlavor: "mixed",
          priorityCharacters: ["a", "e", "r", "t"],
          recoveryCharacters: ["a", "s"],
          reinforcementCharacters: ["r", "t"],
          bridgeCharacters: ["l", "i", "n"],
          explorationCharacters: ["o", "d"],
          fluencyCharacters: ["h", "m", "c"],
          activeCharacterSet: Array.from("abcdefghijklmnopqrstuvwxyz,.!?"),
          contentSourceBias: "mixed",
          punctuationEnabled: true,
          capitalizationEnabled: true,
          contentFamilyId: "adaptive-blend",
          difficultyBand: "developing",
        }),
      ),
    );

    const sentenceLikeRuns = englishAdaptiveRuns.filter(
      (passage) =>
        sentenceCount(passage.text) >= 2 &&
        tokenizeForLanguage(passage.text, "english").length >= 12 &&
        !adaptiveNoisePattern.test(passage.text),
    );

    expect(sentenceLikeRuns.length).toBeGreaterThanOrEqual(5);
  });

  it("resists repetition across consecutive Persian and Russian adaptive lessons", async () => {
    const persianCharacters = Array.from("اردمنتویهلکپسب");
    const russianCharacters = Array.from("авеинорстлкмудп");
    const firstPersianPassage = await generatePackedPassage({
      languageId: "persian",
      targetWordCount: 18,
      sessionFlavor: "mixed",
      priorityCharacters: ["ر", "ت", "م"],
      bridgeCharacters: ["ا", "ن", "د"],
      reinforcementCharacters: ["ی", "ه"],
      activeCharacterSet: persianCharacters,
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "adaptive-blend",
      difficultyBand: "foundational",
    });
    const secondPersianPassage = await generatePackedPassage({
      languageId: "persian",
      targetWordCount: 18,
      sessionFlavor: "mixed",
      priorityCharacters: ["ر", "ت", "م"],
      bridgeCharacters: ["ا", "ن", "د"],
      reinforcementCharacters: ["ی", "ه"],
      activeCharacterSet: persianCharacters,
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "adaptive-blend",
      difficultyBand: "foundational",
      recentSessions: [
        buildRecentSession({
          languageId: "persian",
          promptText: firstPersianPassage.text,
          activeCharacterSet: persianCharacters,
          priorityCharacters: ["ر", "ت", "م"],
          contentFamilyId: "adaptive-blend",
          sessionFlavor: "mixed",
        }),
      ],
    });
    const firstRussianPassage = await generatePackedPassage({
      languageId: "russian",
      targetWordCount: 18,
      sessionFlavor: "mixed",
      priorityCharacters: ["р", "т", "н"],
      bridgeCharacters: ["а", "о", "в"],
      reinforcementCharacters: ["е", "и"],
      activeCharacterSet: russianCharacters,
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "adaptive-blend",
      difficultyBand: "foundational",
    });
    const secondRussianPassage = await generatePackedPassage({
      languageId: "russian",
      targetWordCount: 18,
      sessionFlavor: "mixed",
      priorityCharacters: ["р", "т", "н"],
      bridgeCharacters: ["а", "о", "в"],
      reinforcementCharacters: ["е", "и"],
      activeCharacterSet: russianCharacters,
      contentSourceBias: "mixed",
      punctuationEnabled: true,
      capitalizationEnabled: false,
      contentFamilyId: "adaptive-blend",
      difficultyBand: "foundational",
      recentSessions: [
        buildRecentSession({
          languageId: "russian",
          promptText: firstRussianPassage.text,
          activeCharacterSet: russianCharacters,
          priorityCharacters: ["р", "т", "н"],
          contentFamilyId: "adaptive-blend",
          sessionFlavor: "mixed",
        }),
      ],
    });

    const firstPersianTokens = tokenizeForLanguage(firstPersianPassage.text, "persian");
    const secondPersianTokens = tokenizeForLanguage(secondPersianPassage.text, "persian");
    const firstRussianTokens = tokenizeForLanguage(firstRussianPassage.text, "russian");
    const secondRussianTokens = tokenizeForLanguage(secondRussianPassage.text, "russian");

    expect(new Set(secondPersianTokens).size).toBeGreaterThanOrEqual(6);
    expect(maxTokenReuseRatio(secondPersianTokens)).toBeLessThanOrEqual(0.34);
    expect(overlapRatio(secondPersianTokens, firstPersianTokens)).toBeLessThan(0.82);
    expect(hasAlternatingLoop(secondPersianTokens)).toBe(false);
    expect(new Set(secondRussianTokens).size).toBeGreaterThanOrEqual(6);
    expect(maxTokenReuseRatio(secondRussianTokens)).toBeLessThanOrEqual(0.34);
    expect(overlapRatio(secondRussianTokens, firstRussianTokens)).toBeLessThan(0.96);
    expect(hasAlternatingLoop(secondRussianTokens)).toBe(false);
  });
});
