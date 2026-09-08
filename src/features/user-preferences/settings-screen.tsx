"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Redo2, RotateCcw, Save } from "lucide-react";
import { KeyboardSurface } from "@/components/keyboard/keyboard-surface";
import { ActionButton } from "@/components/shared/action-button";
import { FieldLabel, SelectField, ToggleField } from "@/components/shared/form-controls";
import { PageFrame } from "@/components/shared/page-frame";
import { PreferencesHydrationShell } from "@/components/shared/preferences-hydration-shell";
import { Panel } from "@/components/shared/panel";
import {
  getContentFamily,
  getVisibleContentFamilies,
} from "@/features/content-families/content-family-registry";
import {
  keyboardFamilies,
  keyboardLayouts,
} from "@/features/keyboard-visualizer/keyboard-layout-registry";
import { resolveLanguageKeyboardContext } from "@/features/keyboard-visualizer/language-keyboard-support";
import { getLanguageDefinition, languageOptions } from "@/features/language-support/language-registry";
import { applyAppearancePreferences } from "@/features/user-preferences/preferences-store";
import {
  defaultPracticePreferences,
  type PracticePreferences,
} from "@/features/user-preferences/preferences-schema";
import { SettingsDisplaySection } from "@/features/user-preferences/settings-display-section";
import {
  SettingsLocalDataSection,
  type LocalDataSummary,
} from "@/features/user-preferences/settings-local-data-section";
import { SettingsSection } from "@/features/user-preferences/settings-section";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import {
  buildLocalProfileArchive,
  MAX_LOCAL_PROFILE_ARCHIVE_BYTES,
  parseLocalProfileArchive,
  restoreLocalProfileArchive,
  resetAllLocalData,
} from "@/lib/persistence/local-profile-archive";
import { getBuildMetadata } from "@/lib/product/build-metadata";
import { clearStoredHistory } from "@/lib/persistence/session-repository";

function preferencesEqual(left: PracticePreferences, right: PracticePreferences) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatWhitespaceStyleLabel(whitespaceStyle: PracticePreferences["whitespaceStyle"]) {
  return whitespaceStyle === "none"
    ? "no spaces"
    : whitespaceStyle === "bar"
      ? "bar spaces"
      : "bullet spaces";
}

function formatPracticeLayoutLabel(layout: PracticePreferences["practicePresentationMode"]) {
  return layout === "full" ? "normal" : layout === "minimal" ? "bare" : "compact";
}

function formatArchiveSummary(summary: {
  sessionCount: number;
  learnerProgressProfileCount: number;
  contentCacheEntryCount: number;
}) {
  return `${summary.sessionCount} sessions, ${summary.learnerProgressProfileCount} learner profiles, and ${summary.contentCacheEntryCount} cached entries`;
}

export function SettingsScreen() {
  const { preferences, hydrated, replacePreferences } = usePracticePreferencesState();
  const [draftPreferences, setDraftPreferences] = useState<PracticePreferences>(preferences);
  const [statusMessage, setStatusMessage] = useState("Everything here stays on this device.");
  const [localDataSummary, setLocalDataSummary] = useState<LocalDataSummary | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    setDraftPreferences(preferences);
  }, [hydrated, preferences]);

  useEffect(() => {
    return () => {
      applyAppearancePreferences(preferences);
    };
  }, [preferences]);

  const matchingLayouts = useMemo(
    () =>
      keyboardLayouts.filter(
        (keyboardLayout) => keyboardLayout.familyId === draftPreferences.selectedKeyboardFamilyId,
      ),
    [draftPreferences.selectedKeyboardFamilyId],
  );
  const selectedKeyboardLayout = useMemo(
    () =>
      keyboardLayouts.find(
        (keyboardLayout) => keyboardLayout.id === draftPreferences.selectedKeyboardLayoutId,
      ) ?? keyboardLayouts[0],
    [draftPreferences.selectedKeyboardLayoutId],
  );
  const currentLanguageDefinition = useMemo(
    () => getLanguageDefinition(draftPreferences.selectedLanguageId),
    [draftPreferences.selectedLanguageId],
  );
  const savedLanguageDefinition = useMemo(
    () => getLanguageDefinition(preferences.selectedLanguageId),
    [preferences.selectedLanguageId],
  );
  const keyboardContext = useMemo(
    () =>
      resolveLanguageKeyboardContext({
        languageId: draftPreferences.selectedLanguageId,
        inputMode: draftPreferences.selectedInputMode,
      }),
    [draftPreferences.selectedInputMode, draftPreferences.selectedLanguageId],
  );
  const selectedContentFamily = useMemo(
    () => getContentFamily(draftPreferences.preferredContentFamilyId),
    [draftPreferences.preferredContentFamilyId],
  );
  const buildMetadata = useMemo(() => getBuildMetadata(), []);
  const hasChanges = hydrated && !preferencesEqual(preferences, draftPreferences);
  const draftLanguagePending = preferences.selectedLanguageId !== draftPreferences.selectedLanguageId;
  const refreshLocalDataSummary = useCallback(async () => {
    const archive = await buildLocalProfileArchive();
    setLocalDataSummary({
      archiveVersion: archive.archiveVersion,
      appSchemaVersion: archive.appSchemaVersion,
      summary: archive.summary,
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void refreshLocalDataSummary();
  }, [hydrated, refreshLocalDataSummary]);

  if (!hydrated) {
    return (
      <PreferencesHydrationShell
        eyebrow="Settings"
        title="Settings"
        description="Language, keyboard, display, lesson, and local browser preferences are opening."
      />
    );
  }

  function updateDraft(partialPreferences: Partial<PracticePreferences>) {
    setDraftPreferences((existingPreferences) => ({
      ...existingPreferences,
      ...partialPreferences,
    }));
  }

  function previewAppearance(partialPreferences: Partial<PracticePreferences>) {
    const nextPreferences = {
      ...draftPreferences,
      ...partialPreferences,
    } satisfies PracticePreferences;

    setDraftPreferences(nextPreferences);
    applyAppearancePreferences(nextPreferences);
  }

  function resetDraftToSaved() {
    setDraftPreferences(preferences);
    applyAppearancePreferences(preferences);
    setStatusMessage("Draft reset to the currently saved local configuration.");
  }

  function restoreDefaults() {
    setDraftPreferences(defaultPracticePreferences);
    applyAppearancePreferences(defaultPracticePreferences);
    setStatusMessage(`Draft reset to ${buildMetadata.name} defaults. Save changes to make them active.`);
  }

  function saveDraft() {
    replacePreferences(draftPreferences);
    setStatusMessage("Saved locally. The updated settings are now active in this browser.");
  }

  async function exportLocalArchive() {
    const archive = await buildLocalProfileArchive();
    const archiveBlob = new Blob([JSON.stringify(archive, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(archiveBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `nullkeys-local-archive-${archive.createdAt.slice(0, 10)}.json`;
    downloadLink.click();
    URL.revokeObjectURL(downloadUrl);
    setStatusMessage(
      `Local archive exported in format v${archive.archiveVersion}. It includes ${formatArchiveSummary(archive.summary)} from this browser.`,
    );
    setLocalDataSummary({
      archiveVersion: archive.archiveVersion,
      appSchemaVersion: archive.appSchemaVersion,
      summary: archive.summary,
    });
  }

  async function importLocalArchive(file: File) {
    if (file.size > MAX_LOCAL_PROFILE_ARCHIVE_BYTES) {
      throw new Error("The selected file is too large to import safely.");
    }

    if (file.type && !/json/i.test(file.type)) {
      throw new Error("The selected file must be a JSON archive.");
    }

    const archiveText = await file.text();
    const parsedArchive = await parseLocalProfileArchive(archiveText);

    await restoreLocalProfileArchive(parsedArchive);
    setDraftPreferences(parsedArchive.preferences);
    setStatusMessage(
      `Local archive imported from format v${parsedArchive.archiveVersion}. Replaced this browser with ${formatArchiveSummary(parsedArchive.summary)}.`,
    );
    await refreshLocalDataSummary();
  }

  async function copyBuildString() {
    try {
      await navigator.clipboard.writeText(buildMetadata.buildString);
      setStatusMessage(`Copied build string: ${buildMetadata.buildString}`);
    } catch {
      setStatusMessage(`Build string: ${buildMetadata.buildString}`);
    }
  }

  return (
    <PageFrame
      title="Settings"
      eyebrow="Settings"
      description="These settings shape the lesson generator, typing behavior, keyboard context, language handling, and local storage model."
      themeChoice={draftPreferences.themeChoice}
      onThemeChange={(themeChoice) => previewAppearance({ themeChoice })}
    >
      <div className="space-y-5">
        <Panel className="space-y-4">
          <p role="status" aria-live="polite" className="max-w-3xl text-sm leading-6 text-textMuted">
            {statusMessage}
          </p>
          <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
            <p className="font-medium text-text">Settings stay draft-only until you save.</p>
            <p>
              Theme and font preview apply immediately here, but language, keyboard, lesson, and progression changes only become active after pressing Save.
            </p>
            <p>
              {draftLanguagePending
                ? `Active practice language is still ${savedLanguageDefinition.label}. The draft is set to ${currentLanguageDefinition.label} and will not switch practice until saved.`
                : "Use the practice-page language selector when you want the active lesson to switch immediately."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Language</p>
              <p className="mt-2 text-sm font-semibold text-text">{currentLanguageDefinition.label}</p>
              <p className="mt-1 text-xs text-textMuted">
                {currentLanguageDefinition.direction.toUpperCase()} · {currentLanguageDefinition.imeProfile}
              </p>
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Lesson</p>
              <p className="mt-2 text-sm font-semibold text-text">{selectedContentFamily.label}</p>
              <p className="mt-1 text-xs text-textMuted">
                {formatPracticeLayoutLabel(draftPreferences.practicePresentationMode)} view · {formatWhitespaceStyleLabel(draftPreferences.whitespaceStyle)}
              </p>
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Keyboard</p>
              <p className="mt-2 text-sm font-semibold text-text">{draftPreferences.selectedKeyboardLayoutId}</p>
              <p className="mt-1 text-xs text-textMuted">
                {draftPreferences.selectedInputMode} · {draftPreferences.numpadEnabled ? "numpad on" : "numpad off"}
              </p>
            </div>
          </div>
        </Panel>

        <SettingsSection
          testId="settings-section-lesson"
          title="Lesson settings"
          description="Control how much text appears, how long a lesson should feel, and which content family users land in by default."
        >
          <div className="space-y-2">
            <FieldLabel title="Lesson span" description="Approximate duration for adaptive practice windows." />
            <SelectField
              aria-label="Lesson span"
              value={String(draftPreferences.lessonSpanSeconds)}
              onChange={(event) => updateDraft({ lessonSpanSeconds: Number(event.target.value) })}
            >
              <option value="60">60 seconds</option>
              <option value="90">90 seconds</option>
              <option value="120">120 seconds</option>
              <option value="180">180 seconds</option>
            </SelectField>
          </div>
          <div className="space-y-2">
            <FieldLabel title="Prompt length" description="Target passage size before adaptive balancing is applied." />
            <SelectField
              aria-label="Prompt length"
              value={String(draftPreferences.passageWordGoal)}
              onChange={(event) => updateDraft({ passageWordGoal: Number(event.target.value) })}
            >
              <option value="18">18 words</option>
              <option value="24">24 words</option>
              <option value="32">32 words</option>
              <option value="40">40 words</option>
              <option value="52">52 words</option>
            </SelectField>
          </div>
          <div className="space-y-2">
            <FieldLabel title="Default content family" description="The default source family shown on the practice page." />
            <SelectField
              aria-label="Default content family"
              value={draftPreferences.preferredContentFamilyId}
              onChange={(event) =>
                updateDraft({
                  preferredContentFamilyId: event.target.value as PracticePreferences["preferredContentFamilyId"],
                })
              }
            >
              {getVisibleContentFamilies().map((contentFamily) => (
                <option key={contentFamily.id} value={contentFamily.id}>
                  {contentFamily.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="space-y-2">
            <FieldLabel title="Default practice layout" description="Choose how much supporting UI surrounds the typing surface." />
            <SelectField
              aria-label="Default practice layout"
              value={draftPreferences.practicePresentationMode}
              onChange={(event) =>
                updateDraft({
                  practicePresentationMode: event.target.value as PracticePreferences["practicePresentationMode"],
                })
              }
            >
              <option value="full">Normal</option>
              <option value="compact">Compact</option>
              <option value="minimal">Bare</option>
            </SelectField>
          </div>
        </SettingsSection>

        <SettingsSection
          testId="settings-section-typing"
          title="Typing settings"
          description="These settings decide how strict mastery is, whether punctuation enters earlier, and how the typing surface behaves."
        >
          <div className="space-y-2">
            <FieldLabel title="Mastery speed goal" description="Lower values require cleaner and faster response timing before a character is treated as stable." />
            <SelectField
              aria-label="Mastery speed goal"
              value={String(draftPreferences.masterySpeedGoal)}
              onChange={(event) => updateDraft({ masterySpeedGoal: Number(event.target.value) })}
            >
              <option value="180">180 ms</option>
              <option value="220">220 ms</option>
              <option value="260">260 ms</option>
              <option value="300">300 ms</option>
            </SelectField>
          </div>
          <ToggleField
            checked={draftPreferences.punctuationEnabled}
            onChange={(checked) => updateDraft({ punctuationEnabled: checked })}
            title="Punctuation drills"
            description="Allow punctuation and operator clusters to enter practice earlier."
          />
          <ToggleField
            checked={draftPreferences.capitalizationEnabled}
            onChange={(checked) => updateDraft({ capitalizationEnabled: checked })}
            title="Capitalization"
            description="Include uppercase targets when the language profile supports them."
          />
          <div className="space-y-2">
            <FieldLabel
              title="Whitespace style"
              description="Choose how spaces are shown in the prompt: hidden, bar markers, or bullet dots like the classic key-first training view."
            />
            <SelectField
              aria-label="Whitespace style"
              value={draftPreferences.whitespaceStyle}
              onChange={(event) =>
                updateDraft({
                  whitespaceStyle: event.target.value as PracticePreferences["whitespaceStyle"],
                })
              }
            >
              <option value="none">No whitespace</option>
              <option value="bar">Bar whitespace</option>
              <option value="bullet">Bullet whitespace</option>
            </SelectField>
          </div>
          <ToggleField
            checked={draftPreferences.spaceSkipsWords}
            onChange={(checked) => updateDraft({ spaceSkipsWords: checked })}
            title="Space skips words"
            description="Pressing space can skip the rest of the current word and move the cursor to the next word boundary."
          />
          <ToggleField
            checked={draftPreferences.programmerModeEnabled}
            onChange={(checked) => updateDraft({ programmerModeEnabled: checked })}
            title="Programmer bias"
            description="Bias explicit code, shell, and symbol drills toward technical material. Adaptive blend still stays natural-language-first."
          />
        </SettingsSection>

        <SettingsSection
          testId="settings-section-keyboard"
          title="Keyboard settings"
          description="The visual keyboard, layout analysis, and practice hints are more useful when they match the board you actually use."
        >
          <div className="space-y-2">
            <FieldLabel title="Keyboard family" description="Switch the overall hardware form factor used by the visualizer and analysis tools." />
            <SelectField
              aria-label="Keyboard family"
              value={draftPreferences.selectedKeyboardFamilyId}
              onChange={(event) => {
                const selectedFamilyId = event.target.value;
                const firstMatchingLayout =
                  keyboardLayouts.find((keyboardLayout) => keyboardLayout.familyId === selectedFamilyId) ??
                  keyboardLayouts[0];

                updateDraft({
                  selectedKeyboardFamilyId: selectedFamilyId,
                  selectedKeyboardLayoutId: firstMatchingLayout.id,
                });
              }}
            >
              {keyboardFamilies.map((keyboardFamily) => (
                <option key={keyboardFamily.id} value={keyboardFamily.id}>
                  {keyboardFamily.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="space-y-2">
            <FieldLabel title="Layout" description="Choose the exact legends and geometry used throughout the app." />
            <SelectField
              aria-label="Layout"
              value={draftPreferences.selectedKeyboardLayoutId}
              onChange={(event) => updateDraft({ selectedKeyboardLayoutId: event.target.value })}
            >
              {matchingLayouts.map((keyboardLayout) => (
                <option key={keyboardLayout.id} value={keyboardLayout.id}>
                  {keyboardLayout.label}
                </option>
              ))}
            </SelectField>
          </div>
          <ToggleField
            checked={draftPreferences.numpadEnabled}
            onChange={(checked) => updateDraft({ numpadEnabled: checked })}
            title="Numpad emphasis"
            description="Promote number-pad sequences when the chosen layout can support them."
          />
          <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Keyboard preview</p>
            <p className="mt-2 text-sm font-semibold text-text">{selectedKeyboardLayout.label}</p>
            <p className="mt-1 text-xs text-textMuted">
              {draftPreferences.selectedKeyboardFamilyId} · {draftPreferences.numpadEnabled ? "numpad visible" : "numpad collapsed"}
            </p>
            <div className="mt-4">
              <KeyboardSurface
                layoutId={draftPreferences.selectedKeyboardLayoutId}
                languageId={draftPreferences.selectedLanguageId}
                highlightedCharacters={[]}
                depressedKeyCodes={[]}
                includeNumpad={draftPreferences.numpadEnabled}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-textMuted">
              Legend context: {keyboardContext.overlayLabel ?? "Current layout legends"}.
              {keyboardContext.suggestedLabel ? ` ${keyboardContext.suggestedLabel}.` : ""}
            </p>
          </div>
        </SettingsSection>

        <SettingsSection
          testId="settings-section-language"
          title="Language settings"
          description="Language controls the character pool, text direction, source material, and layout analysis corpus."
        >
          <div className="space-y-2">
            <FieldLabel title="Language" description="This drives the active script, example text, quotes, words, and IME handling." />
            <SelectField
              aria-label="Language"
              value={draftPreferences.selectedLanguageId}
              onChange={(event) => updateDraft({ selectedLanguageId: event.target.value })}
            >
              {languageOptions.map((languageOption) => (
                <option key={languageOption.id} value={languageOption.id}>
                  {languageOption.label} · {languageOption.nativeLabel}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
            <p className="font-medium text-text">
              {draftLanguagePending
                ? `Draft language: ${currentLanguageDefinition.label}`
                : "Language changes are pending only after Save."}
            </p>
            <p>
              {draftLanguagePending
                ? `The saved live language is still ${savedLanguageDefinition.label}. Save this draft to switch the active practice language.`
                : "Practice uses the saved language preference until you press Save. The practice page sidebar can switch languages instantly when you are mid-session."}
            </p>
          </div>
          <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Language profile notes</p>
            <p className="mt-2 text-sm font-semibold text-text">{currentLanguageDefinition.nativeLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-textMuted">Sample text</p>
            <p
              lang={currentLanguageDefinition.localeTag}
              dir={currentLanguageDefinition.direction}
              className="mt-1 text-start text-sm text-textMuted [unicode-bidi:plaintext]"
            >
              {currentLanguageDefinition.sampleSentence}
            </p>
            <p className="mt-2 text-xs text-textMuted">
              Direction: {currentLanguageDefinition.direction.toUpperCase()} · IME profile: {currentLanguageDefinition.imeProfile}
            </p>
          </div>
        </SettingsSection>

        <SettingsSection
          testId="settings-section-mobile"
          title="Mobile and touch settings"
          description="These controls make the typing surface behave more reliably when the on-screen keyboard appears and space gets tight."
        >
          <div className="space-y-2">
            <FieldLabel title="Primary device" description="Used to infer sensible defaults for touch ergonomics and input mode." />
            <SelectField
              aria-label="Primary device"
              value={draftPreferences.devicePreference}
              onChange={(event) => {
                const nextDevicePreference =
                  event.target.value as PracticePreferences["devicePreference"];

                updateDraft({
                  devicePreference: nextDevicePreference,
                  selectedInputMode: nextDevicePreference === "mobile" ? "touch" : draftPreferences.selectedInputMode,
                });
              }}
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="hybrid">Hybrid</option>
            </SelectField>
          </div>
          <ToggleField
            checked={draftPreferences.touchOptimizationEnabled}
            onChange={(checked) => updateDraft({ touchOptimizationEnabled: checked })}
            title="Touch-safe spacing"
            description="Reserve keyboard inset space and keep controls larger when virtual keyboards cover part of the viewport."
          />
          <ToggleField
            checked={draftPreferences.selectedInputMode === "touch"}
            onChange={(checked) =>
              updateDraft({ selectedInputMode: checked ? "touch" : "hardware" })
            }
            title="Touch input mode"
            description="Use touch-oriented typing defaults instead of hardware key timing."
          />
        </SettingsSection>

        <SettingsSection
          testId="settings-section-advanced"
          title="Advanced and adaptive settings"
          description="These settings influence unlock pacing, content blending, and whether weak keys cycle back into near-term practice."
        >
          <div className="space-y-2">
            <FieldLabel title="Progression pace" description="Measured is conservative; accelerated unlocks new characters sooner." />
            <SelectField
              aria-label="Progression pace"
              value={draftPreferences.progressionPace}
              onChange={(event) =>
                updateDraft({
                  progressionPace: event.target.value as PracticePreferences["progressionPace"],
                })
              }
            >
              <option value="measured">Measured</option>
              <option value="balanced">Balanced</option>
              <option value="accelerated">Accelerated</option>
            </SelectField>
          </div>
          <div className="space-y-2">
            <FieldLabel title="Content source blend" description="Decide how much the generator leans on real words versus synthetic drills." />
            <SelectField
              aria-label="Content source"
              value={draftPreferences.contentSourceBias}
              onChange={(event) =>
                updateDraft({
                  contentSourceBias: event.target.value as PracticePreferences["contentSourceBias"],
                })
              }
            >
              <option value="mixed">Mixed</option>
              <option value="real">Real words</option>
              <option value="synthetic">Synthetic drills</option>
            </SelectField>
          </div>
          <div className="space-y-2">
            <FieldLabel title="Character range" description="Expose only core letters at the low end or the full punctuation range at the high end." />
            <SelectField
              aria-label="Character range"
              value={draftPreferences.activeCharacterRange}
              onChange={(event) =>
                updateDraft({
                  activeCharacterRange: event.target.value as PracticePreferences["activeCharacterRange"],
                })
              }
            >
              <option value="core">Core letters</option>
              <option value="extended">Letters and digits</option>
              <option value="full">Full range</option>
            </SelectField>
          </div>
          <ToggleField
            checked={draftPreferences.retrainWeakCharacters}
            onChange={(checked) => updateDraft({ retrainWeakCharacters: checked })}
            title="Retrain weak characters"
            description="Keep the weakest characters cycling back into practice instead of fading into the background."
          />
        </SettingsSection>

        <SettingsDisplaySection preferences={draftPreferences} onPreview={previewAppearance} />

        <SettingsLocalDataSection
          summary={localDataSummary}
          build={buildMetadata}
          onCopyBuild={() => void copyBuildString()}
          onClearHistory={() => {
            if (window.confirm("Clear locally stored sessions and analytics for this browser? Export an archive first if you may want the history back.")) {
              void clearStoredHistory().then(() => {
                setStatusMessage("Local session history cleared from IndexedDB.");
                void refreshLocalDataSummary();
              });
            }
          }}
          onReopenGuides={() => {
            updateDraft({ onboardingComplete: false, practiceGuideDismissed: false });
            setStatusMessage("Onboarding and the practice guide will reopen after you save.");
          }}
          onExport={() => void exportLocalArchive()}
          onImport={(file) => void importLocalArchive(file).catch((error) => {
            setStatusMessage(error instanceof Error ? error.message : "The selected file could not be imported as a NullKeys archive.");
          })}
          onResetAll={() => {
            if (window.confirm("Reset all local NullKeys data, including settings, onboarding state, and saved history? Export an archive first if you want a rollback point.")) {
              void resetAllLocalData().then(() => {
                replacePreferences(defaultPracticePreferences);
                setDraftPreferences(defaultPracticePreferences);
                setStatusMessage("All local NullKeys data was reset to a clean local baseline.");
                void refreshLocalDataSummary();
              });
            }
          }}
        />

        <div className="sticky bottom-0 z-10 border-t border-borderTone/80 bg-[hsl(var(--surface-raised)/0.96)] py-4 shadow-[0_-18px_40px_-30px_hsl(var(--modal-shadow)/0.5)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="secondary" onClick={restoreDefaults}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore defaults
              </ActionButton>
              <ActionButton tone="secondary" onClick={resetDraftToSaved} disabled={!hasChanges}>
                <Redo2 className="mr-2 h-4 w-4" />
                Reset draft
              </ActionButton>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/">
                <ActionButton tone="secondary">Done</ActionButton>
              </Link>
              <ActionButton onClick={saveDraft} disabled={!hasChanges}>
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
