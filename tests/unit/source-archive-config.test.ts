import path from "node:path";
import { pathToFileURL } from "node:url";

const sourceArchiveConfig = (await import(
  pathToFileURL(path.resolve(process.cwd(), "scripts/source-archive-config.mjs")).href
)) as {
  sourceArchivePrefix: (commitSha: string) => string;
  verifySourceArchiveEntries: (options: {
    entries: string[];
    prefix: string;
    trackedFiles: string[];
  }) => { archivedFileCount: number };
};

describe("source archive configuration", () => {
  const commitSha = "0123456789abcdef0123456789abcdef01234567";
  const prefix = "nullkeys-source-0123456789ab/";
  const trackedFiles = ["README.md", "package.json", "src/app/page.tsx"];

  it("uses a stable commit-derived prefix and accepts the exact tracked file set", () => {
    expect(sourceArchiveConfig.sourceArchivePrefix(commitSha)).toBe(prefix);
    expect(
      sourceArchiveConfig.verifySourceArchiveEntries({
        entries: [prefix, ...trackedFiles.map((file) => `${prefix}${file}`)],
        prefix,
        trackedFiles,
      }),
    ).toEqual({ archivedFileCount: trackedFiles.length });
  });

  it("rejects untracked additions, omissions, and entries outside the prefix", () => {
    expect(() =>
      sourceArchiveConfig.verifySourceArchiveEntries({
        entries: [...trackedFiles.map((file) => `${prefix}${file}`), `${prefix}.env.local`],
        prefix,
        trackedFiles,
      }),
    ).toThrow(/expected 3 tracked files/i);
    expect(() =>
      sourceArchiveConfig.verifySourceArchiveEntries({
        entries: trackedFiles.slice(1).map((file) => `${prefix}${file}`),
        prefix,
        trackedFiles,
      }),
    ).toThrow(/expected 3 tracked files/i);
    expect(() =>
      sourceArchiveConfig.verifySourceArchiveEntries({
        entries: ["../README.md", ...trackedFiles.slice(1).map((file) => `${prefix}${file}`)],
        prefix,
        trackedFiles,
      }),
    ).toThrow(/outside the stable prefix/i);
  });
});
