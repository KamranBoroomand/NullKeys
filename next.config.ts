import { createRequire } from "node:module";
import type { NextConfig } from "next";

interface LoadedBuildMetadata {
  packageVersion: string;
  buildId: string;
  version: string;
  contentPackVersion: string;
  tagline: string;
}

const require = createRequire(import.meta.url);
const { loadBuildMetadata } = require("./scripts/build-metadata.mjs") as {
  loadBuildMetadata: (rootPath?: string) => LoadedBuildMetadata;
};

let buildMetadata: LoadedBuildMetadata;

function buildContentSecurityPolicy() {
  const scriptSources = ["'self'", "'unsafe-inline'"];

  if (process.env.NODE_ENV === "development") {
    scriptSources.push("'unsafe-eval'");
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
    "connect-src 'self' ws: wss:",
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
