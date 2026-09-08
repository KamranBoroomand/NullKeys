"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { PracticePreferences } from "@/features/user-preferences/preferences-schema";
import {
  getPracticePreferencesServerSnapshot,
  getPracticePreferencesSnapshot,
  initializePracticePreferences,
  savePracticePreferences,
  subscribeToPracticePreferences,
} from "@/features/user-preferences/preferences-store";

export function usePracticePreferencesState() {
  const snapshot = useSyncExternalStore(
    subscribeToPracticePreferences,
    getPracticePreferencesSnapshot,
    getPracticePreferencesServerSnapshot,
  );

  useEffect(() => {
    void initializePracticePreferences();
  }, []);

  const replacePreferences = useCallback((nextPreferences: PracticePreferences) => {
    void savePracticePreferences(nextPreferences).catch(() => undefined);
  }, []);

  const patchPreferences = useCallback((partialPreferences: Partial<PracticePreferences>) => {
    void savePracticePreferences({
      ...getPracticePreferencesSnapshot().preferences,
      ...partialPreferences,
    }).catch(() => undefined);
  }, []);

  return {
    preferences: snapshot.preferences,
    hydrated: snapshot.hydrated,
    recordState: snapshot.recordState,
    persistenceStatus: snapshot.persistenceStatus,
    persistenceError: snapshot.persistenceError,
    replacePreferences,
    patchPreferences,
  };
}
