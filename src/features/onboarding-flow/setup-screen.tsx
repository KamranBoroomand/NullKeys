"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/shared/action-button";
import { FieldLabel, SelectField, ToggleField } from "@/components/shared/form-controls";
import { PageFrame } from "@/components/shared/page-frame";
import { Panel } from "@/components/shared/panel";
import { keyboardFamilies, keyboardLayouts } from "@/features/keyboard-visualizer/keyboard-layout-registry";
import { languageOptions } from "@/features/language-support/language-registry";
import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";
import { themeLibrary } from "@/features/user-preferences/theme-registry";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import { getBuildMetadata } from "@/lib/product/build-metadata";

export function SetupScreen() {
  const buildMetadata = getBuildMetadata();
  const router = useRouter();
  const { preferences, hydrated, replacePreferences, patchPreferences } =
    usePracticePreferencesState();
  const [installableDescription] = useState(
    `If your browser supports installation, ${buildMetadata.name} can be pinned like an app while still keeping data only on this device.`,
  );

  const matchingLayouts = useMemo(
    () =>
      keyboardLayouts.filter(
        (keyboardLayout) => keyboardLayout.familyId === preferences.selectedKeyboardFamilyId,
      ),
    [preferences.selectedKeyboardFamilyId],
  );

  if (!hydrated) {
    return null;
  }

  return (
    <PageFrame
      title="Set up your language, device, and keyboard."
      description={`The first run stays lightweight: choose a typing language, keyboard family, and device style, then ${buildMetadata.name} stores the rest locally.`}
      themeChoice={preferences.themeChoice}
      onThemeChange={(themeChoice) => patchPreferences({ themeChoice })}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <Panel className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">1. Language profile</h2>
              <p className="text-sm text-textMuted">
                Language choice controls direction, word sources, punctuation mix, and character pools for adaptive practice.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel title="Practice language" description="Affects word lists and character drills." />
                <SelectField
                  aria-label="Practice language"
                  value={preferences.selectedLanguageId}
                  onChange={(event) => patchPreferences({ selectedLanguageId: event.target.value })}
                >
                  {languageOptions.map((languageOption) => (
                    <option key={languageOption.id} value={languageOption.id}>
                      {languageOption.label} · {languageOption.nativeLabel}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-2">
                <FieldLabel title="Theme" description="Pick a local color theme for the app shell." />
                <SelectField
                  aria-label="Theme"
                  value={preferences.themeChoice}
                  onChange={(event) =>
                    patchPreferences({
                      themeChoice: event.target.value as typeof preferences.themeChoice,
                    })
                  }
                >
                  {themeLibrary.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          </Panel>
          <Panel className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">2. Keyboard family</h2>
              <p className="text-sm text-textMuted">
                Layout selection changes visual legends, numpad availability, and layout-aware highlighting.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel title="Keyboard family" description="Choose the hardware style you want to mirror." />
                <SelectField
                  aria-label="Keyboard family"
                  value={preferences.selectedKeyboardFamilyId}
                  onChange={(event) => {
                    const selectedFamilyId = event.target.value;
                    const firstMatchingLayout =
                      keyboardLayouts.find((keyboardLayout) => keyboardLayout.familyId === selectedFamilyId) ??
                      keyboardLayouts[0];

                    patchPreferences({
                      selectedKeyboardFamilyId: selectedFamilyId,
                      selectedKeyboardLayoutId: firstMatchingLayout.id,
                    });
                  }}
                >
                  {keyboardFamilies.map((keyboardFamily) => (
                    <option key={keyboardFamily.id} value={keyboardFamily.id}>
                      {keyboardFamily.label} · {keyboardFamily.platformHint}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-2">
                <FieldLabel title="Layout variant" description="Pick the visualizer variant for drills and legends." />
                <SelectField
                  aria-label="Layout variant"
                  value={preferences.selectedKeyboardLayoutId}
                  onChange={(event) => patchPreferences({ selectedKeyboardLayoutId: event.target.value })}
                >
                  {matchingLayouts.map((keyboardLayout) => (
                    <option key={keyboardLayout.id} value={keyboardLayout.id}>
                      {keyboardLayout.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          </Panel>
          <Panel className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">3. Device behavior</h2>
              <p className="text-sm text-textMuted">
                {buildMetadata.name} works on desktop and mobile. These settings tune focus handling, virtual keyboard spacing, and default input mode.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <FieldLabel title="Primary device" description="Choose where you expect to practice most often." />
                <SelectField
                  aria-label="Primary device"
                  value={preferences.devicePreference}
                  onChange={(event) =>
                    patchPreferences({
                      devicePreference: event.target.value as typeof preferences.devicePreference,
                      selectedInputMode: event.target.value === "mobile" ? "touch" : "hardware",
                    })
                  }
                >
                  <option value="desktop">Desktop</option>
                  <option value="mobile">Mobile</option>
                  <option value="hybrid">Hybrid</option>
                </SelectField>
              </div>
              <ToggleField
                checked={preferences.touchOptimizationEnabled}
                onChange={(checked) => patchPreferences({ touchOptimizationEnabled: checked })}
                title="Touch optimizations"
                description="Keep prompt spacing stable when virtual keyboards appear and prefer larger controls."
              />
              <ToggleField
                checked={preferences.numpadEnabled}
                onChange={(checked) => patchPreferences({ numpadEnabled: checked })}
                title="Expect a numpad"
                description="Enable number-pad-specific drills when a full-size layout is selected."
              />
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel className="space-y-4">
            <h3 className="text-lg font-semibold">What stays local</h3>
            <ul className="space-y-2 text-sm text-textMuted">
              <li>Session history, trend data, and per-character performance live in IndexedDB.</li>
              <li>Preferences and immediate UI state live in localStorage.</li>
              <li>Lightweight setup and install hints may use cookies for local convenience only.</li>
            </ul>
          </Panel>
          <Panel className="space-y-4">
            <h3 className="text-lg font-semibold">Install-ready setup</h3>
            <p className="text-sm text-textMuted">{installableDescription}</p>
          </Panel>
          <Panel className="space-y-4">
            <h3 className="text-lg font-semibold">Finish setup</h3>
            <p className="text-sm text-textMuted">
              You can change any of this later in Settings. The adaptive planner will start from these defaults and evolve from your actual typing data.
            </p>
            <ActionButton
              block
              onClick={() => {
                replacePreferences({
                  ...defaultPracticePreferences,
                  ...preferences,
                  onboardingComplete: true,
                });
                router.push("/practice");
              }}
            >
              Save locally and continue
            </ActionButton>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
