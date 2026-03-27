"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isInstallHintDismissed,
  setInstallHintDismissedCookie,
} from "@/features/user-preferences/preferences-store";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallReadiness() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(isInstallHintDismissed());

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

  return {
    canInstall: !dismissed && !installed && installPromptEvent !== null,
    installed,
    requestInstall,
    dismissInstall,
  };
}

