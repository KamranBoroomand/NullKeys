import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

function createTemporaryRepo() {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "nullkeys-release-"));
  temporaryDirectories.push(temporaryDirectory);
  return temporaryDirectory;
}

function writeRepoFile(rootPath: string, relativePath: string, contents = "") {
  const absolutePath = path.join(rootPath, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

async function importScriptModule<T>(relativePath: string): Promise<T> {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const cacheBust = `?t=${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return (await import(`${pathToFileURL(absolutePath).href}${cacheBust}`)) as T;
}

function runScript(relativePath: string, cwd: string) {
  return spawnSync(process.execPath, [path.resolve(process.cwd(), relativePath)], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
    },
  });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const temporaryDirectory = temporaryDirectories.pop();

    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }
});

describe("release guardrails", () => {
  it("ignores ambient machine HOSTNAME values unless they are explicit loopback hosts", async () => {
    const runDevModule = await importScriptModule<{
      resolveRequestedHostname: (env?: NodeJS.ProcessEnv) => string;
    }>("scripts/run-dev.mjs");
    const runStartModule = await importScriptModule<{
      resolveRequestedHostname: (env?: NodeJS.ProcessEnv) => string;
    }>("scripts/run-start.mjs");

    expect(
      runDevModule.resolveRequestedHostname({
        HOSTNAME: "Kamran-MacBook-Pro",
        NODE_ENV: "test",
      } as NodeJS.ProcessEnv),
    ).toBe("0.0.0.0");
    expect(
      runStartModule.resolveRequestedHostname({
        HOSTNAME: "Kamran-MacBook-Pro",
        NODE_ENV: "test",
      } as NodeJS.ProcessEnv),
    ).toBe(
      "0.0.0.0",
    );
    expect(
      runDevModule.resolveRequestedHostname({
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "test",
      } as NodeJS.ProcessEnv),
    ).toBe("127.0.0.1");
    expect(
      runStartModule.resolveRequestedHostname({
        HOST: "preview.nullkeys.test",
        NODE_ENV: "test",
      } as NodeJS.ProcessEnv),
    ).toBe(
      "preview.nullkeys.test",
    );
  });

  it("fails development startup with a clear message when content packs are missing", () => {
    const temporaryRepo = createTemporaryRepo();

    writeRepoFile(temporaryRepo, "node_modules/next/dist/bin/next");
    writeRepoFile(temporaryRepo, "scripts/build-metadata.mjs", "export function loadBuildMetadata() {}");

    const result = runScript("scripts/run-dev.mjs", temporaryRepo);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("content packs have not been generated");
    expect(result.stderr).toContain("npm run content:packs");
  });

  it("fails production startup clearly when .next only contains development artifacts", () => {
    const temporaryRepo = createTemporaryRepo();

    writeRepoFile(temporaryRepo, "node_modules/next/dist/bin/next");
    writeRepoFile(temporaryRepo, ".next/routes-manifest.json", "{}");

    const result = runScript("scripts/run-start.mjs", temporaryRepo);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("does not have a production build ready");
    expect(result.stderr).toContain("development server or test run has likely replaced the production bundle");
    expect(result.stderr).toContain("npm run build");
  });

  it("fails production startup clearly when built assets exist but content packs are missing", () => {
    const temporaryRepo = createTemporaryRepo();

    writeRepoFile(temporaryRepo, "node_modules/next/dist/bin/next");
    writeRepoFile(temporaryRepo, ".next/BUILD_ID", "release-build");
    writeRepoFile(temporaryRepo, ".next/build-manifest.json", "{}");
    writeRepoFile(temporaryRepo, ".next/prerender-manifest.json", "{}");
    writeRepoFile(temporaryRepo, ".next/routes-manifest.json", "{}");

    const result = runScript("scripts/run-start.mjs", temporaryRepo);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("browser-served content packs are missing");
    expect(result.stderr).toContain("npm run content:packs");
  });

  it("fails content-pack generation with a clear missing-source message", () => {
    const temporaryRepo = createTemporaryRepo();
    writeRepoFile(temporaryRepo, "package.json", JSON.stringify({ name: "nullkeys", version: "0.1.0" }));

    const result = runScript("scripts/build-content-packs.mjs", temporaryRepo);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("generated seed content source is missing");
    expect(result.stderr).toContain("content:seed");
  });

  it("reports unavailable content-pack metadata until a manifest exists and errors clearly on invalid manifests", async () => {
    const buildMetadataModule = await importScriptModule<{
      loadBuildMetadata: (rootPath?: string) => {
        packageVersion: string;
        contentPackVersion: string;
        buildString: string;
      };
    }>("scripts/build-metadata.mjs");
    const temporaryRepo = createTemporaryRepo();

    writeRepoFile(temporaryRepo, "package.json", JSON.stringify({ name: "nullkeys", version: "0.1.0" }));

    const metadataWithoutManifest = buildMetadataModule.loadBuildMetadata(temporaryRepo);
    expect(metadataWithoutManifest.packageVersion).toBe("0.1.0");
    expect(metadataWithoutManifest.contentPackVersion).toBe("content-packs-unavailable");
    expect(metadataWithoutManifest.buildString).toContain("content-packs-unavailable");

    writeRepoFile(temporaryRepo, "public/content-packs/manifest.json", "{ invalid json");

    expect(() => buildMetadataModule.loadBuildMetadata(temporaryRepo)).toThrow(
      /could not parse content-pack manifest/i,
    );
  });
});
