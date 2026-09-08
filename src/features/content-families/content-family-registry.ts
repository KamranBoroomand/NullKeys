import type {
  PreferredContentFamilyId,
  PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import type { SessionFlavor } from "@/lib/scoring/session-models";

export type ContentPurityProfile =
  | "natural-language"
  | "numbers"
  | "symbols"
  | "code"
  | "shell";

export interface ContentFamilyDefinition {
  id: PreferredContentFamilyId;
  label: string;
  shortLabel: string;
  description: string;
  sessionFlavor: SessionFlavor;
  contentSourceBias: PracticePreferences["contentSourceBias"];
  benchmarkFocus: "sprint" | "balanced" | "endurance";
  purityProfile: ContentPurityProfile;
  programmerPresetId?: string;
  visible?: boolean;
}

export const contentFamilies: ContentFamilyDefinition[] = [
  {
    id: "adaptive-blend",
    label: "Adaptive blend",
    shortLabel: "Adaptive",
    description: "Teacher-like lessons that blend common words, phrase drills, and longer passages without code or shell noise.",
    sessionFlavor: "mixed",
    contentSourceBias: "mixed",
    benchmarkFocus: "balanced",
    purityProfile: "natural-language",
  },
  {
    id: "common-words",
    label: "Common words",
    shortLabel: "Words",
    description: "Natural dictionary-backed words with light punctuation and higher readability.",
    sessionFlavor: "plain",
    contentSourceBias: "real",
    benchmarkFocus: "balanced",
    purityProfile: "natural-language",
  },
  {
    id: "pseudo-words",
    label: "Pseudo-words",
    shortLabel: "Pseudo",
    description: "Pronounceable synthetic words that scale beyond a fixed lexicon and expose more letter combinations.",
    sessionFlavor: "plain",
    contentSourceBias: "synthetic",
    benchmarkFocus: "balanced",
    purityProfile: "natural-language",
  },
  {
    id: "phrase-drills",
    label: "Phrase drills",
    shortLabel: "Phrases",
    description: "Sentence-like passages with punctuation and clause rhythm for steadier flow practice.",
    sessionFlavor: "mixed",
    contentSourceBias: "mixed",
    benchmarkFocus: "endurance",
    purityProfile: "natural-language",
  },
  {
    id: "quote-drills",
    label: "Book passages",
    shortLabel: "Books",
    description: "Longer sentence-shaped prompts that feel closer to book or article benchmarking.",
    sessionFlavor: "plain",
    contentSourceBias: "real",
    benchmarkFocus: "endurance",
    purityProfile: "natural-language",
    visible: false,
  },
  {
    id: "symbol-drills",
    label: "Symbol drills",
    shortLabel: "Symbols",
    description: "Punctuation clusters, brackets, and operator-heavy passages for higher symbol density.",
    sessionFlavor: "symbols",
    contentSourceBias: "synthetic",
    benchmarkFocus: "sprint",
    purityProfile: "symbols",
  },
  {
    id: "number-drills",
    label: "Number drills",
    shortLabel: "Numbers",
    description: "Number-row and numpad-style sequences with dates, times, ratios, percentages, versions, and numeric IDs.",
    sessionFlavor: "numbers",
    contentSourceBias: "synthetic",
    benchmarkFocus: "sprint",
    purityProfile: "numbers",
  },
  {
    id: "code-drills",
    label: "Code drills",
    shortLabel: "Code",
    description: "Language-agnostic programming tokens, punctuation pairings, and code-shaped passages.",
    sessionFlavor: "code",
    contentSourceBias: "mixed",
    benchmarkFocus: "balanced",
    purityProfile: "code",
    programmerPresetId: "typescript-symbols",
  },
  {
    id: "shell-drills",
    label: "Shell drills",
    shortLabel: "Shell",
    description: "Terminal commands, flags, paths, quotes, redirects, and slash-heavy command-line patterns.",
    sessionFlavor: "code",
    contentSourceBias: "mixed",
    benchmarkFocus: "balanced",
    purityProfile: "shell",
    programmerPresetId: "shell-commands",
  },
];

export const visibleContentFamilies = contentFamilies.filter(
  (contentFamily) => contentFamily.visible !== false,
);

export const hiddenContentFamilyFallbackId: PreferredContentFamilyId = "phrase-drills";

export function getContentFamily(contentFamilyId?: string) {
  if (!contentFamilyId) {
    return contentFamilies[0];
  }

  return contentFamilies.find((contentFamily) => contentFamily.id === contentFamilyId) ?? contentFamilies[0];
}

export function normalizeVisibleContentFamilyId(contentFamilyId?: string): PreferredContentFamilyId {
  if (contentFamilyId === "quote-drills") {
    return hiddenContentFamilyFallbackId;
  }

  return (
    visibleContentFamilies.find((contentFamily) => contentFamily.id === contentFamilyId)?.id ??
    visibleContentFamilies[0]?.id ??
    contentFamilies[0]?.id ??
    "adaptive-blend"
  );
}

export function getVisibleContentFamilies() {
  return visibleContentFamilies;
}

export function getAdaptiveContentFamilies() {
  return visibleContentFamilies;
}

export function getBenchmarkContentFamilies() {
  return visibleContentFamilies.filter((contentFamily) => contentFamily.id !== "adaptive-blend");
}
