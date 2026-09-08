import { act, renderHook, waitFor } from "@testing-library/react";
import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";
import {
  getPracticePreferencesSnapshot,
  initializePracticePreferences,
  resetPracticePreferencesStoreForTests,
} from "@/features/user-preferences/preferences-store";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import { getAppDatabase } from "@/lib/persistence/browser-database";
import { clearStoredProfile } from "@/lib/persistence/session-repository";

describe("central preferences store integration", () => {
  beforeEach(async () => {
    resetPracticePreferencesStoreForTests();
    await clearStoredProfile();
    window.localStorage.clear();
  });

  it("applies first-run locale inference only when no stored record exists", async () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("fa-IR");

    const snapshot = await initializePracticePreferences();

    expect(snapshot.recordState).toBe("none");
    expect(snapshot.preferences.selectedLanguageId).toBe("persian");
  });

  it("classifies and migrates a partial stored record without retaining unknown fields", async () => {
    const database = await getAppDatabase();
    await database.put("preferences", {
      key: "practice",
      schemaVersion: defaultPracticePreferences.schemaVersion,
      updatedAt: "2026-08-23T10:00:00.000Z",
      value: {
        schemaVersion: defaultPracticePreferences.schemaVersion,
        selectedLanguageId: "russian",
        unknownImportedField: "discard me",
      },
    } as never);

    const snapshot = await initializePracticePreferences();

    expect(snapshot.recordState).toBe("partially-valid");
    expect(snapshot.preferences.selectedLanguageId).toBe("russian");
    expect(snapshot.preferences).not.toHaveProperty("unknownImportedField");
  });

  it("keeps every hook consumer synchronized through one snapshot", async () => {
    const left = renderHook(() => usePracticePreferencesState());
    const right = renderHook(() => usePracticePreferencesState());
    await waitFor(() => expect(left.result.current.hydrated).toBe(true));

    act(() => left.result.current.patchPreferences({ themeChoice: "legacy-dark" }));

    await waitFor(() => {
      expect(left.result.current.preferences.themeChoice).toBe("legacy-dark");
      expect(right.result.current.preferences.themeChoice).toBe("legacy-dark");
      expect(getPracticePreferencesSnapshot().persistenceStatus).toBe("saved");
    });
  });

  it("reloads an IndexedDB change signaled by another tab's storage event", async () => {
    await initializePracticePreferences();
    const database = await getAppDatabase();
    await database.put("preferences", {
      key: "practice",
      value: { ...defaultPracticePreferences, selectedLanguageId: "russian" },
      schemaVersion: defaultPracticePreferences.schemaVersion,
      updatedAt: "2026-08-23T10:00:00.000Z",
    });

    window.dispatchEvent(new StorageEvent("storage", { key: "nullkeys.preferences.sync.v2" }));

    await waitFor(() =>
      expect(getPracticePreferencesSnapshot().preferences.selectedLanguageId).toBe("russian"),
    );
  });
});
