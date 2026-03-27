import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const LOOPBACK_HOSTNAME_PATTERN = /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|\[::1\]|::1)$/u;

export function hasFlag(flagNames, values) {
  return values.some((value, index) => {
    const normalizedValue = value.split("=")[0];

    return (
      flagNames.includes(normalizedValue) ||
      (index > 0 && flagNames.includes(values[index - 1]))
    );
  });
}

export function readFlagValue(flagNames, values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const normalizedValue = value.split("=")[0];

    if (!flagNames.includes(normalizedValue)) {
      continue;
    }

    const inlineValue = value.includes("=") ? value.split("=").slice(1).join("=") : undefined;

    if (inlineValue) {
      return inlineValue;
    }

    return values[index + 1];
  }

  return undefined;
}

export function resolveRequestedHostname(env = process.env) {
  const explicitHost = env.HOST?.trim();

  if (explicitHost) {
    return explicitHost;
  }

  const loopbackHostname = env.HOSTNAME?.trim();

  if (loopbackHostname && LOOPBACK_HOSTNAME_PATTERN.test(loopbackHostname)) {
    return loopbackHostname;
  }

  return "0.0.0.0";
}

function createRuntimeError(lines) {
  return new Error(lines.join("\n"));
}

export function createStartLaunchPlan({
  cwd = process.cwd(),
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  const nextBinaryPath = path.resolve(cwd, "node_modules/next/dist/bin/next");
  const productionBuildIdPath = path.resolve(cwd, ".next/BUILD_ID");
  const developmentManifestPath = path.resolve(cwd, ".next/routes-manifest.json");
  const productionArtifactPaths = [
    path.resolve(cwd, ".next/build-manifest.json"),
    path.resolve(cwd, ".next/prerender-manifest.json"),
    path.resolve(cwd, ".next/routes-manifest.json"),
  ];
  const contentManifestPath = path.resolve(cwd, "public/content-packs/manifest.json");

  if (!existsSync(nextBinaryPath)) {
    throw createRuntimeError([
      "NullKeys cannot start because dependencies are missing.",
      "Run `npm install`, then retry `npm run start`.",
    ]);
  }

  if (!existsSync(productionBuildIdPath)) {
    const messageLines = [
      "NullKeys does not have a production build ready for `next start`.",
    ];

    if (existsSync(developmentManifestPath)) {
      messageLines.push(
        "A development server or test run has likely replaced the production bundle inside `.next`.",
      );
    }

    messageLines.push("Run `npm run build` first, then retry `npm run start`.");
    throw createRuntimeError(messageLines);
  }

  const missingArtifacts = productionArtifactPaths.filter((artifactPath) => !existsSync(artifactPath));

  if (missingArtifacts.length > 0) {
    throw createRuntimeError([
      "NullKeys found a partial production build inside `.next`.",
      `Missing: ${missingArtifacts.join(", ")}`,
      "Run `npm run build` again, then retry `npm run start`.",
    ]);
  }

  if (!existsSync(contentManifestPath)) {
    throw createRuntimeError([
      "NullKeys cannot start because browser-served content packs are missing.",
      `Expected: ${contentManifestPath}`,
      "Run `npm run content:packs` or `npm run build`, then retry `npm run start`.",
    ]);
  }

  const resolvedPort = readFlagValue(["--port", "-p"], argv) ?? env.PORT ?? "3000";
  const resolvedHostname = readFlagValue(["--hostname", "-H"], argv) ?? resolveRequestedHostname(env);
  const nextArguments = ["start", ...argv];

  if (!hasFlag(["--port", "-p"], argv)) {
    nextArguments.push("--port", resolvedPort);
  }

  if (!hasFlag(["--hostname", "-H"], argv)) {
    nextArguments.push("--hostname", resolvedHostname);
  }

  return {
    nextBinaryPath,
    nextArguments,
    resolvedPort,
    resolvedHostname,
    browserHostname: resolvedHostname === "0.0.0.0" ? "localhost" : resolvedHostname,
  };
}

function runStartLaunchPlan(plan, env = process.env) {
  console.log("");
  console.log("NullKeys production preview");
  console.log(`Local URL: http://${plan.browserHostname}:${plan.resolvedPort}`);
  console.log("Stop the server with Ctrl+C.");
  console.log("");

  const childProcess = spawn(process.execPath, [plan.nextBinaryPath, ...plan.nextArguments], {
    stdio: "inherit",
    env,
  });

  function forwardSignal(signal) {
    if (!childProcess.killed) {
      childProcess.kill(signal);
    }
  }

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  childProcess.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

export function main() {
  try {
    runStartLaunchPlan(createStartLaunchPlan());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const isMainModule =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main();
}
