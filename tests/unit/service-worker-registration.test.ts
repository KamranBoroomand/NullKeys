import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerServiceWorker,
  resetServiceWorkerRegistrationForTests,
  SERVICE_WORKER_UPDATE_AVAILABLE_EVENT,
} from "@/lib/install/service-worker-registration";
import {
  resetTypingSessionActivityForTests,
  setTypingSessionActivity,
} from "@/lib/input/typing-session-activity";

const mutableProcessEnv = process.env as Record<string, string | undefined>;

describe("service worker registration", () => {
  afterEach(() => {
    resetServiceWorkerRegistrationForTests();
    resetTypingSessionActivityForTests();
    delete mutableProcessEnv.NODE_ENV;
    vi.restoreAllMocks();
  });

  it("skips service worker registration outside production", () => {
    const registerMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          register: registerMock,
        },
      },
    });

    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    mutableProcessEnv.NODE_ENV = "development";
    registerServiceWorker();

    expect(addEventListenerSpy).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("registers the service worker on window load in production", async () => {
    const registration = {
      waiting: null,
      installing: null,
      addEventListener: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    const registerMock = vi.fn().mockResolvedValue(registration);
    const loadListeners: Array<() => void> = [];

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          register: registerMock,
          addEventListener: vi.fn(),
          controller: null,
        },
      },
    });

    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    vi.spyOn(window, "addEventListener").mockImplementation((...args) => {
      const [eventName, listener] = args as [string, EventListenerOrEventListenerObject | null];

      if (eventName !== "load" || !listener) {
        return;
      }

      loadListeners.push(() => {
        const event = new Event("load");

        if (typeof listener === "function") {
          listener(event);
          return;
        }

        listener.handleEvent(event);
      });
    });

    mutableProcessEnv.NODE_ENV = "production";
    registerServiceWorker();

    expect(loadListeners).toHaveLength(1);

    loadListeners[0]?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(registerMock).toHaveBeenCalledWith("/service-worker.js?v=dev", {
      updateViaCache: "none",
    });
    expect(registration.update).toHaveBeenCalled();
  });

  it("does not activate a waiting worker while this tab is typing", async () => {
    const postMessage = vi.fn();
    const registration = {
      waiting: { postMessage },
      installing: null,
      addEventListener: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          register: vi.fn().mockResolvedValue(registration),
          addEventListener: vi.fn(),
          controller: {},
        },
      },
    });
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    let activate: (() => boolean) | null = null;
    window.addEventListener(SERVICE_WORKER_UPDATE_AVAILABLE_EVENT, ((event: CustomEvent) => {
      activate = event.detail.activate;
    }) as EventListener, { once: true });

    mutableProcessEnv.NODE_ENV = "production";
    registerServiceWorker();
    await Promise.resolve();
    await Promise.resolve();
    setTypingSessionActivity("active-session", true);

    const activateUpdate = activate as unknown as (() => boolean);
    expect(activateUpdate()).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();

    setTypingSessionActivity("active-session", false);
    expect(activateUpdate()).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: "NULLKEYS_ACTIVATE_UPDATE" });
  });
});
