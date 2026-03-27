export declare const excludedPaths: readonly string[];
export declare const bannedEntryPatterns: readonly RegExp[];

export declare function normalizeArchiveEntry(entry: string): string;
export declare function isBannedHandoffArchiveEntry(entry: string): boolean;
