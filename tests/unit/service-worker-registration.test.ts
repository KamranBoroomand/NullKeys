import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "@/lib/install/service-worker-registration";

const mutableProcessEnv = process.env as Record<string, string | undefined>;

describe("service worker registration", () => {
  afterEach(() => {
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
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const loadListeners: Array<() => void> = [];

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          register: registerMock,
        },
      },
    });

    vi.spyOn(window, "addEventListener").mockImplementation((eventName, listener) => {
      if (eventName === "load") {
        loadListeners.push(listener as () => void);
      }
    });

    mutableProcessEnv.NODE_ENV = "production";
    registerServiceWorker();

    expect(loadListeners).toHaveLength(1);

    loadListeners[0]?.();
    await Promise.resolve();

    expect(registerMock).toHaveBeenCalledWith("/service-worker.js");
  });
});
