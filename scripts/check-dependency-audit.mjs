import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const auditCachePath = path.join(tmpdir(), "nullkeys-npm-audit-cache");
const packageLock = JSON.parse(readFileSync(path.resolve(process.cwd(), "package-lock.json"), "utf8"));

const allowedAuditFindings = new Map([
  [
    "postcss",
    {
      severity: "high",
      range: "<=8.5.22",
      isDirect: false,
      scope: "production",
      reviewedOn: "2026-08-28",
      reviewBy: "2026-09-28",
      via: ["source:1117015", "source:1124252", "source:1130709", "source:1139510"],
      effects: ["package:next"],
      fixAvailable: "next:semver-major",
      nodes: [
        ["node_modules/next/node_modules/postcss", "8.4.31"],
      ],
      reason:
        "Next.js 15 pins PostCSS 8.4.31 internally. NullKeys builds only repository-owned CSS and does not process user-supplied CSS or source maps at runtime; upgrading to Next 16 requires a separate framework and Cloudflare adapter migration.",
    },
  ],
  [
    "next",
    {
      severity: "moderate",
      range: "9.3.4-canary.0 - 16.3.0-preview.10",
      isDirect: true,
      scope: "production",
      reviewedOn: "2026-08-28",
      reviewBy: "2026-09-28",
      via: ["package:postcss"],
      effects: [],
      fixAvailable: "next:semver-major",
      nodes: [
        ["node_modules/next", "15.5.24"],
      ],
      reason:
        "The advisory is inherited from Next.js 15's internal PostCSS dependency and has the same repository-owned CSS boundary tracked above.",
    },
  ],
]);

function runAudit() {
  try {
    const output = execFileSync(
      npmCommand,
      ["audit", "--cache", auditCachePath, "--json", "--audit-level=high"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    return JSON.parse(output);
  } catch (error) {
    if (typeof error.stdout !== "string" || error.stdout.length === 0) {
      throw error;
    }

    return JSON.parse(error.stdout);
  }
}

function sortedValues(values) {
  return values.slice().sort((leftValue, rightValue) => leftValue.localeCompare(rightValue));
}

function formatFixAvailable(fixAvailable) {
  if (fixAvailable === true) {
    return "available";
  }

  if (!fixAvailable || typeof fixAvailable !== "object") {
    return "none";
  }

  return `${fixAvailable.name}${
    fixAvailable.isSemVerMajor ? ":semver-major" : ""
  }`;
}

function formatViaEntry(entry) {
  if (typeof entry === "string") {
    return `package:${entry}`;
  }

  return `source:${entry.source}`;
}

function formatEffectEntry(entry) {
  return `package:${entry}`;
}

function assertExactValues(errors, label, actualValues, expectedValues) {
  const actual = sortedValues(actualValues);
  const expected = sortedValues(expectedValues);

  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    errors.push(`${label} changed: expected [${expected.join(", ")}], got [${actual.join(", ")}]`);
  }
}

function assertExactValueVariant(errors, label, actualValues, expectedValueVariants) {
  const actual = sortedValues(actualValues);
  const expectedVariants = expectedValueVariants.map(sortedValues);
  const matched = expectedVariants.some(
    (expected) =>
      actual.length === expected.length &&
      actual.every((value, index) => value === expected[index]),
  );

  if (!matched) {
    const formattedExpected = expectedVariants
      .map((expected) => `[${expected.join(", ")}]`)
      .join(" or ");
    errors.push(`${label} changed: expected ${formattedExpected}, got [${actual.join(", ")}]`);
  }
}

function assertReviewDate(errors, findingName, exception) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(exception.reviewedOn) || !/^\d{4}-\d{2}-\d{2}$/u.test(exception.reviewBy)) {
    errors.push(`${findingName} has an invalid review date`);
    return;
  }

  const [year, month, day] = exception.reviewBy.split("-").map(Number);
  const reviewDeadline = Date.UTC(year, month - 1, day, 23, 59, 59, 999);

  if (Date.now() > reviewDeadline) {
    errors.push(`${findingName} exception expired on ${exception.reviewBy}`);
  }
}

function assertNodeScopes(errors, findingName, exception) {
  for (const [nodePath, expectedVersion] of exception.nodes) {
    const packageEntry = packageLock.packages?.[nodePath];

    if (!packageEntry) {
      errors.push(`${findingName} node ${nodePath} is missing from package-lock.json`);
      continue;
    }

    if (packageEntry.version !== expectedVersion) {
      errors.push(
        `${findingName} node ${nodePath} version changed: expected ${expectedVersion}, got ${packageEntry.version}`,
      );
    }

    if (exception.scope === "development" && packageEntry.dev !== true) {
      errors.push(`${findingName} node ${nodePath} is no longer development-only`);
    }

    if (exception.scope === "production" && packageEntry.dev === true) {
      errors.push(`${findingName} node ${nodePath} moved into development scope unexpectedly`);
    }
  }
}

function validateAllowedFinding(name, finding) {
  const exception = allowedAuditFindings.get(name);
  const errors = [];

  if (!exception) {
    return [`${name} is not documented in the dependency-audit policy`];
  }

  assertReviewDate(errors, name, exception);
  assertNodeScopes(errors, name, exception);

  if (finding.severity !== exception.severity) {
    errors.push(`${name} severity changed: expected ${exception.severity}, got ${finding.severity}`);
  }

  if (finding.range !== exception.range) {
    errors.push(`${name} advisory range changed: expected ${exception.range}, got ${finding.range}`);
  }

  if (finding.isDirect !== exception.isDirect) {
    errors.push(`${name} direct-dependency flag changed`);
  }

  const allowedFixAvailable = exception.fixAvailableVariants ?? [exception.fixAvailable];

  if (!allowedFixAvailable.includes(formatFixAvailable(finding.fixAvailable))) {
    errors.push(
      `${name} remediation changed: expected ${allowedFixAvailable.join(" or ")}, got ${formatFixAvailable(finding.fixAvailable)}`,
    );
  }

  assertExactValues(
    errors,
    `${name} advisory identity`,
    (finding.via ?? []).map(formatViaEntry),
    exception.via,
  );
  assertExactValueVariant(
    errors,
    `${name} effects`,
    (finding.effects ?? []).map(formatEffectEntry),
    exception.effectVariants ?? [exception.effects],
  );
  assertExactValues(
    errors,
    `${name} affected nodes`,
    finding.nodes ?? [],
    exception.nodes.map(([nodePath]) => nodePath),
  );

  return errors;
}

const audit = runAudit();

if (audit.error || !audit.metadata?.vulnerabilities || typeof audit.vulnerabilities !== "object") {
  console.error("Dependency audit did not return a complete vulnerability report.");
  if (audit.message) {
    console.error(`- ${audit.message}`);
  }
  process.exit(1);
}

const vulnerabilities = audit.vulnerabilities ?? {};
const criticalCount = audit.metadata?.vulnerabilities?.critical ?? 0;
const failures = [];

if (criticalCount > 0) {
  failures.push(`Audit reported ${criticalCount} critical advisories`);
}

for (const [name, finding] of Object.entries(vulnerabilities)) {
  failures.push(...validateAllowedFinding(name, finding));
}

for (const exceptionName of allowedAuditFindings.keys()) {
  if (!Object.hasOwn(vulnerabilities, exceptionName)) {
    failures.push(`${exceptionName} exception is no longer reported and must be removed`);
  }
}

if (failures.length > 0) {
  console.error("Dependency audit found unapproved advisories or stale exceptions:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const allowedFindings = Object.entries(vulnerabilities);

console.log(`Dependency audit passed with ${allowedFindings.length} documented exception(s).`);
for (const [name, finding] of allowedFindings) {
  const exception = allowedAuditFindings.get(name);
  console.log(
    `- ${name}: ${finding.severity}; ${exception.scope}; review by ${exception.reviewBy}; ${exception.reason}`,
  );
}
