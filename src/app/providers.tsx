"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  applyAppearancePreferences,
  loadPracticePreferences,
} from "@/features/user-preferences/preferences-store";
import { registerServiceWorker } from "@/lib/install/service-worker-registration";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerServiceWorker();

    const preferences = loadPracticePreferences();
    applyAppearancePreferences(preferences);
  }, []);

  return children;
}
