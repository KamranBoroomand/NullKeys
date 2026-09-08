"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/shared/action-button";
import { PageFrame } from "@/components/shared/page-frame";
import { PreferencesHydrationShell } from "@/components/shared/preferences-hydration-shell";
import { Panel } from "@/components/shared/panel";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import { listSessionRecords } from "@/lib/persistence/session-repository";
import type { SessionRecord } from "@/lib/scoring/session-models";
import { buildSessionDatasets } from "@/lib/scoring/session-validity";
import { splitTextIntoGraphemes } from "@/lib/text/language-text-normalization";
import { formatPercent, formatRate, formatRelativeSessionDate } from "@/lib/utils/formatting";

export interface RankedSession {
  sessionRecord: SessionRecord;
  promptLength: number;
  uniqueGraphemeCount: number;
}

export function benchmarkConfigurationKey(sessionRecord: SessionRecord) {
  return [
    sessionRecord.benchmarkDurationSeconds ?? "unknown-duration",
    sessionRecord.languageId,
    sessionRecord.keyboardFamilyId,
    sessionRecord.keyboardLayoutId,
    sessionRecord.inputMode,
    sessionRecord.sessionFlavor,
    sessionRecord.contentFamilyId ?? "unknown-family",
    sessionRecord.programmerDrillPresetId ?? "no-programmer-preset",
  ].join("\u0000");
}

function compareRankedSessions(left: RankedSession, right: RankedSession) {
  return (
    right.sessionRecord.netWpm - left.sessionRecord.netWpm ||
    right.sessionRecord.accuracy - left.sessionRecord.accuracy ||
    left.sessionRecord.sessionId.localeCompare(right.sessionRecord.sessionId)
  );
}

export function rankComparableBenchmarkSessions(sessionRecords: SessionRecord[]) {
  return sessionRecords
    .map((sessionRecord) => {
      const promptGraphemes = splitTextIntoGraphemes(sessionRecord.promptText).filter(
        (grapheme) => !/^\s+$/u.test(grapheme),
      );

      return {
        sessionRecord,
        promptLength: promptGraphemes.length,
        uniqueGraphemeCount: new Set(promptGraphemes).size,
      };
    })
    .sort(compareRankedSessions);
}

export function buildComparableBenchmarkBoards(sessionRecords: RankedSession[]) {
  const groups = new Map<string, RankedSession[]>();

  for (const rankedSession of sessionRecords) {
    const configurationKey = benchmarkConfigurationKey(rankedSession.sessionRecord);
    const entries = groups.get(configurationKey) ?? [];
    entries.push(rankedSession);
    groups.set(configurationKey, entries);
  }

  return Array.from(groups.entries())
    .map(([configurationKey, entries]) => {
      const firstEntry = entries[0]?.sessionRecord;

      if (!firstEntry) {
        throw new Error("A benchmark board cannot be empty.");
      }

      return {
        configurationKey,
        label: `${firstEntry.benchmarkDurationSeconds}s · ${firstEntry.languageId} · ${firstEntry.keyboardLayoutId} · ${firstEntry.contentFamilyId ?? firstEntry.sessionFlavor}`,
        entries: entries.slice().sort(compareRankedSessions).slice(0, 10),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

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

function LeaderboardBlock({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: RankedSession[];
}) {
  return (
    <Panel className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        <p className="text-sm leading-6 text-textMuted">{description}</p>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-textMuted">No matching local sessions yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={entry.sessionRecord.sessionId}
              className="grid gap-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 lg:grid-cols-[2.5rem_5.5rem_5.5rem_minmax(0,1fr)_7rem_7.5rem]"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Rank</p>
                <p className="mt-1 text-lg font-semibold text-text">#{index + 1}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Speed</p>
                <p className="mt-1 text-lg font-semibold text-text">{formatRate(entry.sessionRecord.netWpm)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Accuracy</p>
                <p className="mt-1 text-lg font-semibold text-text">{formatPercent(entry.sessionRecord.accuracy)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Run</p>
                <p className="mt-1 text-sm font-semibold text-text">
                  {entry.sessionRecord.contentFamilyId ?? entry.sessionRecord.sessionFlavor}
                </p>
                <p className="text-sm text-textMuted">
                  {entry.uniqueGraphemeCount} graphemes · {entry.promptLength} length · {entry.sessionRecord.keyboardLayoutId}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Mode</p>
                <p className="mt-1 text-sm text-text">{entry.sessionRecord.sessionKind}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Saved</p>
                <p className="mt-1 text-sm text-textMuted">
                  {formatRelativeSessionDate(entry.sessionRecord.endedAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function HighScoresScreen() {
  const { preferences, hydrated, patchPreferences } = usePracticePreferencesState();
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void listSessionRecords().then(setSessionRecords);
  }, [hydrated]);

  const sessionDatasets = useMemo(() => buildSessionDatasets(sessionRecords), [sessionRecords]);
  const rankedSessions = useMemo(
    () => rankComparableBenchmarkSessions(sessionDatasets.ranking),
    [sessionDatasets],
  );
  const comparableBoards = useMemo(
    () => buildComparableBenchmarkBoards(rankedSessions),
    [rankedSessions],
  );
  const activeDays = useMemo(
    () =>
      new Set(
        sessionRecords.map((sessionRecord) => sessionRecord.endedAt.slice(0, 10)),
      ).size,
    [sessionRecords],
  );
  const latestRankedSession = rankedSessions
    .slice()
    .sort(
      (left, right) =>
        Date.parse(right.sessionRecord.endedAt) - Date.parse(left.sessionRecord.endedAt),
    )[0];

  if (!hydrated) {
    return (
      <PreferencesHydrationShell
        eyebrow="High scores"
        title="Local leaderboard"
        description="Only valid, completed results can enter rankings stored on this device."
      />
    );
  }

  return (
    <PageFrame
      eyebrow="High Scores"
      title="Local leaderboard"
      description="Rankings stay on this device. Results are compared only when benchmark duration, language, keyboard, input mode, and content configuration match."
      themeChoice={preferences.themeChoice}
      onThemeChange={(themeChoice) => patchPreferences({ themeChoice })}
      actions={
        <>
          <Link href="/typing-test">
            <ActionButton tone="secondary">Run typing test</ActionButton>
          </Link>
          <Link href="/profile">
            <ActionButton tone="secondary">Open profile</ActionButton>
          </Link>
        </>
      }
    >
      {rankedSessions.length === 0 ? (
        <div className="space-y-5">
          <Panel className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Empty board</p>
              <h2 className="text-2xl font-semibold text-text">No local scores yet</h2>
              <p className="max-w-3xl text-sm leading-6 text-textMuted">
                Complete a supported typing test without an integrity interruption to add a result.
                Adaptive practice remains in progress history but is not placed on a benchmark board.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">First</p>
                <p className="mt-2 text-lg font-semibold text-text">Choose a test setup</p>
                <p className="mt-1 text-sm leading-6 text-textMuted">
                  Duration, language, keyboard, input mode, and content settings define a comparable board.
                </p>
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Then</p>
                <p className="mt-2 text-lg font-semibold text-text">Run a typing test</p>
                <p className="mt-1 text-sm leading-6 text-textMuted">
                  Net WPM determines position, with accuracy used when two results have the same speed.
                </p>
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">If needed</p>
                <p className="mt-2 text-lg font-semibold text-text">Restore prior history</p>
                <p className="mt-1 text-sm leading-6 text-textMuted">
                  Import a local archive from Settings if this browser was cleared or you moved to a new device profile.
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">What appears here</p>
              <h2 className="text-2xl font-semibold text-text">Local scoreboards</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                "Completed and integrity-valid typing tests.",
                "Separate boards for each duration and configuration.",
                "Net WPM ordering with an accuracy tie-break.",
                "Adaptive and interrupted sessions excluded from ranking.",
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
          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Local identity</p>
              <h2 className="text-2xl font-semibold text-text">Anonymous local typist</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-textMuted">
                There is no account system here. This board is only ranking the sessions saved in the
                current browser profile on this device.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCell
                label="Ranked tests"
                value={String(rankedSessions.length)}
                description="Completed tests eligible for benchmark ranking"
              />
              <SummaryCell
                label="Configurations"
                value={String(comparableBoards.length)}
                description="Boards with matching benchmark conditions"
              />
              <SummaryCell
                label="Latest result"
                value={latestRankedSession ? formatRate(latestRankedSession.sessionRecord.netWpm) : "0"}
                description={
                  latestRankedSession
                    ? `${formatPercent(latestRankedSession.sessionRecord.accuracy)} · ${latestRankedSession.sessionRecord.benchmarkDurationSeconds}s`
                    : "No results yet"
                }
              />
              <SummaryCell
                label="Active days"
                value={String(activeDays)}
                description={`${sessionRecords.length} saved local sessions across practice and typing tests`}
              />
            </div>
          </Panel>

          {comparableBoards.map((board) => (
            <LeaderboardBlock
              key={board.configurationKey}
              title={board.label}
              description="Only results with this exact benchmark configuration are compared."
              entries={board.entries}
            />
          ))}

          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Ranking rule</p>
              <h2 className="text-2xl font-semibold text-text">Direct benchmark ordering</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
                Within a matching configuration, higher net WPM ranks first and higher accuracy
                breaks a speed tie.
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
                Exact ties use the session identifier for deterministic display. No length,
                diversity, or mode multiplier is applied.
              </div>
            </div>
          </Panel>
        </div>
      )}
    </PageFrame>
  );
}
