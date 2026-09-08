import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const generatorModule = (await import(
  pathToFileURL(path.resolve(process.cwd(), "scripts/generate-service-worker.mjs")).href
)) as {
  deriveServiceWorkerBuildId: (manifest: {
    sourceBuildId: string;
    essentialAssets: string[];
    routes: string[];
    assetIntegrity: Record<string, string>;
  }) => string;
  renderServiceWorker: (manifest: {
    buildId: string;
    essentialAssets: string[];
    routes: string[];
    assetIntegrity: Record<string, string>;
  }) => string;
};

function responseFor(body: string) {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } });
}

function requestKey(request: RequestInfo | URL, ignoreSearch = false) {
  const rawUrl = typeof request === "string" || request instanceof URL ? request.toString() : request.url;
  const url = new URL(rawUrl, "https://nullkeys.test");
  return ignoreSearch ? url.pathname : `${url.pathname}${url.search}`;
}

class MemoryCache {
  entries = new Map<string, Response>();

  async match(request: RequestInfo | URL, options?: CacheQueryOptions) {
    return this.entries.get(requestKey(request, options?.ignoreSearch))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response) {
    this.entries.set(requestKey(request), response.clone());
  }

  async delete(request: RequestInfo | URL, options?: CacheQueryOptions) {
    return this.entries.delete(requestKey(request, options?.ignoreSearch));
  }
}

function buildHarness(options?: {
  buildId?: string;
  fetchImplementation?: (request: RequestInfo | URL) => Promise<Response>;
  clients?: Array<{ id: string; active: boolean }>;
}) {
  const assetBody = "current JavaScript chunk";
  const buildId = options?.buildId ?? "build-a";
  const source = generatorModule.renderServiceWorker({
    buildId,
    essentialAssets: ["/asset.js"],
    routes: ["/offline", "/practice"],
    assetIntegrity: {
      "/asset.js": createHash("sha256").update(assetBody).digest("hex"),
    },
  });
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const cacheStores = new Map<string, MemoryCache>();
  const deletedCaches: string[] = [];
  let skipWaitingCount = 0;
  let claimCount = 0;
  const clientMessages: Array<{ clientId: string; message: unknown }> = [];

  const caches = {
    async open(name: string) {
      const existing = cacheStores.get(name) ?? new MemoryCache();
      cacheStores.set(name, existing);
      return existing;
    },
    async keys() {
      return Array.from(cacheStores.keys());
    },
    async delete(name: string) {
      deletedCaches.push(name);
      return cacheStores.delete(name);
    },
  };
  const runtimeClients = (options?.clients ?? []).map((client) => ({
    id: client.id,
    postMessage(message: unknown) {
      clientMessages.push({ clientId: client.id, message });
      const typedMessage = message as { type?: string; requestId?: string };
      if (typedMessage.type === "NULLKEYS_PREPARE_UPDATE") {
        handlers.get("message")?.({
          data: {
            type: "NULLKEYS_UPDATE_CLIENT_STATE",
            requestId: typedMessage.requestId,
            activeTypingSession: client.active,
          },
          source: { id: client.id },
        });
      }
    },
  }));
  const self = {
    location: { origin: "https://nullkeys.test" },
    clients: {
      async matchAll() {
        return runtimeClients;
      },
      async claim() {
        claimCount += 1;
      },
    },
    async skipWaiting() {
      skipWaitingCount += 1;
    },
    addEventListener(name: string, handler: (event: Record<string, unknown>) => void) {
      handlers.set(name, handler);
    },
  };
  const fetchImplementation = options?.fetchImplementation ?? (async (request: RequestInfo | URL) => {
    const pathname = new URL(
      typeof request === "string" || request instanceof URL ? request.toString() : request.url,
      "https://nullkeys.test",
    ).pathname;
    return responseFor(pathname === "/asset.js" ? assetBody : `route:${pathname}`);
  });

  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetchImplementation,
    crypto: globalThis.crypto,
    Request,
    Response,
    URL,
    Date,
    Math,
    Object,
    Map,
    Set,
    Array,
    Uint8Array,
    Error,
    Promise,
    setTimeout: (callback: () => void) => {
      callback();
      return 0;
    },
  });

  async function dispatchExtendableEvent(name: string, extra: Record<string, unknown> = {}) {
    let operation: Promise<unknown> | null = null;
    handlers.get(name)?.({
      ...extra,
      waitUntil(promise: Promise<unknown>) {
        operation = promise;
      },
    });
    await operation;
  }

  async function dispatchFetch(request: Request | Record<string, unknown>): Promise<Response | null> {
    let responsePromise: Promise<Response> | null = null;
    handlers.get("fetch")?.({
      request,
      respondWith(promise: Promise<Response>) {
        responsePromise = promise;
      },
    });
    const pendingResponse = responsePromise as Promise<Response> | null;
    return pendingResponse ? await pendingResponse : null;
  }

  return {
    assetBody,
    buildId,
    source,
    cacheStores,
    deletedCaches,
    clientMessages,
    dispatchExtendableEvent,
    dispatchFetch,
    get skipWaitingCount() { return skipWaitingCount; },
    get claimCount() { return claimCount; },
  };
}

describe("generated service-worker runtime", () => {
  it("derives cache identity from the exact production asset graph", () => {
    const firstManifest = {
      sourceBuildId: "source-build",
      essentialAssets: ["/b.js", "/a.js"],
      routes: ["/practice", "/offline"],
      assetIntegrity: { "/b.js": "digest-b", "/a.js": "digest-a" },
    };
    const reorderedManifest = {
      ...firstManifest,
      essentialAssets: ["/a.js", "/b.js"],
      routes: ["/offline", "/practice"],
      assetIntegrity: { "/a.js": "digest-a", "/b.js": "digest-b" },
    };
    const changedManifest = {
      ...firstManifest,
      assetIntegrity: { ...firstManifest.assetIntegrity, "/b.js": "changed-digest" },
    };

    expect(generatorModule.deriveServiceWorkerBuildId(firstManifest)).toBe(
      generatorModule.deriveServiceWorkerBuildId(reorderedManifest),
    );
    expect(generatorModule.deriveServiceWorkerBuildId(firstManifest)).not.toBe(
      generatorModule.deriveServiceWorkerBuildId(changedManifest),
    );
  });

  it("installs the exact build assets and serves the offline fallback", async () => {
    let online = true;
    const harness = buildHarness({
      fetchImplementation: async (request) => {
        if (!online) throw new TypeError("offline");
        const pathname = new URL(
          typeof request === "string" || request instanceof URL ? request.toString() : request.url,
          "https://nullkeys.test",
        ).pathname;
        return responseFor(pathname === "/asset.js" ? "current JavaScript chunk" : `route:${pathname}`);
      },
    });
    await harness.dispatchExtendableEvent("install");
    online = false;

    const response = await harness.dispatchFetch({
      method: "GET",
      mode: "navigate",
      destination: "document",
      url: "https://nullkeys.test/not-cached",
    });

    expect(await response?.text()).toBe("route:/offline");
    expect(harness.cacheStores.get("nullkeys-build-build-a")?.entries.has("/asset.js")).toBe(true);
  });

  it("rejects a partial install when an essential asset fetch fails", async () => {
    const harness = buildHarness({
      fetchImplementation: async () => {
        throw new TypeError("network interrupted");
      },
    });
    harness.cacheStores.set("nullkeys-build-older", new MemoryCache());

    await expect(harness.dispatchExtendableEvent("install")).rejects.toThrow();
    expect(harness.cacheStores.has("nullkeys-build-older")).toBe(true);
  });

  it("detects a corrupted cached chunk and replaces it from the network", async () => {
    const harness = buildHarness();
    await harness.dispatchExtendableEvent("install");
    const cache = harness.cacheStores.get("nullkeys-build-build-a");
    cache?.entries.set("/asset.js", responseFor("corrupted"));

    const response = await harness.dispatchFetch(new Request("https://nullkeys.test/asset.js"));

    expect(await response?.text()).toBe(harness.assetBody);
    expect(await (await cache?.match("/asset.js"))?.text()).toBe(harness.assetBody);
  });

  it("does not mix a later navigation response into the installed build cache", async () => {
    let practiceBody = "installed practice route";
    const harness = buildHarness({
      fetchImplementation: async (request) => {
        const pathname = new URL(
          typeof request === "string" || request instanceof URL ? request.toString() : request.url,
          "https://nullkeys.test",
        ).pathname;
        if (pathname === "/asset.js") return responseFor("current JavaScript chunk");
        if (pathname === "/practice") return responseFor(practiceBody);
        return responseFor(`route:${pathname}`);
      },
    });
    await harness.dispatchExtendableEvent("install");
    practiceBody = "later deployed practice route";

    const response = await harness.dispatchFetch({
      method: "GET",
      mode: "navigate",
      destination: "document",
      url: "https://nullkeys.test/practice",
    });

    expect(await response?.text()).toBe("later deployed practice route");
    expect(
      await (
        await harness.cacheStores.get("nullkeys-build-build-a")?.match("/practice")
      )?.text(),
    ).toBe("installed practice route");
  });

  it("passes unknown later-build assets through without caching them", async () => {
    const harness = buildHarness({
      fetchImplementation: async (request) => {
        const pathname = new URL(
          typeof request === "string" || request instanceof URL ? request.toString() : request.url,
          "https://nullkeys.test",
        ).pathname;
        return responseFor(pathname === "/asset.js" ? "current JavaScript chunk" : "later build asset");
      },
    });
    await harness.dispatchExtendableEvent("install");

    const response = await harness.dispatchFetch({
      method: "GET",
      mode: "same-origin",
      destination: "script",
      url: "https://nullkeys.test/_next/static/chunks/later-build.js",
    });

    expect(await response?.text()).toBe("later build asset");
    expect(
      harness.cacheStores
        .get("nullkeys-build-build-a")
        ?.entries.has("/_next/static/chunks/later-build.js"),
    ).toBe(false);
  });

  it("cleans only old NullKeys build caches on activation", async () => {
    const harness = buildHarness({ buildId: "build-b" });
    harness.cacheStores.set("nullkeys-build-build-a", new MemoryCache());
    harness.cacheStores.set("unrelated-cache", new MemoryCache());

    await harness.dispatchExtendableEvent("activate");

    expect(harness.deletedCaches).toEqual(["nullkeys-build-build-a"]);
    expect(harness.cacheStores.has("unrelated-cache")).toBe(true);
    expect(harness.claimCount).toBe(1);
  });

  it("blocks activation when any open tab reports active typing", async () => {
    const harness = buildHarness({
      clients: [
        { id: "idle-tab", active: false },
        { id: "typing-tab", active: true },
      ],
    });

    await harness.dispatchExtendableEvent("message", {
      data: { type: "NULLKEYS_ACTIVATE_UPDATE" },
    });

    expect(harness.skipWaitingCount).toBe(0);
    expect(
      harness.clientMessages.filter(({ message }) =>
        (message as { type?: string }).type === "NULLKEYS_UPDATE_BLOCKED"),
    ).toHaveLength(2);
  });

  it("activates after every open tab reports idle", async () => {
    const harness = buildHarness({
      clients: [
        { id: "left-tab", active: false },
        { id: "right-tab", active: false },
      ],
    });

    await harness.dispatchExtendableEvent("message", {
      data: { type: "NULLKEYS_ACTIVATE_UPDATE" },
    });

    expect(harness.skipWaitingCount).toBe(1);
  });
});
