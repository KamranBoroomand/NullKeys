import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import type { NextConfig } from "next";

interface LoadedBuildMetadata {
  packageVersion: string;
  buildId: string;
  version: string;
  contentPackVersion: string;
  tagline: string;
}

type WebpackId = string | number;

interface WebpackModuleLike {
  identifier(): string;
}

interface WebpackChunkLike {
  id: WebpackId | null;
  ids: WebpackId[] | null;
  idNameHints?: Iterable<string>;
  name?: string;
  runtime?: string | Iterable<string>;
}

interface WebpackChunkGraphLike {
  getChunkModulesIterable(chunk: WebpackChunkLike): Iterable<WebpackModuleLike>;
  getModuleId(module: WebpackModuleLike): WebpackId | null;
  setModuleId(module: WebpackModuleLike, id: WebpackId): void;
}

interface WebpackCompilationLike {
  chunkGraph: WebpackChunkGraphLike;
  hooks: {
    chunkIds: {
      tap(name: string, handler: (chunks: Iterable<WebpackChunkLike>) => void): void;
    };
    moduleIds: {
      tap(name: string, handler: (modules: Iterable<WebpackModuleLike>) => void): void;
    };
  };
}

interface WebpackCompilerLike {
  hooks: {
    compilation: {
      tap(name: string, handler: (compilation: WebpackCompilationLike) => void): void;
    };
  };
}

function canonicalWebpackIdentifier(value: string, repositoryRoot: string) {
  const normalizedRoot = repositoryRoot.replaceAll("\\", "/");
  let canonicalValue = value.replaceAll("\\", "/");

  for (const rootVariant of [normalizedRoot, encodeURI(normalizedRoot), encodeURIComponent(normalizedRoot)]) {
    canonicalValue = canonicalValue.replaceAll(rootVariant, "<project>");
  }

  return canonicalValue;
}

function assignStableId(prefix: string, key: string, usedIds: Set<WebpackId>) {
  const digest = createHash("sha256").update(key).digest("hex");

  for (let length = 12; length <= digest.length; length += 4) {
    const id = `${prefix}${BigInt(`0x${digest.slice(0, length)}`).toString(36)}`;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }

  throw new Error(`NullKeys could not allocate a stable ${prefix} Webpack ID.`);
}

function createStableWebpackIdsPlugin(repositoryRoot: string) {
  return {
    apply(compiler: WebpackCompilerLike) {
      compiler.hooks.compilation.tap("NullKeysStableWebpackIds", (compilation) => {
        compilation.hooks.moduleIds.tap("NullKeysStableWebpackIds", (modules) => {
          const chunkGraph = compilation.chunkGraph;
          const usedIds = new Set<WebpackId>();
          const pendingModules = Array.from(modules)
            .filter((module) => {
              const moduleId = chunkGraph.getModuleId(module);
              if (moduleId === null) return true;
              usedIds.add(moduleId);
              return false;
            })
            .map((module) => ({
              key: canonicalWebpackIdentifier(module.identifier(), repositoryRoot),
              module,
            }))
            .sort((left, right) => left.key.localeCompare(right.key));

          for (let index = 0; index < pendingModules.length; index += 1) {
            const entry = pendingModules[index];
            if (index > 0 && entry.key === pendingModules[index - 1].key) {
              throw new Error(`Duplicate canonical Webpack module identifier: ${entry.key}`);
            }
            chunkGraph.setModuleId(entry.module, assignStableId("m", entry.key, usedIds));
          }
        });

        compilation.hooks.chunkIds.tap("NullKeysStableWebpackIds", (chunks) => {
          const chunkGraph = compilation.chunkGraph;
          const usedIds = new Set<WebpackId>();
          const pendingChunks = Array.from(chunks)
            .filter((chunk) => {
              if (chunk.id === null) return true;
              usedIds.add(chunk.id);
              return false;
            })
            .map((chunk) => {
              const moduleIds = Array.from(chunkGraph.getChunkModulesIterable(chunk), (module) => {
                const moduleId = chunkGraph.getModuleId(module);
                if (moduleId === null) throw new Error("A Webpack chunk contains an unassigned module ID.");
                return String(moduleId);
              }).sort();
              const runtime =
                typeof chunk.runtime === "string"
                  ? [chunk.runtime]
                  : Array.from(chunk.runtime ?? []);
              const key = JSON.stringify({
                hints: Array.from(chunk.idNameHints ?? []).sort(),
                modules: moduleIds,
                name: canonicalWebpackIdentifier(chunk.name ?? "", repositoryRoot),
                runtime: runtime.map((value) => canonicalWebpackIdentifier(value, repositoryRoot)).sort(),
              });
              return { chunk, key };
            })
            .sort((left, right) => left.key.localeCompare(right.key));

          for (let index = 0; index < pendingChunks.length; index += 1) {
            const entry = pendingChunks[index];
            if (index > 0 && entry.key === pendingChunks[index - 1].key) {
              throw new Error(`Duplicate canonical Webpack chunk identifier: ${entry.key}`);
            }
            const id = assignStableId("c", entry.key, usedIds);
            entry.chunk.id = id;
            entry.chunk.ids = [id];
          }
        });
      });
    },
  };
}

const require = createRequire(import.meta.url);
const { loadBuildMetadata } = require("./scripts/build-metadata.mjs") as {
  loadBuildMetadata: (rootPath?: string) => LoadedBuildMetadata;
};

let buildMetadata: LoadedBuildMetadata;

function buildContentSecurityPolicy() {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  const connectSources = ["'self'"];

  if (process.env.NODE_ENV === "development") {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("ws:", "wss:");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
  ].join("; ");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

try {
  buildMetadata = loadBuildMetadata();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);

  throw new Error(
    `NullKeys could not load build metadata.\n${detail}\nIf content packs are missing, run \`npm run content:packs\` and retry.`,
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  generateBuildId: async () => buildMetadata.buildId,
  webpack(config, { dev, dir }) {
    if (!dev) {
      config.optimization.moduleIds = false;
      config.optimization.chunkIds = false;
      config.plugins.push(createStableWebpackIdsPlugin(dir));
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_NULLKEYS_PACKAGE_VERSION: buildMetadata.packageVersion,
    NEXT_PUBLIC_NULLKEYS_BUILD_ID: buildMetadata.buildId,
    NEXT_PUBLIC_NULLKEYS_VERSION: buildMetadata.version,
    NEXT_PUBLIC_NULLKEYS_CONTENT_PACK_VERSION: buildMetadata.contentPackVersion,
    NEXT_PUBLIC_NULLKEYS_TAGLINE: buildMetadata.tagline,
  },
};

export default nextConfig;
