import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";

const publicRootPath = path.resolve(process.cwd(), "public");

function resolvePublicAssetPath(resource: RequestInfo | URL) {
  if (typeof resource === "string") {
    return resource;
  }

  if (resource instanceof URL) {
    return resource.pathname;
  }

  return new URL(resource.url, "http://localhost").pathname;
}

export function readPublicJson<T>(relativePath: string) {
  return JSON.parse(
    readFileSync(path.join(publicRootPath, relativePath.replace(/^\//u, "")), "utf8"),
  ) as T;
}

export function installContentPackFetchMock() {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (resource) => {
      const pathname = resolvePublicAssetPath(resource);
      const absolutePath = path.join(publicRootPath, pathname.replace(/^\//u, ""));

      try {
        const body = readFileSync(absolutePath, "utf8");
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch {
        return new Response("Not found", {
          status: 404,
        });
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
}
