import type { ScriptFamily } from "@/content/languages/language-text-metadata";
import { SPACE_SKIP_MARKER } from "@/lib/input/typing-markers";
import { segmentTextIntoGraphemes } from "@/lib/text/language-text-normalization";

export interface InputLanguageMismatch {
  observedScriptFamily: ScriptFamily;
  sampleCount: number;
  confidence: number;
}

const scriptMatchers: Record<ScriptFamily, RegExp> = {
  latin: /\p{Script=Latin}/u,
  cyrillic: /\p{Script=Cyrillic}/u,
  arabic: /\p{Script=Arabic}/u,
  hebrew: /\p{Script=Hebrew}/u,
  greek: /\p{Script=Greek}/u,
  devanagari: /\p{Script=Devanagari}/u,
  hiragana: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  thai: /\p{Script=Thai}/u,
};

function isScriptCandidate(character: string) {
  return (
    character !== SPACE_SKIP_MARKER &&
    !/[\s\p{P}\p{S}\p{N}\u200b-\u200d\ufeff]/u.test(character) &&
    /[\p{L}\p{M}]/u.test(character)
  );
}

function detectCharacterScriptFamily(character: string) {
  return (
    (Object.entries(scriptMatchers).find(([, matcher]) => matcher.test(character))?.[0] as
      | ScriptFamily
      | undefined) ?? null
  );
}

function collectRecentScriptSample(value: string, maxSampleLength = 8) {
  const recentCharacters: string[] = [];

  for (const grapheme of segmentTextIntoGraphemes(value).reverse()) {
    if (!isScriptCandidate(grapheme.text)) {
      continue;
    }

    recentCharacters.unshift(grapheme.text);

    if (recentCharacters.length >= maxSampleLength) {
      break;
    }
  }

  const counts = recentCharacters.reduce((map, character) => {
    const scriptFamily = detectCharacterScriptFamily(character);

    if (!scriptFamily) {
      return map;
    }

    map.set(scriptFamily, (map.get(scriptFamily) ?? 0) + 1);
    return map;
  }, new Map<ScriptFamily, number>());

  const dominantEntry = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;

  return {
    recentCharacters,
    counts,
    dominantScriptFamily: dominantEntry?.[0] ?? null,
    dominantCount: dominantEntry?.[1] ?? 0,
  };
}

function collectTrailingScriptRun(value: string) {
  let trailingScriptFamily: ScriptFamily | null = null;
  let trailingCount = 0;

  for (const grapheme of segmentTextIntoGraphemes(value).reverse()) {
    if (!isScriptCandidate(grapheme.text)) {
      continue;
    }

    const scriptFamily = detectCharacterScriptFamily(grapheme.text);

    if (!scriptFamily) {
      continue;
    }

    if (!trailingScriptFamily) {
      trailingScriptFamily = scriptFamily;
      trailingCount = 1;
      continue;
    }

    if (scriptFamily !== trailingScriptFamily) {
      break;
    }

    trailingCount += 1;
  }

  return {
    scriptFamily: trailingScriptFamily,
    count: trailingCount,
  };
}

function getMinimumMismatchRunLength(expectedScriptFamily: ScriptFamily) {
  return expectedScriptFamily === "latin" ? 2 : 3;
}

export function detectInputLanguageMismatch(options: {
  value: string;
  expectedScriptFamily?: ScriptFamily;
}) {
  if (!options.expectedScriptFamily) {
    return null;
  }

  const sample = collectRecentScriptSample(options.value);
  const trailingRun = collectTrailingScriptRun(options.value);
  const sampleCount = sample.recentCharacters.length;
  const expectedScriptCount = sample.counts.get(options.expectedScriptFamily) ?? 0;
  const observedScriptFamily =
    trailingRun.scriptFamily &&
    trailingRun.scriptFamily !== options.expectedScriptFamily &&
    trailingRun.count >= getMinimumMismatchRunLength(options.expectedScriptFamily)
      ? trailingRun.scriptFamily
      : sample.dominantScriptFamily;

  if (
    sampleCount < 3 ||
    !observedScriptFamily ||
    observedScriptFamily === options.expectedScriptFamily
  ) {
    return null;
  }

  if (
    trailingRun.scriptFamily !== observedScriptFamily ||
    trailingRun.count < getMinimumMismatchRunLength(options.expectedScriptFamily)
  ) {
    return null;
  }

  const observedCount =
    observedScriptFamily === sample.dominantScriptFamily
      ? sample.dominantCount
      : sample.counts.get(observedScriptFamily) ?? trailingRun.count;
  const confidenceFloor =
    trailingRun.scriptFamily === observedScriptFamily &&
    trailingRun.count >= getMinimumMismatchRunLength(options.expectedScriptFamily) + 1
      ? 0.78
      : 0;
  const confidence = Math.max(
    observedCount / Math.max(sampleCount, 1),
    trailingRun.count / Math.max(sampleCount, 1),
    confidenceFloor,
  );

  if (
    confidence < 0.72 ||
    (expectedScriptCount > 0 &&
      observedCount - expectedScriptCount < 2 &&
      trailingRun.count < getMinimumMismatchRunLength(options.expectedScriptFamily) + 1)
  ) {
    return null;
  }

  return {
    observedScriptFamily,
    sampleCount,
    confidence,
  } satisfies InputLanguageMismatch;
}

export function formatObservedScriptLabel(scriptFamily: ScriptFamily) {
  switch (scriptFamily) {
    case "latin":
      return "English/Latin";
    case "cyrillic":
      return "Russian/Cyrillic";
    case "arabic":
      return "Persian/Arabic";
    case "hiragana":
      return "Japanese";
    case "devanagari":
      return "Hindi/Devanagari";
    case "hebrew":
      return "Hebrew";
    case "greek":
      return "Greek";
    case "thai":
      return "Thai";
    default:
      return "another script";
  }
}

export function buildInputLanguageMismatchWarning(options: {
  expectedLanguageLabel: string;
  expectedInputLabel?: string | null;
  mismatch: InputLanguageMismatch;
}) {
  const observedLabel = formatObservedScriptLabel(options.mismatch.observedScriptFamily);
  const expectedInputLabel =
    options.expectedInputLabel && options.expectedInputLabel !== options.expectedLanguageLabel
      ? `${options.expectedLanguageLabel} (${options.expectedInputLabel})`
      : options.expectedLanguageLabel;

  return `You appear to be typing ${observedLabel} characters while practicing ${options.expectedLanguageLabel}. Switch your keyboard/input language to ${expectedInputLabel}.`;
}
