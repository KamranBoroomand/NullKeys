import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const contentPackRoot = path.resolve(process.cwd(), "public", "content-packs");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function snapshotFiles(rootPath, directoryPath = rootPath, snapshot = new Map()) {
  for (const entryName of readdirSync(directoryPath).sort()) {
    const entryPath = path.join(directoryPath, entryName);

    if (statSync(entryPath).isDirectory()) {
      snapshotFiles(rootPath, entryPath, snapshot);
      continue;
    }

    snapshot.set(path.relative(rootPath, entryPath), readFileSync(entryPath));
  }

  return snapshot;
}

function findSnapshotChanges(before, after) {
  const paths = Array.from(new Set([...before.keys(), ...after.keys()])).sort();

  return paths.flatMap((relativePath) => {
    const beforeContent = before.get(relativePath);
    const afterContent = after.get(relativePath);

    if (!beforeContent) return [`added ${relativePath}`];
    if (!afterContent) return [`removed ${relativePath}`];
    if (!beforeContent.equals(afterContent)) return [`changed ${relativePath}`];
    return [];
  });
}

const beforeSnapshot = snapshotFiles(contentPackRoot);
run("npm", ["run", "content:packs"]);
const afterSnapshot = snapshotFiles(contentPackRoot);
const changes = findSnapshotChanges(beforeSnapshot, afterSnapshot);

if (changes.length > 0) {
  console.error("Generated content packs changed when rebuilt:");
  for (const change of changes) console.error(`- ${change}`);
  process.exit(1);
}

console.log(`Generated content packs are stable across ${afterSnapshot.size} files.`);
