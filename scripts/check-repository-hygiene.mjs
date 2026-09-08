import { spawnSync } from "node:child_process";

const forbiddenTrackedPaths = [
  ".DS_Store",
  "node_modules/",
  ".next/",
  ".open-next/",
  "output/",
  "coverage/",
  "playwright-report/",
  "test-results/",
  ".dev.vars",
];

const result = spawnSync("git", ["ls-files"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const trackedPaths = result.stdout.split(/\r?\n/u).filter(Boolean);
const failures = trackedPaths.filter((trackedPath) =>
  forbiddenTrackedPaths.some((forbiddenPath) =>
    forbiddenPath.endsWith("/")
      ? trackedPath.startsWith(forbiddenPath)
      : trackedPath === forbiddenPath,
  ),
);

if (failures.length > 0) {
  process.stderr.write(`Repository hygiene failed:\n${failures.map((path) => `- ${path}`).join("\n")}\n`);
  process.exit(1);
}
