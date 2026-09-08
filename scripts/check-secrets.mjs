import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  /\bghp_[A-Za-z0-9_]{36,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{80,}\b/u,
  /\bsk_live_[A-Za-z0-9]{24,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /\b(?:api|access|auth|client|private|secret)[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]/iu,
];

const result = spawnSync("git", ["ls-files"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const failures = [];

for (const filePath of result.stdout.split(/\r?\n/u).filter(Boolean)) {
  let contents = "";

  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    continue;
  }

  for (const [index, line] of contents.split(/\r?\n/u).entries()) {
    if (secretPatterns.some((pattern) => pattern.test(line))) {
      failures.push(`${filePath}:${index + 1}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`Secret scan failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exit(1);
}
