"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isInstallHintDismissed,
  setInstallHintDismissedCookie,
} from "@/features/user-preferences/preferences-store";
import {
  SERVICE_WORKER_UPDATE_AVAILABLE_EVENT,
  SERVICE_WORKER_UPDATE_BLOCKED_EVENT,
} from "@/lib/install/service-worker-registration";
import {
  hasActiveTypingSession,
  TYPING_SESSION_ACTIVITY_EVENT,
} from "@/lib/input/typing-session-activity";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface ServiceWorkerUpdateAvailableEvent extends Event {
  detail?: {
    activate: () => boolean;
  };
}

export function useInstallReadiness() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(isInstallHintDismissed());
  const [activatePendingUpdate, setActivatePendingUpdate] = useState<(() => boolean) | null>(null);
  const [typingSessionActive, setTypingSessionActive] = useState(false);
  const [updateBlocked, setUpdateBlocked] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    function handleUpdateAvailable(event: Event) {
      const updateEvent = event as ServiceWorkerUpdateAvailableEvent;

      if (updateEvent.detail?.activate) {
        setActivatePendingUpdate(() => updateEvent.detail?.activate ?? null);
        setUpdateBlocked(false);
      }
    }

    function handleTypingActivity() {
      setTypingSessionActive(hasActiveTypingSession());
    }

    function handleUpdateBlocked() {
      setUpdateBlocked(true);
    }

    window.addEventListener(SERVICE_WORKER_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    window.addEventListener(SERVICE_WORKER_UPDATE_BLOCKED_EVENT, handleUpdateBlocked);
    window.addEventListener(TYPING_SESSION_ACTIVITY_EVENT, handleTypingActivity);
    handleTypingActivity();

    return () => {
      window.removeEventListener(SERVICE_WORKER_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
      window.removeEventListener(SERVICE_WORKER_UPDATE_BLOCKED_EVENT, handleUpdateBlocked);
      window.removeEventListener(TYPING_SESSION_ACTIVITY_EVENT, handleTypingActivity);
    };
  }, []);

  const requestInstall = useCallback(async () => {
    if (!installPromptEvent) {
      return false;
    }

    await installPromptEvent.prompt();
    const installChoice = await installPromptEvent.userChoice;

    if (installChoice.outcome === "accepted") {
      setInstalled(true);
      setInstallPromptEvent(null);
      return true;
    }

    return false;
  }, [installPromptEvent]);

  const dismissInstall = useCallback(() => {
    setDismissed(true);
    setInstallHintDismissedCookie();
  }, []);

  const activateUpdate = useCallback(() => {
    const activationStarted = activatePendingUpdate?.() ?? false;
    if (!activationStarted) setUpdateBlocked(true);
  }, [activatePendingUpdate]);

  return {
    canInstall: !dismissed && !installed && installPromptEvent !== null,
    installed,
    updateAvailable: activatePendingUpdate !== null,
    updateBlocked,
    typingSessionActive,
    requestInstall,
    dismissInstall,
    activateUpdate,
  };
}
