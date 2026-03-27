const CACHE_NAME = "nullkeys-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/practice",
  "/benchmark",
  "/progress",
  "/settings",
  "/layouts",
  "/onboarding",
];

function isSameOriginRequest(request) {
  const requestUrl = new URL(request.url);
  return requestUrl.origin === self.location.origin && (requestUrl.protocol === "http:" || requestUrl.protocol === "https:");
}

function shouldCacheResponse(response) {
  if (!response.ok || (response.type !== "basic" && response.type !== "default")) {
    return false;
  }

  return !/\bno-store\b/i.test(response.headers.get("Cache-Control") ?? "");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !isSameOriginRequest(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);

        if (shouldCacheResponse(networkResponse)) {
          const responseClone = networkResponse.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }

        return networkResponse;
      } catch {
        if (event.request.mode === "navigate") {
          return (await caches.match("/")) ?? Response.error();
        }

        return Response.error();
      }
    }),
  );
});
