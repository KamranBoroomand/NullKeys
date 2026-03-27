import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const buildInputs = [
  "package.json",
  "next.config.ts",
  "tailwind.config.ts",
  "postcss.config.js",
  "src",
  "public/service-worker.js",
  "public/content-packs/manifest.json",
  "src/app/icon.svg",
];

function collectFiles(rootPath, relativePath, collectedFiles) {
  const absolutePath = path.join(rootPath, relativePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  const stats = statSync(absolutePath);

  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolutePath).sort()) {
      if (entry === ".DS_Store") {
        continue;
      }

      collectFiles(rootPath, path.join(relativePath, entry), collectedFiles);
    }

    return;
  }

  collectedFiles.push(relativePath);
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`NullKeys could not parse ${label} at ${filePath}: ${detail}`);
  }
}

export function loadBuildMetadata(rootPath = process.cwd()) {
  const packageJsonPath = path.join(rootPath, "package.json");
  const contentManifestPath = path.join(rootPath, "public/content-packs/manifest.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`NullKeys could not find package metadata at ${packageJsonPath}.`);
  }

  const packageJson = readJsonFile(packageJsonPath, "package metadata");
  const contentManifest = existsSync(contentManifestPath)
    ? readJsonFile(contentManifestPath, "content-pack manifest")
    : null;
  const sourceFiles = [];

  if (typeof packageJson.version !== "string" || packageJson.version.trim().length === 0) {
    throw new Error(`NullKeys package metadata at ${packageJsonPath} does not expose a valid version.`);
  }

  if (
    contentManifest &&
    (typeof contentManifest.version !== "string" || contentManifest.version.trim().length === 0)
  ) {
    throw new Error(
      `NullKeys content-pack manifest at ${contentManifestPath} does not expose a valid version.`,
    );
  }

  for (const buildInput of buildInputs) {
    collectFiles(rootPath, buildInput, sourceFiles);
  }

  const contentHash = createHash("sha1");

  for (const sourceFile of sourceFiles.sort()) {
    contentHash.update(sourceFile);
    contentHash.update("\0");
    contentHash.update(readFileSync(path.join(rootPath, sourceFile)));
    contentHash.update("\0");
  }

  const buildId = contentHash.digest("hex").slice(0, 10);
  const version = `${packageJson.version}+${buildId}`;
  const contentPackVersion = contentManifest?.version ?? "content-packs-unavailable";
  const tagline = "Local practice, honest rhythm.";
  const description =
    "Local-first typing practice for adaptive drills, multilingual layouts, honest benchmarks, and local-only progress.";

  return {
    name: "NullKeys",
    tagline,
    description,
    packageVersion: packageJson.version,
    buildId,
    version,
    contentPackVersion,
    buildString: `NullKeys ${version} · packs ${contentPackVersion}`,
  };
}
