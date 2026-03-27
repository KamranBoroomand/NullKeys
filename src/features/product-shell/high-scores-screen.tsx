"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/shared/action-button";
import { PageFrame } from "@/components/shared/page-frame";
import { Panel } from "@/components/shared/panel";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import { listSessionRecords } from "@/lib/persistence/session-repository";
import type { SessionRecord } from "@/lib/scoring/session-models";
import { formatPercent, formatRate, formatRelativeSessionDate } from "@/lib/utils/formatting";

interface RankedSession {
  sessionRecord: SessionRecord;
  localScore: number;
  promptLength: number;
  uniqueCharacterCount: number;
}

function computeLocalScore(sessionRecord: SessionRecord) {
  const promptCharacters = sessionRecord.promptText.replace(/\s+/g, "");
  const promptLength = promptCharacters.length;
  const uniqueCharacterCount = new Set(Array.from(promptCharacters)).size;
  const diversityFactor = Math.max(1, Math.sqrt(uniqueCharacterCount / 6));
  const lengthFactor = Math.max(1, Math.log10(promptLength + 10));
  const accuracyFactor = Math.max(0.45, sessionRecord.accuracy / 100);
  const durationFactor = sessionRecord.sessionKind === "benchmark" ? 1.08 : 0.94;
  const completionFactor = sessionRecord.completed ? 1 : 0.82;

  return {
    localScore: Number(
      (
        sessionRecord.netWpm *
        diversityFactor *
        lengthFactor *
        accuracyFactor *
        durationFactor *
        completionFactor
      ).toFixed(1),
    ),
    promptLength,
    uniqueCharacterCount,
  };
}

function rankSessions(sessionRecords: SessionRecord[]) {
  return sessionRecords
    .map((sessionRecord) => ({
      sessionRecord,
      ...computeLocalScore(sessionRecord),
    }))
    .sort((left, right) => right.localScore - left.localScore || right.sessionRecord.netWpm - left.sessionRecord.netWpm);
}

function buildDurationBoards(sessionRecords: RankedSession[]) {
  const groups = new Map<string, RankedSession[]>();

  for (const rankedSession of sessionRecords) {
    const label = rankedSession.sessionRecord.benchmarkDurationSeconds
      ? `${rankedSession.sessionRecord.benchmarkDurationSeconds}s`
      : rankedSession.sessionRecord.contentFamilyId ?? rankedSession.sessionRecord.sessionFlavor;
    const entries = groups.get(label) ?? [];
    entries.push(rankedSession);
    groups.set(label, entries);
  }

  return Array.from(groups.entries())
    .map(([label, entries]) => ({
      label,
      entries: entries.slice(0, 3),
      topScore: entries[0]?.localScore ?? 0,
    }))
    .sort((left, right) => right.topScore - left.topScore)
    .slice(0, 4);
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
              className="grid gap-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 lg:grid-cols-[2.5rem_5.5rem_5.5rem_5.5rem_minmax(0,1fr)_7rem_7.5rem]"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Rank</p>
                <p className="mt-1 text-lg font-semibold text-text">#{index + 1}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Score</p>
                <p className="mt-1 text-lg font-semibold text-text">{entry.localScore}</p>
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
                  {entry.uniqueCharacterCount} chars · {entry.promptLength} length · {entry.sessionRecord.keyboardLayoutId}
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

  const rankedSessions = useMemo(() => rankSessions(sessionRecords), [sessionRecords]);
  const benchmarkBoard = useMemo(
    () => rankedSessions.filter((entry) => entry.sessionRecord.sessionKind === "benchmark"),
    [rankedSessions],
  );
  const practiceBoard = useMemo(
    () => rankedSessions.filter((entry) => entry.sessionRecord.sessionKind === "adaptive"),
    [rankedSessions],
  );
  const recentWindowBoard = useMemo(() => {
    const recentThreshold = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return rankedSessions.filter(
      (entry) => new Date(entry.sessionRecord.endedAt).getTime() >= recentThreshold,
    );
  }, [rankedSessions]);
  const durationBoards = useMemo(() => buildDurationBoards(benchmarkBoard), [benchmarkBoard]);
  const activeDays = useMemo(
    () =>
      new Set(
        sessionRecords.map((sessionRecord) => sessionRecord.endedAt.slice(0, 10)),
      ).size,
    [sessionRecords],
  );
  const bestSession = rankedSessions[0];
  const cleanestSession = rankedSessions
    .slice()
    .sort((left, right) => right.sessionRecord.accuracy - left.sessionRecord.accuracy)[0];
  const fastestSession = rankedSessions
    .slice()
    .sort((left, right) => right.sessionRecord.netWpm - left.sessionRecord.netWpm)[0];

  if (!hydrated) {
    return null;
  }

  return (
    <PageFrame
      eyebrow="High Scores"
      title="Local leaderboard"
      description="This route keeps the classic high-scores slot, but the rankings stay device-local. Scores reward speed, control, text length, and character diversity without requiring an account or a network leaderboard."
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
                Finish a few adaptive lessons and at least one typing test to populate this board.
                Once the device has real history, NullKeys ranks runs by speed, control, text length,
                and character variety instead of showing misleading zero-value leaderboards.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">First</p>
                <p className="mt-2 text-lg font-semibold text-text">Build a local baseline</p>
                <p className="mt-1 text-sm leading-6 text-textMuted">
                  Save 3 to 5 adaptive lessons so the board has enough practice history to rank more than a single lucky run.
                </p>
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Then</p>
                <p className="mt-2 text-lg font-semibold text-text">Run a typing test</p>
                <p className="mt-1 text-sm leading-6 text-textMuted">
                  Benchmark results fill the strongest comparable board because their duration and prompt conditions stay fixed.
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
                "Best typing tests saved on this device.",
                "Recent high scores from the last two weeks.",
                "Best adaptive practice runs ranked with the same local score model.",
                "Per-duration top boards that make short and long tests easier to compare.",
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
                label="Best score"
                value={bestSession ? String(bestSession.localScore) : "0"}
                description={
                  bestSession
                    ? `${formatRate(bestSession.sessionRecord.netWpm)} WPM at ${formatPercent(bestSession.sessionRecord.accuracy)}`
                    : "No results yet"
                }
              />
              <SummaryCell
                label="Fastest run"
                value={fastestSession ? `${formatRate(fastestSession.sessionRecord.netWpm)}` : "0"}
                description={
                  fastestSession
                    ? `${fastestSession.sessionRecord.contentFamilyId ?? fastestSession.sessionRecord.sessionFlavor} at ${formatPercent(fastestSession.sessionRecord.accuracy)}`
                    : "No results yet"
                }
              />
              <SummaryCell
                label="Cleanest run"
                value={cleanestSession ? formatPercent(cleanestSession.sessionRecord.accuracy) : "0%"}
                description={
                  cleanestSession
                    ? `${formatRate(cleanestSession.sessionRecord.netWpm)} WPM with ${cleanestSession.uniqueCharacterCount} distinct characters`
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

          <LeaderboardBlock
            title="Best typing tests"
            description="These are the strongest benchmark runs saved on this device."
            entries={benchmarkBoard.slice(0, 10)}
          />

          <LeaderboardBlock
            title="Recent high scores"
            description="The strongest local runs from the last 14 days, regardless of mode."
            entries={recentWindowBoard.slice(0, 10)}
          />

          <LeaderboardBlock
            title="Best practice runs"
            description="Adaptive lessons are harder to compare directly, but local ranking still helps surface unusually strong sessions."
            entries={practiceBoard.slice(0, 8)}
          />

          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Top tracks</p>
              <h2 className="text-2xl font-semibold text-text">Best boards by test length</h2>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {durationBoards.map((board) => (
                <div
                  key={board.label}
                  className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text">{board.label}</p>
                    <span className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                      top {board.topScore}
                    </span>
                  </div>
                  {board.entries.map((entry, index) => (
                    <div
                      key={entry.sessionRecord.sessionId}
                      className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-text">
                          #{index + 1} · {formatRate(entry.sessionRecord.netWpm)} WPM
                        </p>
                        <span className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                          {formatPercent(entry.sessionRecord.accuracy)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-textMuted">
                        {entry.sessionRecord.contentFamilyId ?? entry.sessionRecord.sessionFlavor} ·{" "}
                        {formatRelativeSessionDate(entry.sessionRecord.endedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Score notes</p>
              <h2 className="text-2xl font-semibold text-text">What the local score is measuring</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
                Speed still matters most, but a run also gets more credit when it stays accurate,
                covers more text, and uses a richer set of characters.
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
                This makes the table more useful than sorting by raw WPM alone. Short, sloppy, or
                low-diversity runs do not automatically dominate the board.
              </div>
            </div>
          </Panel>
        </div>
      )}
    </PageFrame>
  );
}
