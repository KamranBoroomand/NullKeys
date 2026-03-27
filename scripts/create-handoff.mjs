import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  excludedPaths,
  isBannedHandoffArchiveEntry,
} from "./handoff-package-config.mjs";

const outputDirectoryPath = path.resolve(process.cwd(), "output");
const timestamp = new Date().toISOString().slice(0, 10);
const archivePath = path.join(outputDirectoryPath, `nullkeys-handoff-${timestamp}.tar.gz`);

mkdirSync(outputDirectoryPath, { recursive: true });

const tarResult = spawnSync(
  "tar",
  [
    ...excludedPaths.flatMap((excludedPath) => ["--exclude", excludedPath]),
    "-czf",
    archivePath,
    ".",
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
  },
);

if (tarResult.status !== 0) {
  process.exit(tarResult.status ?? 1);
}

const listingResult = spawnSync("tar", ["-tzf", archivePath], {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (listingResult.status !== 0) {
  process.exit(listingResult.status ?? 1);
}

const archivedEntries = listingResult.stdout
  .split("\n")
  .map((entry) => entry.trim().replace(/^\.\//u, ""))
  .filter(Boolean);
const bannedEntries = archivedEntries.filter((entry) => isBannedHandoffArchiveEntry(entry));

if (bannedEntries.length > 0) {
  console.error("Archive verification failed. Banned entries were found:");
  for (const entry of bannedEntries.slice(0, 24)) {
    console.error(`- ${entry}`);
  }

  process.exit(1);
}

console.log(`Clean handoff archive created at ${archivePath}`);
console.log(
  `Excluded: ${excludedPaths.join(", ")}`,
);
console.log(`Verified clean archive contents (${archivedEntries.length} entries)`);
