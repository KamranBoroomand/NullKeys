"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  initializePracticePreferences,
} from "@/features/user-preferences/preferences-store";
import { registerServiceWorker } from "@/lib/install/service-worker-registration";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerServiceWorker();

    void initializePracticePreferences();
  }, []);

  return children;
}
