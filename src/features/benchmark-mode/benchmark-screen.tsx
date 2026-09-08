"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Settings2 } from "lucide-react";
import { TypingSurface } from "@/components/practice/typing-surface";
import { ActionButton } from "@/components/shared/action-button";
import { FieldLabel, SelectField } from "@/components/shared/form-controls";
import { PageFrame } from "@/components/shared/page-frame";
import { PreferencesHydrationShell } from "@/components/shared/preferences-hydration-shell";
import { Panel } from "@/components/shared/panel";
import { buildBenchmarkDifficultyBand } from "@/features/adaptive-practice/content-difficulty";
import { generatePracticePassage } from "@/features/adaptive-practice/passage-generator";
import { benchmarkPresets, getBenchmarkPreset } from "@/features/benchmark-mode/benchmark-presets";
import { getBenchmarkContentFamilies, getContentFamily } from "@/features/content-families/content-family-registry";
import { loadLanguageContentBundle } from "@/features/content-packs/content-pack-loader";
import { buildLanguageCharacterPool, getLanguageDefinition } from "@/features/language-support/language-registry";
import { resolveLanguageKeyboardContext } from "@/features/keyboard-visualizer/language-keyboard-support";
import {
  getProgrammerDrillPreset,
  programmerDrillPresets,
} from "@/features/programmer-practice/programmer-presets";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import { buildInputLanguageMismatchWarning } from "@/lib/input/input-language-mismatch";
import { useTouchInputSupport } from "@/lib/input/use-touch-input-support";
import { useTypingSession } from "@/lib/input/use-typing-session";
import { listSessionRecords, saveSessionRecord } from "@/lib/persistence/session-repository";
import { scoreTypingSession } from "@/lib/scoring/session-scorer";
import {
  buildSessionDatasets,
  CURRENT_ANALYTICS_VERSION,
  CURRENT_SCORING_VERSION,
} from "@/lib/scoring/session-validity";
import { splitTextIntoGraphemes } from "@/lib/text/language-text-normalization";
import type { SessionContentMetrics, SessionRecord } from "@/lib/scoring/session-models";
import { classNames } from "@/lib/utils/class-names";
import {
  BenchmarkReport,
  BenchmarkSummaryCell as SummaryCell,
} from "@/features/benchmark-mode/benchmark-report-components";

export function BenchmarkScreen() {
  const { preferences, hydrated, patchPreferences } = usePracticePreferencesState();
  const benchmarkContentFamilies = useMemo(() => getBenchmarkContentFamilies(), []);
  const [selectedPresetId, setSelectedPresetId] = useState(benchmarkPresets[2].id);
  const [selectedContentFamilyId, setSelectedContentFamilyId] = useState(
    benchmarkContentFamilies[0]?.id ?? "common-words",
  );
  const [selectedProgrammerPresetId, setSelectedProgrammerPresetId] = useState(
    programmerDrillPresets[0].id,
  );
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [promptRevision, setPromptRevision] = useState(0);
  const [promptText, setPromptText] = useState("");
  const [generatedContentMetrics, setGeneratedContentMetrics] =
    useState<SessionContentMetrics | null>(null);
  const [lockedPromptText, setLockedPromptText] = useState<string | null>(null);
  const [reportSession, setReportSession] = useState<SessionRecord | null>(null);
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const { keyboardInset } = useTouchInputSupport();
  const sessionRecordsReference = useRef(sessionRecords);
  const benchmarkPreset = getBenchmarkPreset(selectedPresetId);
  const benchmarkContentFamily = getContentFamily(selectedContentFamilyId);
  const languageDefinition = getLanguageDefinition(preferences.selectedLanguageId);
  const keyboardContext = resolveLanguageKeyboardContext({
    languageId: preferences.selectedLanguageId,
    inputMode: preferences.selectedInputMode,
  });
  const benchmarkCharacterSet = useMemo(
    () =>
      buildLanguageCharacterPool({
        languageId: preferences.selectedLanguageId,
        punctuationEnabled: benchmarkContentFamily.sessionFlavor !== "plain",
        capitalizationEnabled:
          benchmarkContentFamily.sessionFlavor !== "symbols" &&
          benchmarkContentFamily.sessionFlavor !== "numbers" &&
          preferences.capitalizationEnabled,
        activeCharacterRange:
          benchmarkContentFamily.sessionFlavor === "numbers" ||
          benchmarkContentFamily.sessionFlavor === "symbols"
            ? "full"
            : "extended",
      }),
    [
      benchmarkContentFamily.sessionFlavor,
      preferences.capitalizationEnabled,
      preferences.selectedLanguageId,
    ],
  );
  const effectiveProgrammerPreset = getProgrammerDrillPreset(
    benchmarkContentFamily.programmerPresetId ?? selectedProgrammerPresetId,
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void listSessionRecords().then((records) =>
      setSessionRecords(buildSessionDatasets(records).ranking),
    );
  }, [hydrated]);

  useEffect(() => {
    sessionRecordsReference.current = sessionRecords;
  }, [sessionRecords]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (lockedPromptText) {
      setPromptText(lockedPromptText);
      return;
    }

    let cancelled = false;

    async function refreshPrompt() {
      const targetWordCount =
        benchmarkContentFamily.benchmarkFocus === "endurance"
          ? Math.max(34, benchmarkPreset.durationSeconds * 2)
          : benchmarkContentFamily.benchmarkFocus === "sprint"
            ? Math.max(18, Math.round(benchmarkPreset.durationSeconds * 1.4))
            : Math.max(24, Math.round(benchmarkPreset.durationSeconds * 1.8));
      const currentSessionRecords = sessionRecordsReference.current;
      const difficultyBand = buildBenchmarkDifficultyBand({
        contentFamilyId: benchmarkContentFamily.id,
        durationSeconds: benchmarkPreset.durationSeconds,
        recentSessions: currentSessionRecords,
      });
      const activeCharacterSet =
        benchmarkContentFamily.sessionFlavor === "code"
          ? Array.from(
              new Set([
                ...benchmarkCharacterSet,
                ...effectiveProgrammerPreset.emphasisCharacters,
              ]),
            )
          : benchmarkCharacterSet;
      const contentBundle = await loadLanguageContentBundle({
        languageId: preferences.selectedLanguageId,
        contentFamilyId: benchmarkContentFamily.id,
        activeCharacterSet,
        punctuationEnabled: true,
        difficultyBand,
        targetWordCount,
      });

      if (cancelled) {
        return;
      }

      const generatedPassage = generatePracticePassage({
        languageId: preferences.selectedLanguageId,
        targetWordCount,
        sessionFlavor: benchmarkContentFamily.sessionFlavor,
        priorityCharacters:
          benchmarkContentFamily.sessionFlavor === "code"
            ? effectiveProgrammerPreset.emphasisCharacters.slice(0, 10)
            : [],
        activeCharacterSet,
        contentSourceBias: benchmarkContentFamily.contentSourceBias,
        punctuationEnabled: true,
        capitalizationEnabled:
          benchmarkContentFamily.sessionFlavor !== "symbols" &&
          benchmarkContentFamily.sessionFlavor !== "numbers" &&
          preferences.capitalizationEnabled,
        contentFamilyId: benchmarkContentFamily.id,
        keyboardLayoutId: preferences.selectedKeyboardLayoutId,
        numpadPracticeEnabled: preferences.numpadEnabled,
        programmerDrillPresetId: effectiveProgrammerPreset.id,
        difficultyBand,
        recentSessions: currentSessionRecords,
        contentBundle,
      });

      if (cancelled) {
        return;
      }

      setPromptText(generatedPassage.text);
      setGeneratedContentMetrics(generatedPassage.contentMetrics);
    }

    void refreshPrompt();

    return () => {
      cancelled = true;
    };
  }, [
    benchmarkContentFamily.benchmarkFocus,
    benchmarkContentFamily.contentSourceBias,
    benchmarkContentFamily.id,
    benchmarkContentFamily.sessionFlavor,
    benchmarkCharacterSet,
    benchmarkPreset.durationSeconds,
    effectiveProgrammerPreset.emphasisCharacters,
    effectiveProgrammerPreset.id,
    hydrated,
    lockedPromptText,
    preferences.capitalizationEnabled,
    preferences.numpadEnabled,
    preferences.selectedKeyboardLayoutId,
    preferences.selectedLanguageId,
    promptRevision,
  ]);

  const typingSession = useTypingSession({
    promptText,
    sessionKind: "benchmark",
    sessionFlavor: benchmarkContentFamily.sessionFlavor,
    inputMode: preferences.selectedInputMode,
    expectedScriptFamily: languageDefinition.scriptFamily,
    spaceSkipsWords: preferences.spaceSkipsWords,
    durationSeconds: benchmarkPreset.durationSeconds,
    masterySpeedGoal: preferences.masterySpeedGoal,
    focusLossPolicy: "invalidate",
    onComplete: async (completionPayload) => {
      const scoringOutput = scoreTypingSession({
        promptText: completionPayload.promptText,
        typedText: completionPayload.typedText,
        attemptLog: completionPayload.attemptLog,
        correctedErrorCount: completionPayload.correctedErrorCount,
        startedAt: completionPayload.startedAt,
        endedAt: completionPayload.endedAt,
        durationMs: completionPayload.activeElapsedMs,
        masterySpeedGoal: preferences.masterySpeedGoal,
      });

      const sessionRecord: SessionRecord = {
        sessionId: completionPayload.sessionId,
        sessionKind: "benchmark",
        sessionFlavor: benchmarkContentFamily.sessionFlavor,
        contentFamilyId: benchmarkContentFamily.id,
        languageId: preferences.selectedLanguageId,
        keyboardFamilyId: preferences.selectedKeyboardFamilyId,
        keyboardLayoutId: preferences.selectedKeyboardLayoutId,
        inputMode: preferences.selectedInputMode,
        promptText: completionPayload.promptText,
        typedText: completionPayload.typedText,
        startedAt: completionPayload.startedAt,
        endedAt: completionPayload.endedAt,
        completed: completionPayload.completed,
        completionReason: completionPayload.completionReason,
        integrity: completionPayload.integrity,
        promptCompleted: completionPayload.promptCompleted,
        analyticsEligible: completionPayload.analyticsEligible,
        rankingEligible: completionPayload.rankingEligible,
        learnerModelEligible: completionPayload.learnerModelEligible,
        activeElapsedMs: completionPayload.activeElapsedMs,
        pausedDurationMs: completionPayload.pausedDurationMs,
        scoringVersion: CURRENT_SCORING_VERSION,
        analyticsVersion: CURRENT_ANALYTICS_VERSION,
        priorityCharacters: [],
        activeCharacterSet: Array.from(new Set(splitTextIntoGraphemes(completionPayload.promptText))).slice(0, 64),
        unlockedCharacters: Array.from(new Set(splitTextIntoGraphemes(languageDefinition.sampleSentence))),
        progressionStageIndex: undefined,
        attemptLog: completionPayload.attemptLog,
        perCharacterPerformance: scoringOutput.perCharacterPerformance,
        benchmarkDurationSeconds: benchmarkPreset.durationSeconds,
        programmerDrillPresetId:
          benchmarkContentFamily.sessionFlavor === "code" ? effectiveProgrammerPreset.id : undefined,
        contentMetrics: generatedContentMetrics ?? undefined,
        ...scoringOutput.metrics,
      };

      await saveSessionRecord(sessionRecord);
      const nextSessions = await listSessionRecords();
      setSessionRecords(buildSessionDatasets(nextSessions).ranking);
      setReportSession(sessionRecord);
      setLockedPromptText(sessionRecord.promptText);
      setShowSettingsScreen(false);
    },
  });
  const inputLanguageWarning = typingSession.inputLanguageMismatch
    ? buildInputLanguageMismatchWarning({
        expectedLanguageLabel: languageDefinition.label,
        expectedInputLabel: keyboardContext.overlayShortLabel ?? languageDefinition.label,
        mismatch: typingSession.inputLanguageMismatch,
      })
    : null;

  if (!hydrated) {
    return (
      <PreferencesHydrationShell
        eyebrow="Benchmark"
        title="Typing test"
        description="Typing test mode fixes the environment so local runs can be compared fairly."
      />
    );
  }

  const benchmarkProgressShare =
    benchmarkPreset.durationSeconds > 0
      ? typingSession.startedAt
        ? 1 - (typingSession.remainingMs ?? 0) / (benchmarkPreset.durationSeconds * 1000)
        : 0
      : 0;
  const benchmarkProgressPercent = Math.min(100, Math.max(0, benchmarkProgressShare * 100));
  const matchingBenchmarkHistory = sessionRecords
    .filter(
      (sessionRecord) =>
        sessionRecord.sessionKind === "benchmark" &&
        sessionRecord.languageId === preferences.selectedLanguageId &&
        sessionRecord.keyboardLayoutId === preferences.selectedKeyboardLayoutId &&
        sessionRecord.contentFamilyId === benchmarkContentFamily.id &&
        sessionRecord.benchmarkDurationSeconds === benchmarkPreset.durationSeconds,
    );

  function queueFreshPrompt() {
    setLockedPromptText(null);
    setReportSession(null);
    setShowSettingsScreen(false);
    typingSession.resetSession();
    setPromptRevision((revision) => revision + 1);
  }

  function queueReplayPrompt() {
    const replayPrompt = reportSession?.promptText ?? lockedPromptText ?? promptText;
    setLockedPromptText(replayPrompt);
    setPromptText(replayPrompt);
    setReportSession(null);
    setShowSettingsScreen(false);
    typingSession.resetSession();
  }

  function updatePreset(nextPresetId: string) {
    setSelectedPresetId(nextPresetId);
    queueFreshPrompt();
  }

  function updateContentFamily(nextContentFamilyId: string) {
    setSelectedContentFamilyId(
      nextContentFamilyId as (typeof benchmarkContentFamilies)[number]["id"],
    );
    queueFreshPrompt();
  }

  return (
    <PageFrame
      title="Typing test"
      eyebrow="Benchmark"
      description="Typing test mode fixes the environment so you can compare runs without the coaching noise of adaptive practice."
      themeChoice={preferences.themeChoice}
      onThemeChange={(themeChoice) => patchPreferences({ themeChoice })}
      showHeading={false}
    >
      <div className="mx-auto max-w-[60rem] space-y-6">
        <div className="space-y-4" data-testid="benchmark-setup-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {[
                  benchmarkPreset.label,
                  benchmarkContentFamily.label,
                  languageDefinition.label,
                  preferences.selectedKeyboardLayoutId,
                ].map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-borderTone/70 bg-panel px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-textMuted"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <p className="max-w-3xl text-sm leading-6 text-textMuted">
                Benchmarks should stay consistent. Use the same preset and source family when you want comparable scores, then switch back to practice when the report points to weak keys.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                tone="secondary"
                onClick={() => setShowSettingsScreen((value) => !value)}
              >
                  <Settings2 className="mr-2 h-4 w-4" />
                  {showSettingsScreen
                    ? reportSession
                      ? "Back to report"
                      : "Back to test"
                    : "Test settings"}
              </ActionButton>
              <Link href="/settings">
                <ActionButton tone="ghost">App settings</ActionButton>
              </Link>
              <ActionButton tone="secondary" onClick={queueReplayPrompt}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {reportSession ? "Replay same prompt" : "Replay prompt"}
              </ActionButton>
              <ActionButton tone="secondary" onClick={queueFreshPrompt}>
                {reportSession ? "Next test" : "Fresh prompt"}
              </ActionButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-textMuted">
            {[
              { id: "test", label: "Test" },
              { id: "settings", label: "Settings" },
              { id: "report", label: "Report", disabled: reportSession == null },
            ].map((item) => {
              const active =
                item.id === "settings"
                  ? showSettingsScreen
                  : item.id === "report"
                    ? !showSettingsScreen && reportSession != null
                    : !showSettingsScreen && reportSession == null;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.id === "settings") {
                      setShowSettingsScreen(true);
                    } else if (item.id === "report") {
                      setShowSettingsScreen(false);
                    } else {
                      setShowSettingsScreen(false);
                      if (reportSession) {
                        queueFreshPrompt();
                      }
                    }
                  }}
                  className={classNames(
                    "rounded-full border px-3 py-1 transition",
                    item.disabled
                      ? "cursor-not-allowed border-borderTone/40 text-textMuted/50"
                      : active
                        ? "border-accent/40 bg-accentSoft text-text"
                        : "border-borderTone/70 bg-panel text-textMuted hover:border-accent/30 hover:text-text",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-textMuted">
            <span className="font-medium">Preset:</span>
            <div className="flex flex-wrap gap-2">
              {benchmarkPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => updatePreset(preset.id)}
                  className={classNames(
                    "rounded-full border px-3 py-1 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    selectedPresetId === preset.id
                      ? "border-accent/40 bg-accentSoft text-text"
                      : "border-borderTone/70 bg-panel text-textMuted hover:border-accent/30 hover:text-text",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-textMuted">
            <span className="font-medium">Text source:</span>
            <div className="flex flex-wrap gap-2">
              {benchmarkContentFamilies.map((contentFamily) => (
                <button
                  key={contentFamily.id}
                  type="button"
                  onClick={() => updateContentFamily(contentFamily.id)}
                  className={classNames(
                    "rounded-full border px-3 py-1 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    selectedContentFamilyId === contentFamily.id
                      ? "border-accent/40 bg-accentSoft text-text"
                      : "border-borderTone/70 bg-panel text-textMuted hover:border-accent/30 hover:text-text",
                  )}
                >
                  {contentFamily.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {benchmarkContentFamily.sessionFlavor === "code" ? (
            <div className="max-w-sm space-y-2">
              <FieldLabel
                title="Programmer source"
                description="Choose the symbol pattern set used inside code and shell benchmarks."
              />
              <SelectField
                value={selectedProgrammerPresetId}
                onChange={(event) => {
                  setSelectedProgrammerPresetId(event.target.value);
                  queueFreshPrompt();
                }}
              >
                {programmerDrillPresets.map((programmerPreset) => (
                  <option key={programmerPreset.id} value={programmerPreset.id}>
                    {programmerPreset.label}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null}
        </div>

        {showSettingsScreen ? (
          <Panel className="space-y-5" data-testid="benchmark-settings-screen">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Setup</p>
              <h2 className="text-2xl font-semibold text-text">Configure a repeatable test</h2>
              <p className="max-w-3xl text-sm leading-6 text-textMuted">
                Keep these controls stable when you want comparable runs. Change only one thing at a
                time, then compare the report against matching local results.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel
                  title="Duration preset"
                  description="Longer tests surface fatigue and rhythm drift more clearly."
                />
                <SelectField
                  aria-label="Typing test duration preset"
                  value={selectedPresetId}
                  onChange={(event) => updatePreset(event.target.value)}
                >
                  {benchmarkPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-2">
                <FieldLabel
                  title="Text family"
                  description="Use book-like text for flow, common words for direct comparison, or pseudo-words for stricter control."
                />
                <SelectField
                  aria-label="Typing test text family"
                  value={selectedContentFamilyId}
                  onChange={(event) => updateContentFamily(event.target.value)}
                >
                  {benchmarkContentFamilies.map((contentFamily) => (
                    <option key={contentFamily.id} value={contentFamily.id}>
                      {contentFamily.label}
                    </option>
                  ))}
                </SelectField>
              </div>
              {benchmarkContentFamily.sessionFlavor === "code" ? (
                <div className="space-y-2">
                  <FieldLabel
                    title="Programmer source"
                    description="Choose the code or shell token family used when the test source is code-shaped."
                  />
                  <SelectField
                    aria-label="Typing test programmer source"
                    value={selectedProgrammerPresetId}
                    onChange={(event) => {
                      setSelectedProgrammerPresetId(event.target.value);
                      queueFreshPrompt();
                    }}
                  >
                    {programmerDrillPresets.map((programmerPreset) => (
                      <option key={programmerPreset.id} value={programmerPreset.id}>
                        {programmerPreset.label}
                      </option>
                    ))}
                  </SelectField>
                </div>
              ) : null}
              <div className="space-y-2">
                <FieldLabel
                  title="Whitespace style"
                  description="This changes the visual guidance on the prompt without changing the test content."
                />
                <SelectField
                  aria-label="Typing test whitespace style"
                  value={preferences.whitespaceStyle}
                  onChange={(event) =>
                    patchPreferences({
                      whitespaceStyle: event.target.value as typeof preferences.whitespaceStyle,
                    })
                  }
                >
                  <option value="none">No whitespace</option>
                  <option value="bar">Bar whitespace</option>
                  <option value="bullet">Bullet whitespace</option>
                </SelectField>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCell
                label="Language"
                value={languageDefinition.label}
                description="Typing test uses the currently active language profile."
              />
              <SummaryCell
                label="Layout"
                value={preferences.selectedKeyboardLayoutId}
                description="Set in global settings when your hardware changes."
              />
              <SummaryCell
                label="Input mode"
                value={preferences.selectedInputMode}
                description="Hardware and touch sessions keep separate timing behavior."
              />
              <SummaryCell
                label="Space skip"
                value={preferences.spaceSkipsWords ? "On" : "Off"}
                description="Useful for direct comparison only if you keep it stable."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
                Matching-history comparisons only make sense when preset, source family, language,
                and layout remain the same.
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
                For broader environment changes such as layout, language, theme, or mobile behavior,
                use the app-wide settings page rather than changing them mid-test.
              </div>
            </div>
          </Panel>
        ) : reportSession ? (
          <BenchmarkReport
            sessionRecord={reportSession}
            matchingHistory={matchingBenchmarkHistory}
            benchmarkDurationSeconds={benchmarkPreset.durationSeconds}
            contentFamilyLabel={benchmarkContentFamily.label}
            keyboardLayoutId={preferences.selectedKeyboardLayoutId}
            onReplay={queueReplayPrompt}
            onNext={queueFreshPrompt}
          />
        ) : (
          <>
            <div className="space-y-2 text-sm text-textMuted">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{typingSession.startedAt ? "Test is active" : "Ready to begin"}</span>
                  <span>{benchmarkPreset.durationSeconds}s</span>
                  <span>{benchmarkContentFamily.label}</span>
                  <span>{preferences.selectedInputMode}</span>
                </div>
                <span>{Math.round(benchmarkProgressPercent)}%</span>
              </div>
              <div className="h-2 rounded-full border border-borderTone/60 bg-panel">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${benchmarkProgressPercent}%` }}
                />
              </div>
            </div>

            <TypingSurface
              promptText={promptText}
              typedText={typingSession.typedText}
              inputValue={typingSession.inputValue}
              onTypedTextChange={typingSession.handleTextChange}
              onCompositionStart={typingSession.handleCompositionStart}
              onCompositionUpdate={typingSession.handleCompositionUpdate}
              onCompositionEnd={typingSession.handleCompositionEnd}
              sessionMetrics={typingSession.previewScore.metrics}
              remainingMs={typingSession.remainingMs}
              languageId={languageDefinition.id}
              localeTag={languageDefinition.localeTag}
              scriptFamily={languageDefinition.scriptFamily}
              direction={languageDefinition.direction}
              keyboardInset={preferences.touchOptimizationEnabled ? keyboardInset : 0}
              statusMessage={typingSession.statusMessage}
              warningMessage={inputLanguageWarning}
              onRestart={() => {
                setReportSession(null);
                typingSession.resetSession();
              }}
              onSkip={queueFreshPrompt}
              inputMode={preferences.selectedInputMode}
              imeProfile={languageDefinition.imeProfile}
              presentationMode="compact"
              whitespaceStyle={preferences.whitespaceStyle}
              showStatTiles={false}
              showSessionControls={false}
              showProgressBar={false}
              showReadyMessage={false}
              footerSlot={
                <div className="grid gap-3 md:grid-cols-2">
                  {typingSession.persistenceStatus === "save-failed" ? (
                    <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-4 text-sm leading-6 text-textMuted md:col-span-2">
                      <p className="font-semibold text-text">This result is still in memory.</p>
                      <p>Retry the local save before leaving this page.</p>
                      <ActionButton tone="secondary" onClick={() => typingSession.retrySave()}>
                        Retry save
                      </ActionButton>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
                    Benchmark mode fixes the environment so the score stays comparable. Do not use it as a substitute for remediation.
                  </div>
                  <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
                    Replay keeps the same prompt for a direct comparison. Fresh prompt keeps the family and preset but generates new text.
                  </div>
                </div>
              }
            />
          </>
        )}
      </div>
    </PageFrame>
  );
}
