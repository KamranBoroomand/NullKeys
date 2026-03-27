"use client";

export function registerServiceWorker() {
  if (
    process.env.NODE_ENV !== "production" ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // A failed registration should not block the local-first experience.
    });
  });
}
