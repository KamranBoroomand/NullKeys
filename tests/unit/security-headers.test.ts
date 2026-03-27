import path from "node:path";
import { pathToFileURL } from "node:url";

async function importNextConfig() {
  const nextConfigUrl =
    `${pathToFileURL(path.resolve(process.cwd(), "next.config.ts")).href}?t=${Date.now()}`;
  return (await import(nextConfigUrl)).default as {
    poweredByHeader?: boolean;
    headers?: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
  };
}

describe("security headers", () => {
  it("disables x-powered-by and publishes a conservative hardening header set", async () => {
    const nextConfig = await importNextConfig();
    const headerRules = await nextConfig.headers?.();
    const globalRule = headerRules?.find((rule) => rule.source === "/:path*");
    const headerMap = new Map(
      (globalRule?.headers ?? []).map((header) => [header.key, header.value]),
    );

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(headerMap.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headerMap.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headerMap.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headerMap.get("Content-Security-Policy")).toContain("form-action 'self'");
    expect(headerMap.get("Content-Security-Policy")).not.toContain("unsafe-eval");
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
    expect(headerMap.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headerMap.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });
});
