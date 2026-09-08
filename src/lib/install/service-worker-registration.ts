"use client";

import { hasActiveTypingSession } from "@/lib/input/typing-session-activity";
import { getBuildMetadata } from "@/lib/product/build-metadata";

export const SERVICE_WORKER_UPDATE_AVAILABLE_EVENT = "nullkeys-service-worker-update-available";
export const SERVICE_WORKER_UPDATE_BLOCKED_EVENT = "nullkeys-service-worker-update-blocked";

interface ServiceWorkerUpdateAvailableDetail {
  activate: () => boolean;
}

let reloadRequestedForUpdate = false;
let lifecycleListenersInstalled = false;
let registrationRequested = false;

function dispatchUpdateAvailable(registration: ServiceWorkerRegistration) {
  const waitingWorker = registration.waiting;
  if (!waitingWorker || !navigator.serviceWorker.controller) return;

  const detail: ServiceWorkerUpdateAvailableDetail = {
    activate: () => {
      if (hasActiveTypingSession()) return false;
      reloadRequestedForUpdate = true;
      waitingWorker.postMessage({ type: "NULLKEYS_ACTIVATE_UPDATE" });
      return true;
    },
  };
  window.dispatchEvent(
    new CustomEvent<ServiceWorkerUpdateAvailableDetail>(
      SERVICE_WORKER_UPDATE_AVAILABLE_EVENT,
      { detail },
    ),
  );
}

function watchForWaitingWorker(registration: ServiceWorkerRegistration) {
  dispatchUpdateAvailable(registration);
  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;
    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed") dispatchUpdateAvailable(registration);
    });
  });
}

function installLifecycleListeners() {
  if (lifecycleListenersInstalled) return;
  lifecycleListenersInstalled = true;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadRequestedForUpdate) window.location.reload();
  });
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (!event.data || typeof event.data !== "object") return;
    const message = event.data as { type?: string; requestId?: string };
    if (message.type === "NULLKEYS_PREPARE_UPDATE" && message.requestId) {
      event.source?.postMessage({
        type: "NULLKEYS_UPDATE_CLIENT_STATE",
        requestId: message.requestId,
        activeTypingSession: hasActiveTypingSession(),
      });
    }
    if (message.type === "NULLKEYS_UPDATE_BLOCKED") {
      reloadRequestedForUpdate = false;
      window.dispatchEvent(new Event(SERVICE_WORKER_UPDATE_BLOCKED_EVENT));
    }
  });
}

async function performRegistration() {
  const buildMetadata = getBuildMetadata();
  const serviceWorkerPath = `/service-worker.js?v=${encodeURIComponent(buildMetadata.buildId)}`;
  installLifecycleListeners();

  try {
    const registration = await navigator.serviceWorker.register(serviceWorkerPath, {
      updateViaCache: "none",
    });
    watchForWaitingWorker(registration);
    await registration.update();
  } catch {
    registrationRequested = false;
  }
}

export function registerServiceWorker() {
  if (
    process.env.NODE_ENV !== "production" ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    registrationRequested
  ) return;

  registrationRequested = true;
  if (document.readyState === "complete") void performRegistration();
  else window.addEventListener("load", () => void performRegistration(), { once: true });
}

export function resetServiceWorkerRegistrationForTests() {
  reloadRequestedForUpdate = false;
  lifecycleListenersInstalled = false;
  registrationRequested = false;
}
