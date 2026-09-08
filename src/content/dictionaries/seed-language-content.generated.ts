export interface SeedLanguageContent {
  sourceLanguageId: string;
  sourceLabels: readonly string[];
  sourceWordCount: number;
  importedWordCount: number;
  rankedWords: readonly string[];
  phraseFragments: readonly string[];
  benchmarkSentences: readonly string[];
}

export const seedLanguageContent = {} as const satisfies Record<string, SeedLanguageContent>;

export const seedContentAudit = {} as const;
