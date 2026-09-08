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

export function createDevLaunchPlan({
  cwd = process.cwd(),
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  const nextBinaryPath = path.resolve(cwd, "node_modules/next/dist/bin/next");
  const buildMetadataScriptPath = path.resolve(cwd, "scripts/build-metadata.mjs");
  const contentManifestPath = path.resolve(cwd, "public/content-packs/manifest.json");

  if (!existsSync(nextBinaryPath)) {
    throw createRuntimeError([
      "NullKeys cannot start because Next.js is not installed locally.",
      "Run `npm install` in this repository, then retry `npm run dev`.",
    ]);
  }

  if (!existsSync(buildMetadataScriptPath)) {
    throw createRuntimeError([
      "NullKeys cannot start because build metadata helpers are missing.",
      `Expected: ${buildMetadataScriptPath}`,
      "Restore the repository scripts, then retry `npm run dev`.",
    ]);
  }

  if (!existsSync(contentManifestPath)) {
    throw createRuntimeError([
      "NullKeys cannot start because content packs have not been generated.",
      `Expected: ${contentManifestPath}`,
      "Run `npm run content:packs`, then retry `npm run dev`.",
    ]);
  }

  const resolvedPort = readFlagValue(["--port", "-p"], argv) ?? env.PORT ?? "3000";
  const resolvedHostname = readFlagValue(["--hostname", "-H"], argv) ?? resolveRequestedHostname(env);
  const nextArguments = ["dev", ...argv];

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

function runDevLaunchPlan(plan, env = process.env) {
  console.log("");
  console.log("NullKeys development preview");
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
    runDevLaunchPlan(createDevLaunchPlan());
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
