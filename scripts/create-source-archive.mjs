import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  sourceArchivePrefix,
  verifySourceArchiveEntries,
} from "./source-archive-config.mjs";

const repositoryRoot = process.cwd();

function runGit(argumentsList) {
  const result = spawnSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${argumentsList.join(" ")} failed.`);
  }
  return result.stdout.trim();
}

function collectExtractedFiles(rootPath, relativePath = "") {
  const absolutePath = path.join(rootPath, relativePath);
  if (!existsSync(absolutePath)) return [];
  if (!statSync(absolutePath).isDirectory()) return [relativePath];
  return readdirSync(absolutePath).flatMap((entry) =>
    collectExtractedFiles(rootPath, path.join(relativePath, entry)),
  );
}

const worktreeStatus = runGit(["status", "--porcelain=v1"]);
if (worktreeStatus) {
  throw new Error("Source archives require a clean working tree so the archive matches its commit.");
}

const commitSha = runGit(["rev-parse", "HEAD"]);
const trackedFiles = runGit(["ls-tree", "-r", "--name-only", commitSha]).split("\n").filter(Boolean);
const prefix = sourceArchivePrefix(commitSha);
const outputDirectory = path.join(repositoryRoot, "output", "source-releases");
const archiveFilename = `nullkeys-source-${commitSha.slice(0, 12)}.tar.gz`;
const archivePath = path.join(outputDirectory, archiveFilename);
mkdirSync(outputDirectory, { recursive: true });

const archiveResult = spawnSync(
  "git",
  ["archive", "--format=tar.gz", `--prefix=${prefix}`, `--output=${archivePath}`, commitSha],
  { cwd: repositoryRoot, encoding: "utf8" },
);
if (archiveResult.status !== 0) {
  throw new Error(archiveResult.stderr.trim() || "git archive failed.");
}

const listingResult = spawnSync("tar", ["-tzf", archivePath], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
if (listingResult.status !== 0) {
  throw new Error(listingResult.stderr.trim() || "The source archive could not be listed.");
}
const verification = verifySourceArchiveEntries({
  entries: listingResult.stdout.split("\n"),
  prefix,
  trackedFiles,
});

const extractionRoot = mkdtempSync(path.join(tmpdir(), "nullkeys-source-verify-"));
try {
  const extractionResult = spawnSync("tar", ["-xzf", archivePath, "-C", extractionRoot], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (extractionResult.status !== 0) {
    throw new Error(extractionResult.stderr.trim() || "The source archive could not be extracted.");
  }
  const extractedFiles = collectExtractedFiles(extractionRoot, prefix.replace(/\/$/u, ""))
    .map((entry) => entry.slice(prefix.length))
    .filter(Boolean)
    .sort();
  if (JSON.stringify(extractedFiles) !== JSON.stringify([...trackedFiles].sort())) {
    throw new Error("Independent extraction did not reproduce the tracked file list.");
  }
} finally {
  rmSync(extractionRoot, { recursive: true, force: true });
}

const digest = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
const checksumPath = `${archivePath}.sha256`;
writeFileSync(checksumPath, `${digest}  ${archiveFilename}\n`);
process.stdout.write(
  `Created ${path.relative(repositoryRoot, archivePath)} from ${commitSha}.\n` +
    `Verified ${verification.archivedFileCount} tracked files by listing and extraction.\n` +
    `SHA-256 ${digest}\n`,
);
