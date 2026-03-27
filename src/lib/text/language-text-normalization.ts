export const ZERO_WIDTH_NON_JOINER = "\u200c";
export const INLINE_WORD_CHARACTERS = ["-", "'", "’", ZERO_WIDTH_NON_JOINER] as const;

export interface TextGraphemeSegment {
  text: string;
  start: number;
  end: number;
}

const SHARED_TOKEN_PATTERN = /[\p{L}\p{M}\p{N}\u200c'’-]+/gu;
const SHARED_TOKEN_EDGE_PATTERN = /^[^\p{L}\p{M}\p{N}\u200c'’-]+|[^\p{L}\p{M}\p{N}\u200c'’-]+$/gu;
const SHARED_TRAILING_FRAGMENT_PUNCTUATION_PATTERN = /[.!?؟;:،؛,]+$/u;
const SHARED_SENTENCE_ENDING_PATTERN = /[.!?؟。！？]$/u;
const SHARED_ENDING_PUNCTUATION_PATTERN = /([,.;:!?؟،؛])(?=[^\s)\]}»])/gu;
const SHARED_LEADING_PUNCTUATION_PATTERN = /\s+([,.;:!?؟،؛)\]}»])/gu;
const SHARED_OPENING_BRACKET_PATTERN = /([(\[{«])\s+/gu;
const PERSIAN_EDGE_ZWNJ_PATTERN = /^\u200c+|\u200c+$/gu;

type GraphemeSegmenter = {
  segment(value: string): Iterable<{
    segment: string;
    index: number;
  }>;
};

const GraphemeSegmenterConstructor = (
  Intl as typeof Intl & {
    Segmenter?: new (
      locales?: string | string[],
      options?: {
        granularity?: "grapheme";
      },
    ) => GraphemeSegmenter;
  }
).Segmenter;

const graphemeSegmenter = GraphemeSegmenterConstructor
  ? new GraphemeSegmenterConstructor(undefined, { granularity: "grapheme" })
  : null;

const persianCharacterMap: Record<string, string> = {
  "ك": "ک",
  "ي": "ی",
  "ى": "ی",
};

const arabicIndicToPersianDigitMap: Record<string, string> = {
  "٠": "۰",
  "١": "۱",
  "٢": "۲",
  "٣": "۳",
  "٤": "۴",
  "٥": "۵",
  "٦": "۶",
  "٧": "۷",
  "٨": "۸",
  "٩": "۹",
};

function replaceMappedCharacters(value: string, characterMap: Record<string, string>) {
  return Array.from(value, (character) => characterMap[character] ?? character).join("");
}

function collapseWhitespace(value: string) {
  return value.replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
}

export function segmentTextIntoGraphemes(value: string): TextGraphemeSegment[] {
  if (!value) {
    return [];
  }

  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(value), (segment) => ({
      text: segment.segment,
      start: segment.index,
      end: segment.index + segment.segment.length,
    }));
  }

  const graphemes: TextGraphemeSegment[] = [];
  let offset = 0;

  for (const character of Array.from(value)) {
    graphemes.push({
      text: character,
      start: offset,
      end: offset + character.length,
    });
    offset += character.length;
  }

  return graphemes;
}

export function trimTextToCodeUnitLengthAtGraphemeBoundary(value: string, maxLength: number) {
  if (maxLength <= 0 || !value) {
    return "";
  }

  let safeEnd = 0;

  for (const grapheme of segmentTextIntoGraphemes(value)) {
    if (grapheme.end > maxLength) {
      break;
    }

    safeEnd = grapheme.end;
  }

  return value.slice(0, safeEnd);
}

export function removeTrailingGrapheme(value: string) {
  const graphemes = segmentTextIntoGraphemes(value);
  const trailingGrapheme = graphemes[graphemes.length - 1];

  return trailingGrapheme ? value.slice(0, trailingGrapheme.start) : "";
}

function normalizeSharedPunctuationSpacing(value: string) {
  return collapseWhitespace(value)
    .replace(SHARED_LEADING_PUNCTUATION_PATTERN, "$1")
    .replace(SHARED_OPENING_BRACKET_PATTERN, "$1")
    .replace(SHARED_ENDING_PUNCTUATION_PATTERN, "$1 ");
}

function normalizePersianText(value: string) {
  const withoutHiddenJoiners = value.replace(/[\u200b\u200d\u2060\ufeff]/gu, "");
  const normalizedCharacters = replaceMappedCharacters(
    replaceMappedCharacters(withoutHiddenJoiners, persianCharacterMap),
    arabicIndicToPersianDigitMap,
  );
  const normalizedQuotes = normalizedCharacters
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'");
  const normalizedZwnj = normalizedQuotes
    .replace(/[ \t]*\u200c[ \t]*/gu, ZERO_WIDTH_NON_JOINER)
    .replace(/\u200c{2,}/gu, ZERO_WIDTH_NON_JOINER)
    .replace(/\u200c([،؛؟.,!;:])/gu, "$1")
    .replace(/([(\[{«])\u200c+/gu, "$1")
    .replace(/\u200c+([)\]}»])/gu, "$1");

  return normalizeSharedPunctuationSpacing(normalizedZwnj)
    .replace(/[ \t]*\u200c[ \t]*/gu, ZERO_WIDTH_NON_JOINER)
    .replace(/\u200c{2,}/gu, ZERO_WIDTH_NON_JOINER);
}

export function normalizeInlineTextForLanguage(value: string, languageId?: string) {
  const normalizedValue = collapseWhitespace(value.normalize("NFC"))
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'");

  if (languageId === "persian") {
    return normalizePersianText(normalizedValue);
  }

  return normalizeSharedPunctuationSpacing(normalizedValue);
}

export function normalizeTokenForLanguage(value: string, languageId?: string) {
  const normalizedValue = normalizeInlineTextForLanguage(value, languageId)
    .toLowerCase()
    .replace(SHARED_TOKEN_EDGE_PATTERN, "");

  return languageId === "persian"
    ? normalizedValue.replace(PERSIAN_EDGE_ZWNJ_PATTERN, "")
    : normalizedValue;
}

export function normalizeFragmentForLanguage(value: string, languageId?: string) {
  const normalizedValue = normalizeInlineTextForLanguage(value, languageId)
    .replace(SHARED_TRAILING_FRAGMENT_PUNCTUATION_PATTERN, "")
    .trim();

  if (languageId === "persian") {
    return normalizedValue.replace(PERSIAN_EDGE_ZWNJ_PATTERN, "");
  }

  return normalizedValue;
}

export function normalizeSentenceForLanguage(value: string, languageId?: string) {
  const normalizedValue = normalizeInlineTextForLanguage(value, languageId);

  if (!normalizedValue) {
    return "";
  }

  return SHARED_SENTENCE_ENDING_PATTERN.test(normalizedValue)
    ? normalizedValue
    : `${normalizedValue}.`;
}

export function tokenizeTextForLanguage(value: string, languageId?: string) {
  return (
    normalizeInlineTextForLanguage(value, languageId)
      .match(SHARED_TOKEN_PATTERN)
      ?.map((token) => normalizeTokenForLanguage(token, languageId))
      .filter(Boolean) ?? []
  );
}

export function normalizeFragmentKeyForLanguage(value: string, languageId?: string) {
  return normalizeInlineTextForLanguage(value, languageId).toLowerCase();
}

export function buildCharacterSignatureForLanguage(value: string, languageId?: string) {
  return Array.from(
    new Set(
      Array.from(normalizeInlineTextForLanguage(value, languageId).toLowerCase()).filter(
        (character) => character.trim() !== "",
      ),
    ),
  )
    .sort((leftCharacter, rightCharacter) => leftCharacter.localeCompare(rightCharacter))
    .join("");
}
