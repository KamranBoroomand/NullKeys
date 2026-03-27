"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BreakdownBars } from "@/components/charts/breakdown-bars";
import { CalendarActivity } from "@/components/charts/calendar-activity";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { HeatGrid } from "@/components/charts/heat-grid";
import { TrendChart } from "@/components/charts/trend-chart";
import { KeyboardSurface } from "@/components/keyboard/keyboard-surface";
import { ActionButton } from "@/components/shared/action-button";
import { PageFrame } from "@/components/shared/page-frame";
import { Panel } from "@/components/shared/panel";
import {
  buildAccuracyStreaks,
  buildBreakdown,
  buildCalendarActivity,
  buildCharacterBreakdown,
  buildProgressCoachReport,
  buildCharacterHeatGrid,
  buildCharacterMetricDistribution,
  buildKeyboardHeatmap,
  buildCharacterPanels,
  buildComparisonSummary,
  buildMetricDistribution,
  buildOverviewStats,
  buildTrendSeries,
  summarizeSessionFamilies,
} from "@/features/progress-analytics/summary-selectors";
import { buildProgressionProfileId } from "@/features/adaptive-practice/learner-progression";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import { listSessionRecords, readLearnerProgressProfile } from "@/lib/persistence/session-repository";
import type { LearnerProgressProfile, SessionRecord } from "@/lib/scoring/session-models";
import { formatPercent, formatRate, formatRelativeSessionDate } from "@/lib/utils/formatting";

function SummaryCell({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-sm text-textMuted">{description}</p>
    </div>
  );
}

function ComparisonList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number; averageNetWpm: number; averageAccuracy: number }>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${title}-${item.label}`}
            className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-text">{item.label}</p>
              <span className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                {item.count} sessions
              </span>
            </div>
            <p className="mt-1 text-sm text-textMuted">
              {formatRate(item.averageNetWpm)} net WPM · {formatPercent(item.averageAccuracy)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressScreen() {
  const { preferences, hydrated, patchPreferences } = usePracticePreferencesState();
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [learnerProgressProfile, setLearnerProgressProfile] =
    useState<LearnerProgressProfile | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let cancelled = false;

    async function loadProfileData() {
      const progressionProfileId = buildProgressionProfileId({
        languageId: preferences.selectedLanguageId,
        keyboardLayoutId: preferences.selectedKeyboardLayoutId,
        inputMode: preferences.selectedInputMode,
        programmerModeEnabled: preferences.programmerModeEnabled,
      });
      const [storedSessions, storedLearnerProfile] = await Promise.all([
        listSessionRecords(),
        readLearnerProgressProfile(progressionProfileId),
      ]);

      if (!cancelled) {
        setSessionRecords(storedSessions);
        setLearnerProgressProfile(storedLearnerProfile);
      }
    }

    void loadProfileData();

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    preferences.programmerModeEnabled,
    preferences.selectedInputMode,
    preferences.selectedKeyboardLayoutId,
    preferences.selectedLanguageId,
  ]);

  const overviewStats = useMemo(() => buildOverviewStats(sessionRecords), [sessionRecords]);
  const trendSeries = useMemo(() => buildTrendSeries(sessionRecords.slice(0, 32)), [sessionRecords]);
  const characterPanels = useMemo(() => buildCharacterPanels(sessionRecords), [sessionRecords]);
  const sessionFamilies = useMemo(() => summarizeSessionFamilies(sessionRecords), [sessionRecords]);
  const comparisonSummary = useMemo(() => buildComparisonSummary(sessionRecords), [sessionRecords]);
  const coachReport = useMemo(
    () =>
      buildProgressCoachReport({
        sessionRecords,
        learnerProgressProfile,
      }),
    [learnerProgressProfile, sessionRecords],
  );
  const speedDistribution = useMemo(
    () => buildMetricDistribution(sessionRecords, "speed"),
    [sessionRecords],
  );
  const accuracyDistribution = useMemo(
    () => buildMetricDistribution(sessionRecords, "accuracy"),
    [sessionRecords],
  );
  const characterHeatGrid = useMemo(() => buildCharacterHeatGrid(sessionRecords), [sessionRecords]);
  const keySpeedDistribution = useMemo(
    () => buildCharacterMetricDistribution(sessionRecords, "speed"),
    [sessionRecords],
  );
  const keyFrequencyDistribution = useMemo(
    () => buildCharacterMetricDistribution(sessionRecords, "frequency"),
    [sessionRecords],
  );
  const keySpeedBreakdown = useMemo(
    () => buildCharacterBreakdown(sessionRecords, "speed"),
    [sessionRecords],
  );
  const keyFrequencyBreakdown = useMemo(
    () => buildCharacterBreakdown(sessionRecords, "frequency"),
    [sessionRecords],
  );
  const keyFrequencyHeatmap = useMemo(
    () =>
      buildKeyboardHeatmap(
        sessionRecords,
        preferences.selectedKeyboardLayoutId,
        preferences.selectedLanguageId,
        "frequency",
      ),
    [
      preferences.selectedKeyboardLayoutId,
      preferences.selectedLanguageId,
      sessionRecords,
    ],
  );
  const calendarDays = useMemo(() => buildCalendarActivity(sessionRecords, 28), [sessionRecords]);
  const accuracyStreaks = useMemo(() => buildAccuracyStreaks(sessionRecords), [sessionRecords]);
  const hasHistory = sessionRecords.length > 0;

  if (!hydrated) {
    return null;
  }

  return (
    <PageFrame
      title="Profile"
      eyebrow="Progress"
      description="All saved practice and typing-test results stay here locally, organized as a focused profile instead of a general analytics dashboard."
      themeChoice={preferences.themeChoice}
      onThemeChange={(themeChoice) => patchPreferences({ themeChoice })}
      actions={
        <>
          <Link href="/typing-test">
            <ActionButton tone="secondary">Open typing test</ActionButton>
          </Link>
          <Link href="/">
            <ActionButton tone="secondary">Return to practice</ActionButton>
          </Link>
        </>
      }
    >
      {!hasHistory ? (
        <div className="space-y-5">
          <Panel className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Empty profile</p>
              <h2 className="text-2xl font-semibold text-text">No local history yet</h2>
              <p className="max-w-3xl text-sm leading-6 text-textMuted">
                Finish a few adaptive lessons and one typing test to unlock the charts, heatmaps,
                comparisons, and history sections. Until then, use this page as a checklist for
                what will appear once the device has real evidence.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">First</p>
                <p className="mt-2 text-lg font-semibold text-text">Build a baseline</p>
                <p className="mt-1 text-sm leading-6 text-textMuted">
                  Save 3 to 5 adaptive lessons so weak keys, accuracy streaks, and the keyboard
                  heatmap have enough local evidence to become meaningful.
                </p>
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Then</p>
                <p className="mt-2 text-lg font-semibold text-text">Run one typing test</p>
                <p className="mt-1 text-sm leading-6 text-textMuted">
                  The profile becomes more useful once it can compare guided practice against a
                  fixed benchmark run under the same layout and language.
                </p>
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">If needed</p>
                <p className="mt-2 text-lg font-semibold text-text">Restore saved progress</p>
                <p className="mt-1 text-sm leading-6 text-textMuted">
                  Import or reset local data from Settings if you are moving devices, clearing the
                  browser, or testing a fresh profile.
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">What unlocks here</p>
              <h2 className="text-2xl font-semibold text-text">The local stats lab</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                "All-time and today summaries for speed, minutes, and rhythm.",
                "Speed and accuracy histograms plus trend lines over recent sessions.",
                "Per-key charts, character heatmaps, and keyboard frequency heat.",
                "Calendar history, layout comparisons, and benchmark-versus-practice readings.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted"
                >
                  {item}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : (
        <div className="space-y-5">
          <Panel className="space-y-4" data-testid="progress-summary-section">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">All-time summary</p>
              <h2 className="text-2xl font-semibold text-text">Local totals</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCell
                label="Sessions"
                value={String(overviewStats.allTimeSessions)}
                description={`${overviewStats.adaptiveSessions} adaptive and ${overviewStats.benchmarkSessions} typing tests`}
              />
              <SummaryCell
                label="Minutes"
                value={String(overviewStats.allTimeMinutes)}
                description="Total active typing time saved in the browser."
              />
              <SummaryCell
                label="Average speed"
                value={formatRate(overviewStats.averageNetWpm)}
                description="Average net WPM across all saved sessions."
              />
              <SummaryCell
                label="Average accuracy"
                value={formatPercent(overviewStats.averageAccuracy)}
                description="Read this next to the trend and histogram sections below."
              />
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Today summary</p>
              <h2 className="text-2xl font-semibold text-text">Current rhythm</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCell
                label="Today"
                value={String(overviewStats.todaySessions)}
                description={`${overviewStats.todayMinutes} minutes saved today`}
              />
              <SummaryCell
                label="Today speed"
                value={formatRate(overviewStats.todayNetWpm)}
                description="Useful when checking whether today is stronger or more fatigued than usual."
              />
              <SummaryCell
                label="Today accuracy"
                value={formatPercent(overviewStats.todayAccuracy)}
                description="A quick signal for whether control is drifting."
              />
              <SummaryCell
                label="Consistency"
                value={`${overviewStats.currentStreak}d`}
                description={`Recent consistency score ${comparisonSummary.consistencyScore}`}
              />
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Coach readout</p>
              <h2 className="text-2xl font-semibold text-text">Why performance is moving</h2>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <h3 className="text-lg font-semibold text-text">What changed</h3>
                {coachReport.movementCauses.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-borderTone/80 bg-panel px-4 py-3 text-sm leading-6 text-textMuted"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <h3 className="text-lg font-semibold text-text">Strongest recent gains</h3>
                {coachReport.strongestImprovements.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-borderTone/80 bg-panel px-4 py-3 text-sm leading-6 text-textMuted"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <h3 className="text-lg font-semibold text-text">Train next</h3>
                {coachReport.trainingPriorities.map((priority) => (
                  <div
                    key={`${priority.character}-${priority.title}`}
                    className="rounded-xl border border-borderTone/80 bg-panel px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-text">
                      {priority.character} · {priority.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-textMuted">{priority.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Histograms</p>
              <h2 className="text-2xl font-semibold text-text">Speed and accuracy distribution</h2>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <DistributionChart
                title="Speed histogram"
                description="Wide spread means session quality is still oscillating noticeably."
                buckets={speedDistribution}
              />
              <DistributionChart
                title="Accuracy histogram"
                description="Compression near the top usually means speed, not raw correctness, is now the main constraint."
                buckets={accuracyDistribution}
                accentClassName="bg-success"
              />
            </div>
          </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Progress overview</p>
            <h2 className="text-2xl font-semibold text-text">Speed chart and control over time</h2>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <TrendChart
              title="Speed chart"
              data={trendSeries.map((trendPoint) => ({
                label: trendPoint.label,
                value: trendPoint.speed,
              }))}
            />
            <TrendChart
              title="Accuracy chart"
              data={trendSeries.map((trendPoint) => ({
                label: trendPoint.label,
                value: trendPoint.accuracy,
              }))}
              colorClassName="stroke-success"
            />
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Accuracy streaks</p>
            <h2 className="text-2xl font-semibold text-text">Reliable control bands</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {accuracyStreaks.map((streak) => (
              <div
                key={streak.threshold}
                className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                  {streak.threshold}%+
                </p>
                <p className="mt-2 text-xl font-semibold text-text">{streak.best} sessions</p>
                <p className="mt-1 text-sm text-textMuted">
                  Current streak {streak.current}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Character performance</p>
            <h2 className="text-2xl font-semibold text-text">Weak keys, heat, and recovery</h2>
          </div>
          <HeatGrid
            title="Character pressure heatmap"
            description="Higher cells combine mistake count and slower response timing."
            cells={characterHeatGrid}
            columns={6}
          />
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-text">Weakest keys</h3>
              {characterPanels.weakCharacters.slice(0, 6).map((characterEntry) => (
                <div
                  key={`weak-${characterEntry.character}`}
                  className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold text-text">{characterEntry.character}</span>
                    <span className="text-sm text-textMuted">{characterEntry.masteryScore} mastery</span>
                  </div>
                  <p className="text-sm text-textMuted">
                    {characterEntry.mistakeCount} mistakes · {characterEntry.smoothedResponseMs} ms
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-text">Most improved</h3>
              {characterPanels.improvedCharacters.length === 0 ? (
                <p className="text-sm text-textMuted">More sessions are needed before improvement deltas stabilize.</p>
              ) : (
                characterPanels.improvedCharacters.slice(0, 6).map((characterEntry) => (
                  <div
                    key={`improved-${characterEntry.character}`}
                    className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-3"
                  >
                    <p className="text-lg font-semibold text-text">{characterEntry.character}</p>
                    <p className="text-sm text-textMuted">Mastery delta {characterEntry.delta}</p>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-text">Slowest keys</h3>
              {characterPanels.slowCharacters.slice(0, 6).map((characterEntry) => (
                <div
                  key={`slow-${characterEntry.character}`}
                  className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-3"
                >
                  <p className="text-lg font-semibold text-text">{characterEntry.character}</p>
                  <p className="text-sm text-textMuted">
                    {characterEntry.smoothedResponseMs} ms · {characterEntry.mistakeCount} mistakes
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-text">Per-key narratives</h3>
            <div className="grid gap-3 xl:grid-cols-2">
              {coachReport.perKeyNarratives.map((item) => (
                <div
                  key={`${item.character}-${item.title}`}
                  className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold text-text">{item.character}</span>
                    <span className="text-sm text-textMuted">{item.title}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-textMuted">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Key speed and frequency</p>
            <h2 className="text-2xl font-semibold text-text">Per-key charts, histograms, and heatmap</h2>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <DistributionChart
              title="Key speed histogram"
              description="A tighter cluster means the keyboard is becoming more even instead of hiding slow outliers."
              buckets={keySpeedDistribution}
            />
            <DistributionChart
              title="Key frequency histogram"
              description="This shows whether only a small subset of keys has most of your recorded practice volume."
              buckets={keyFrequencyDistribution}
              accentClassName="bg-accent"
            />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <BreakdownBars title="Key speed chart" items={keySpeedBreakdown} />
            <BreakdownBars title="Key frequency chart" items={keyFrequencyBreakdown} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <Panel className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-text">Key frequency heatmap</h3>
                <p className="text-sm leading-6 text-textMuted">
                  The active keyboard highlights which physical keys carry the most saved local volume.
                </p>
              </div>
              <KeyboardSurface
                layoutId={preferences.selectedKeyboardLayoutId}
                languageId={preferences.selectedLanguageId}
                highlightedCharacters={[]}
                depressedKeyCodes={[]}
                includeNumpad={preferences.numpadEnabled}
                heatmapValues={keyFrequencyHeatmap}
              />
            </Panel>
            <div className="space-y-4 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <div>
                <h3 className="text-lg font-semibold text-text">How to read it</h3>
                <p className="text-sm leading-6 text-textMuted">
                  Bright zones show where your saved sessions spend most of their time. If a hot key is still slow or error-prone, it is a true bottleneck rather than a rare outlier.
                </p>
              </div>
              <p className="text-sm leading-6 text-textMuted">
                Read the keyboard heatmap next to the key speed chart and weak-key panel. Together they tell you whether a problem key matters because it is common, because it is slow, or both.
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Comparisons</p>
            <h2 className="text-2xl font-semibold text-text">Mode, language, layout, and drill family</h2>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ComparisonList title="Language comparison" items={comparisonSummary.languageComparisons} />
            <ComparisonList title="Layout comparison" items={comparisonSummary.layoutComparisons} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ComparisonList title="Mode comparison" items={comparisonSummary.modeComparisons} />
            <ComparisonList
              title="Drill family comparison"
              items={comparisonSummary.contentFamilyComparisons}
            />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <BreakdownBars
              title="Input mode mix"
              items={buildBreakdown(sessionRecords, (sessionRecord) => sessionRecord.inputMode)}
            />
            <div className="space-y-4 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <div>
                <h3 className="text-lg font-semibold text-text">Benchmark vs adaptive</h3>
                <p className="text-sm text-textMuted">
                  This is the fastest way to tell whether test speed is outrunning training depth.
                </p>
              </div>
              {comparisonSummary.benchmarkVsAdaptiveDelta ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryCell
                    label="Net WPM delta"
                    value={comparisonSummary.benchmarkVsAdaptiveDelta.netWpmDelta > 0
                      ? `+${comparisonSummary.benchmarkVsAdaptiveDelta.netWpmDelta.toFixed(1)}`
                      : comparisonSummary.benchmarkVsAdaptiveDelta.netWpmDelta.toFixed(1)}
                    description="Positive means typing tests are faster."
                  />
                  <SummaryCell
                    label="Accuracy delta"
                    value={comparisonSummary.benchmarkVsAdaptiveDelta.accuracyDelta > 0
                      ? `+${comparisonSummary.benchmarkVsAdaptiveDelta.accuracyDelta.toFixed(1)}`
                      : comparisonSummary.benchmarkVsAdaptiveDelta.accuracyDelta.toFixed(1)}
                    description="Positive means typing tests are more accurate."
                  />
                </div>
              ) : (
                <p className="text-sm text-textMuted">
                  Complete both adaptive and typing-test sessions to unlock this comparison.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <BreakdownBars
              title="Row-zone pressure"
              items={comparisonSummary.zonePerformance.map((zoneEntry) => ({
                label: zoneEntry.label,
                count: zoneEntry.mistakeCount,
              }))}
            />
            <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <h3 className="text-lg font-semibold text-text">Accuracy streak alerts</h3>
              {comparisonSummary.regressionAlerts.length === 0 ? (
                <p className="text-sm text-textMuted">
                  No recent regression alerts are visible. That usually means current weak keys are stable enough for normal review.
                </p>
              ) : (
                comparisonSummary.regressionAlerts.map((alert) => (
                  <div
                    key={alert}
                    className="rounded-xl border border-borderTone/80 bg-panel px-4 py-3 text-sm leading-6 text-textMuted"
                  >
                    {alert}
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Calendar and history</p>
            <h2 className="text-2xl font-semibold text-text">When and how you practiced</h2>
          </div>
          <CalendarActivity
            title="Practice calendar"
            description="A 28-day view of when local sessions were actually saved."
            days={calendarDays}
          />
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-text">Recent history</h3>
              {sessionFamilies.recentSessions.map((sessionRecord) => (
                <div
                  key={sessionRecord.sessionId}
                  className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text">
                      {sessionRecord.sessionKind} · {sessionRecord.contentFamilyId ?? sessionRecord.sessionFlavor}
                    </p>
                    <span className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                      {formatRelativeSessionDate(sessionRecord.endedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-textMuted">
                    {formatRate(sessionRecord.netWpm)} net WPM · {formatPercent(sessionRecord.accuracy)} · {sessionRecord.keyboardLayoutId}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-text">Best typing tests</h3>
              {comparisonSummary.bestBenchmarks.map((sessionRecord) => (
                <div
                  key={sessionRecord.sessionId}
                  className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-3"
                >
                  <p className="text-sm font-semibold text-text">
                    {formatRate(sessionRecord.netWpm)} net WPM
                  </p>
                  <p className="mt-1 text-sm text-textMuted">
                    {sessionRecord.contentFamilyId ?? sessionRecord.sessionFlavor} · {sessionRecord.languageId} · {sessionRecord.keyboardLayoutId}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Interpretation</p>
            <h2 className="text-2xl font-semibold text-text">Today, all time, and by mode</h2>
          </div>
          <div className="grid gap-3 xl:grid-cols-3">
            {coachReport.groupingNotes.map((interpretation) => (
              <div
                key={interpretation}
                className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted"
              >
                {interpretation}
              </div>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <h3 className="text-lg font-semibold text-text">Regression causes</h3>
              {coachReport.regressionCauses.map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-borderTone/80 bg-panel px-4 py-3 text-sm leading-6 text-textMuted"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <h3 className="text-lg font-semibold text-text">Next local action</h3>
              {coachReport.trainingPriorities.slice(0, 3).map((priority) => (
                <div
                  key={`${priority.character}-${priority.title}-footer`}
                  className="rounded-xl border border-borderTone/80 bg-panel px-4 py-3"
                >
                  <p className="text-sm font-semibold text-text">
                    {priority.character} · {priority.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-textMuted">{priority.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <BreakdownBars
              title="Language mix"
              items={buildBreakdown(sessionRecords, (sessionRecord) => sessionRecord.languageId)}
            />
            <BreakdownBars
              title="Layout mix"
              items={buildBreakdown(sessionRecords, (sessionRecord) => sessionRecord.keyboardLayoutId)}
            />
          </div>
          <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
            This profile stays local-only. Read it as a personal lab for device-level history,
            interpretation, and repeatable self-review rather than a public dashboard.
          </div>
        </Panel>
        </div>
      )}
    </PageFrame>
  );
}
