export const excludedPaths = [
  ".git",
  ".next",
  "node_modules",
  "coverage",
  ".swc",
  ".vite",
  ".vercel",
  ".wrangler",
  "playwright-report",
  "test-results",
  ".turbo",
  ".cache",
  "dist",
  "tmp",
  "temp",
  "output",
  "*.tgz",
  "*.zip",
  "*.tar.gz",
  "*.log",
  ".DS_Store",
  "__MACOSX",
  "Thumbs.db",
  ".eslintcache",
  "tsconfig.tsbuildinfo",
];

export const bannedEntryPatterns = [
  /(^|\/)\.git(\/|$)/u,
  /(^|\/)\.next(\/|$)/u,
  /(^|\/)node_modules(\/|$)/u,
  /(^|\/)test-results(\/|$)/u,
  /(^|\/)__MACOSX(\/|$)/u,
  /(^|\/)(?:\.cache|\.turbo|\.swc|\.vite|\.vercel|\.wrangler)(\/|$)/u,
  /(^|\/)(?:tmp|temp)(\/|$)/u,
  /(^|\/)(?:coverage|playwright-report|output)(\/|$)/u,
  /(^|\/)tsconfig\.tsbuildinfo$/u,
  /(^|\/)[^/]+\.log$/u,
];

export function normalizeArchiveEntry(entry) {
  return entry.trim().replace(/^\.\//u, "");
}

export function isBannedHandoffArchiveEntry(entry) {
  const normalizedEntry = normalizeArchiveEntry(entry);
  return bannedEntryPatterns.some((pattern) => pattern.test(normalizedEntry));
}
