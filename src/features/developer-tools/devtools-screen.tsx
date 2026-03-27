"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/shared/action-button";
import { PageFrame } from "@/components/shared/page-frame";
import { Panel } from "@/components/shared/panel";
import { planAdaptiveSession } from "@/features/adaptive-practice/adaptive-planner";
import { buildProgressionProfileId } from "@/features/adaptive-practice/learner-progression";
import {
  seedDeveloperPreviewData,
  type DemoSeedResult,
} from "@/features/developer-tools/demo-session-data";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import {
  clearStoredPreferences,
} from "@/features/user-preferences/preferences-store";
import {
  clearStoredHistory,
  listSessionRecords,
  readLearnerProgressProfile,
} from "@/lib/persistence/session-repository";
import type {
  CharacterPerformanceEntry,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";
import { formatPercent, formatRate } from "@/lib/utils/formatting";

function aggregateCharacterPerformanceMap(sessionRecords: SessionRecord[]) {
  return sessionRecords.reduce<Record<string, CharacterPerformanceEntry>>((accumulator, sessionRecord) => {
    for (const [character, nextEntry] of Object.entries(sessionRecord.perCharacterPerformance)) {
      const existingEntry = accumulator[character];

      if (!existingEntry) {
        accumulator[character] = { ...nextEntry };
        continue;
      }

      accumulator[character] = {
        ...existingEntry,
        attemptCount: existingEntry.attemptCount + nextEntry.attemptCount,
        correctCount: existingEntry.correctCount + nextEntry.correctCount,
        mistakeCount: existingEntry.mistakeCount + nextEntry.mistakeCount,
        smoothedResponseMs: Math.round(
          (existingEntry.smoothedResponseMs + nextEntry.smoothedResponseMs) / 2,
        ),
        bestRecentResponseMs:
          existingEntry.bestRecentResponseMs === 0
            ? nextEntry.bestRecentResponseMs
            : Math.min(existingEntry.bestRecentResponseMs, nextEntry.bestRecentResponseMs),
        masteryScore: Math.round((existingEntry.masteryScore + nextEntry.masteryScore) / 2),
        lastSeenAt:
          new Date(existingEntry.lastSeenAt).getTime() > new Date(nextEntry.lastSeenAt).getTime()
            ? existingEntry.lastSeenAt
            : nextEntry.lastSeenAt,
      };
    }

    return accumulator;
  }, {});
}

export function DeveloperToolsScreen() {
  const { preferences, hydrated, patchPreferences } = usePracticePreferencesState();
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [learnerProgressProfile, setLearnerProgressProfile] =
    useState<LearnerProgressProfile | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"seed" | "clear" | "reset" | "refresh" | null>(null);

  const characterPerformanceMap = useMemo(
    () => aggregateCharacterPerformanceMap(sessionRecords),
    [sessionRecords],
  );
  const adaptivePlan = useMemo(
    () =>
      planAdaptiveSession({
        characterPerformanceMap,
        preferences,
        recentSessions: sessionRecords.slice(0, 24),
        learnerProgressProfile,
      }),
    [characterPerformanceMap, learnerProgressProfile, preferences, sessionRecords],
  );
  const adaptiveSessionCount = sessionRecords.filter(
    (sessionRecord) => sessionRecord.sessionKind === "adaptive",
  ).length;
  const benchmarkSessionCount = sessionRecords.filter(
    (sessionRecord) => sessionRecord.sessionKind === "benchmark",
  ).length;
  const recentNetSpeed =
    sessionRecords.length === 0
      ? 0
      : sessionRecords.reduce((sum, sessionRecord) => sum + sessionRecord.netWpm, 0) /
        sessionRecords.length;
  const recentAccuracy =
    sessionRecords.length === 0
      ? 100
      : sessionRecords.reduce((sum, sessionRecord) => sum + sessionRecord.accuracy, 0) /
        sessionRecords.length;

  const refreshInspectorState = useCallback(async () => {
    setBusyAction("refresh");

    try {
      const progressionProfileId = buildProgressionProfileId({
        languageId: preferences.selectedLanguageId,
        keyboardLayoutId: preferences.selectedKeyboardLayoutId,
        inputMode: preferences.selectedInputMode,
        programmerModeEnabled: preferences.programmerModeEnabled,
      });
      const [storedSessionRecords, storedLearnerProgressProfile] = await Promise.all([
        listSessionRecords(),
        readLearnerProgressProfile(progressionProfileId),
      ]);

      setSessionRecords(storedSessionRecords);
      setLearnerProgressProfile(storedLearnerProgressProfile);
    } finally {
      setBusyAction(null);
    }
  }, [
    preferences.programmerModeEnabled,
    preferences.selectedInputMode,
    preferences.selectedKeyboardLayoutId,
    preferences.selectedLanguageId,
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void refreshInspectorState();
  }, [
    hydrated,
    refreshInspectorState,
  ]);

  async function handleSeedDemoData() {
    setBusyAction("seed");

    try {
      const seedResult: DemoSeedResult = await seedDeveloperPreviewData(preferences);
      await refreshInspectorState();
      setStatusMessage(
        `Saved ${seedResult.savedSessionCount} demo sessions. Current adaptive stage is ${seedResult.currentStageIndex + 1}.`,
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClearHistory() {
    setBusyAction("clear");

    try {
      await clearStoredHistory();
      await refreshInspectorState();
      setStatusMessage("Cleared IndexedDB session history, analytics snapshots, and progression profiles.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResetLocalState() {
    setBusyAction("reset");
    await clearStoredHistory();
    clearStoredPreferences();
    window.location.assign("/onboarding");
  }

  if (!hydrated) {
    return null;
  }

  return (
    <PageFrame
      title="Developer tools"
      description="Development-only controls for local preview, seeded demo data, and adaptive-engine inspection."
      themeChoice={preferences.themeChoice}
      onThemeChange={(themeChoice) => patchPreferences({ themeChoice })}
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Panel className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                Development only
              </p>
              <h2 className="text-xl font-semibold text-text">Local preview controls</h2>
              <p className="text-sm text-textMuted">
                Use this page to reset local storage, seed demo progress, and inspect the current adaptive lesson state before manual browser testing.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ActionButton onClick={() => void handleSeedDemoData()} disabled={busyAction !== null}>
                Seed demo progress
              </ActionButton>
              <ActionButton
                tone="secondary"
                onClick={() => void handleClearHistory()}
                disabled={busyAction !== null}
              >
                Clear history
              </ActionButton>
              <ActionButton
                tone="ghost"
                onClick={() => void refreshInspectorState()}
                disabled={busyAction !== null}
              >
                Refresh inspector
              </ActionButton>
              <ActionButton
                tone="danger"
                onClick={() => void handleResetLocalState()}
                disabled={busyAction !== null}
              >
                Reset full local state
              </ActionButton>
            </div>
            {statusMessage ? <p className="text-sm text-textMuted">{statusMessage}</p> : null}
          </Panel>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Panel className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Saved sessions</p>
              <p className="text-3xl font-semibold text-text">{sessionRecords.length}</p>
            </Panel>
            <Panel className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Adaptive</p>
              <p className="text-3xl font-semibold text-text">{adaptiveSessionCount}</p>
            </Panel>
            <Panel className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Benchmark</p>
              <p className="text-3xl font-semibold text-text">{benchmarkSessionCount}</p>
            </Panel>
            <Panel className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Recent average</p>
              <p className="text-lg font-semibold text-text">
                {formatRate(recentNetSpeed)} · {formatPercent(recentAccuracy)}
              </p>
            </Panel>
          </div>
          <Panel className="space-y-4">
            <h3 className="text-lg font-semibold text-text">Current local profile</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-borderTone bg-panelMuted px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Language</p>
                <p className="text-base font-semibold text-text">{preferences.selectedLanguageId}</p>
              </div>
              <div className="rounded-3xl border border-borderTone bg-panelMuted px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Layout</p>
                <p className="text-base font-semibold text-text">{preferences.selectedKeyboardLayoutId}</p>
              </div>
              <div className="rounded-3xl border border-borderTone bg-panelMuted px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Input mode</p>
                <p className="text-base font-semibold text-text">{preferences.selectedInputMode}</p>
              </div>
              <div className="rounded-3xl border border-borderTone bg-panelMuted px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Programmer mode</p>
                <p className="text-base font-semibold text-text">
                  {preferences.programmerModeEnabled ? "enabled" : "disabled"}
                </p>
              </div>
            </div>
          </Panel>
          <Panel className="space-y-4">
            <h3 className="text-lg font-semibold text-text">Adaptive plan preview</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-borderTone bg-panelMuted px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Priority</p>
                <p className="text-sm text-text">{adaptivePlan.priorityCharacters.slice(0, 10).join(" ") || "none"}</p>
              </div>
              <div className="rounded-3xl border border-borderTone bg-panelMuted px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Recovery</p>
                <p className="text-sm text-text">{adaptivePlan.recoveryCharacters.slice(0, 10).join(" ") || "none"}</p>
              </div>
              <div className="rounded-3xl border border-borderTone bg-panelMuted px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Bridge</p>
                <p className="text-sm text-text">{adaptivePlan.bridgeCharacters.slice(0, 10).join(" ") || "none"}</p>
              </div>
              <div className="rounded-3xl border border-borderTone bg-panelMuted px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Unlock preview</p>
                <p className="text-sm text-text">
                  {adaptivePlan.unlockPreviewCharacters.slice(0, 10).join(" ") || "none"}
                </p>
              </div>
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel className="space-y-4">
            <h3 className="text-lg font-semibold text-text">Progression state</h3>
            {learnerProgressProfile ? (
              <div className="space-y-3">
                <p className="text-sm text-textMuted">
                  Stage {learnerProgressProfile.currentStageIndex + 1} · readiness{" "}
                  {learnerProgressProfile.recentReadinessScore} · stability{" "}
                  {learnerProgressProfile.recentStabilityScore}
                </p>
                <p className="text-sm text-textMuted">
                  Active {learnerProgressProfile.activeCharacterSet.length} · unlocked{" "}
                  {learnerProgressProfile.unlockedCharacters.length} · reinforcement{" "}
                  {learnerProgressProfile.reinforcementCharacters.length}
                </p>
                <p className="text-sm text-textMuted">
                  Regression hold: {learnerProgressProfile.regressionHold ? "active" : "clear"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-textMuted">
                No learner profile is stored yet for the current language and layout.
              </p>
            )}
          </Panel>
          <Panel className="space-y-4">
            <h3 className="text-lg font-semibold text-text">Profile JSON</h3>
            <pre className="max-h-[28rem] overflow-auto rounded-3xl border border-borderTone bg-panelMuted p-4 text-xs leading-6 text-textMuted">
              {JSON.stringify(learnerProgressProfile, null, 2)}
            </pre>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
