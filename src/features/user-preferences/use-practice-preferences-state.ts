"use client";

import { useEffect, useState } from "react";
import {
  defaultPracticePreferences,
  type PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import {
  loadPracticePreferences,
  savePracticePreferences,
} from "@/features/user-preferences/preferences-store";
import { inferSuggestedPreferences } from "@/features/onboarding-flow/setup-inference";

export function usePracticePreferencesState() {
  const [preferences, setPreferences] = useState<PracticePreferences>(defaultPracticePreferences);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedPreferences = loadPracticePreferences();
    const inferredPreferences = inferSuggestedPreferences();
    const nextPreferences = {
      ...defaultPracticePreferences,
      ...(!storedPreferences?.onboardingComplete ? inferredPreferences : {}),
      ...storedPreferences,
    } satisfies PracticePreferences;

    setPreferences(nextPreferences);
    savePracticePreferences(nextPreferences);
    setHydrated(true);
  }, []);

  const replacePreferences = (nextPreferences: PracticePreferences) => {
    setPreferences(nextPreferences);
    savePracticePreferences(nextPreferences);
  };

  const patchPreferences = (partialPreferences: Partial<PracticePreferences>) => {
    setPreferences((existingPreferences) => {
      const nextPreferences = {
        ...existingPreferences,
        ...partialPreferences,
      } satisfies PracticePreferences;

      savePracticePreferences(nextPreferences);
      return nextPreferences;
    });
  };

  return {
    preferences,
    hydrated,
    replacePreferences,
    patchPreferences,
  };
}
