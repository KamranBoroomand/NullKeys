"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ScrollText } from "lucide-react";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { ActionButton } from "@/components/shared/action-button";
import { PassageBoardContent, getPromptRenderMode } from "@/components/practice/passage-board-content";
import { Panel } from "@/components/shared/panel";
import {
  buildBenchmarkCoachReport,
  buildBenchmarkLatencyDistribution,
  buildBenchmarkMetricDistribution,
  buildBenchmarkRollingSegments,
  collectBenchmarkConfusions,
  rankBenchmarkCharacters,
} from "@/features/benchmark-mode/benchmark-report-analysis";
import { getLanguageDefinition } from "@/features/language-support/language-registry";
import { describeIntegrityInvalidReason } from "@/lib/scoring/session-validity";
import type { SessionRecord } from "@/lib/scoring/session-models";
import { countTextGraphemes } from "@/lib/text/language-text-normalization";
import { classNames } from "@/lib/utils/class-names";
import { formatPercent, formatRate, formatRelativeSessionDate } from "@/lib/utils/formatting";

export function BenchmarkMetricBlock({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="min-w-[15rem] text-center">
      <div className="border-b border-borderTone/80 pb-2">
        <span className="text-5xl font-semibold text-text sm:text-6xl">{value}</span>
        <span className="ml-2 text-2xl text-textMuted">{unit}</span>
      </div>
      <p className="pt-2 text-base text-textMuted">{label}</p>
    </div>
  );
}

export function BenchmarkSummaryCell({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-sm text-textMuted">{description}</p>
    </div>
  );
}

export function BenchmarkReplayPreview({ sessionRecord }: { sessionRecord: SessionRecord }) {
  const replayLanguage = getLanguageDefinition(sessionRecord.languageId);
  const [stepIndex, setStepIndex] = useState(sessionRecord.attemptLog.length);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const intervalHandle = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= sessionRecord.attemptLog.length) {
          window.clearInterval(intervalHandle);
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 50);
    return () => window.clearInterval(intervalHandle);
  }, [playing, sessionRecord.attemptLog.length]);
  useEffect(() => {
    setStepIndex(sessionRecord.attemptLog.length);
    setPlaying(false);
  }, [sessionRecord.sessionId, sessionRecord.attemptLog.length]);

  const replayAttempts = sessionRecord.attemptLog.slice(0, stepIndex);
  const completedCharacters = replayAttempts.filter((attempt) => attempt.correct).length;
  const elapsedMs = replayAttempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0);
  const accuracy = replayAttempts.length === 0 ? 100 : Number(((completedCharacters / replayAttempts.length) * 100).toFixed(1));
  const replaySpeed = elapsedMs === 0 ? 0 : Number((((completedCharacters / 5) * 60_000) / elapsedMs).toFixed(1));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-textMuted">
          Replay progress {completedCharacters}/{countTextGraphemes(sessionRecord.promptText)} · {formatRate(replaySpeed)} WPM · {formatPercent(accuracy)}
        </div>
        <div className="flex gap-2">
          <ActionButton tone="secondary" onClick={() => { setStepIndex(0); setPlaying(true); }}>Replay</ActionButton>
          <ActionButton tone="ghost" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</ActionButton>
        </div>
      </div>
      <input type="range" min={0} max={sessionRecord.attemptLog.length} value={stepIndex} onChange={(event) => { setPlaying(false); setStepIndex(Number(event.target.value)); }} className="w-full accent-[hsl(var(--accent))]" />
      <div className="border border-borderTone/70 bg-panel/70 px-4 py-4 text-lg leading-9 text-text sm:text-xl">
        <div lang={replayLanguage.localeTag} dir={replayLanguage.direction} data-prompt-render-mode={getPromptRenderMode(replayLanguage.scriptFamily)} className={classNames("text-start [unicode-bidi:plaintext]", replayLanguage.direction === "rtl" && "font-sans leading-[1.8] tracking-[0]", replayLanguage.scriptFamily === "hiragana" && "font-sans leading-[1.74] tracking-[0.015em] [line-break:strict] [word-break:keep-all]")}>
          <PassageBoardContent promptText={sessionRecord.promptText} completedCount={completedCharacters} whitespaceStyle="none" direction={replayLanguage.direction} scriptFamily={replayLanguage.scriptFamily} />
        </div>
      </div>
    </div>
  );
}

interface BenchmarkReportProps {
  sessionRecord: SessionRecord;
  matchingHistory: SessionRecord[];
  benchmarkDurationSeconds: number;
  contentFamilyLabel: string;
  keyboardLayoutId: string;
  onReplay: () => void;
  onNext: () => void;
}

export function BenchmarkReport({
  sessionRecord,
  matchingHistory,
  benchmarkDurationSeconds,
  contentFamilyLabel,
  keyboardLayoutId,
  onReplay,
  onNext,
}: BenchmarkReportProps) {
  const report = useMemo(() => {
    const previousResult =
      matchingHistory.find((record) => record.sessionId !== sessionRecord.sessionId) ?? null;
    const coach = buildBenchmarkCoachReport(sessionRecord, previousResult, matchingHistory);
    const rankedHistory = sessionRecord.rankingEligible
      ? matchingHistory
          .slice()
          .sort((left, right) => right.netWpm - left.netWpm || right.accuracy - left.accuracy)
      : [];

    return {
      coach,
      slowCharacters: rankBenchmarkCharacters(sessionRecord.perCharacterPerformance, "slow"),
      errorCharacters: rankBenchmarkCharacters(sessionRecord.perCharacterPerformance, "errors"),
      confusionPairs: collectBenchmarkConfusions(sessionRecord),
      rollingSegments: buildBenchmarkRollingSegments(sessionRecord),
      latencyDistribution: buildBenchmarkLatencyDistribution(sessionRecord),
      speedDistribution: buildBenchmarkMetricDistribution(matchingHistory, "speed"),
      accuracyDistribution: buildBenchmarkMetricDistribution(matchingHistory, "accuracy"),
      localRank:
        rankedHistory.length === 0
          ? null
          : rankedHistory.findIndex((record) => record.sessionId === sessionRecord.sessionId) + 1,
    };
  }, [matchingHistory, sessionRecord]);
  const reportLanguage = getLanguageDefinition(sessionRecord.languageId);
  const recentMatchingHistory = matchingHistory.slice(0, 6);

  return (
    <Panel className="space-y-5" data-testid="benchmark-report">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Completion report</p>
          <h2 className="text-2xl font-semibold text-text">Most recent local result</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton tone="secondary" onClick={onReplay}>Replay same prompt</ActionButton>
          <ActionButton tone="secondary" onClick={onNext}>Next test</ActionButton>
        </div>
      </div>

      {sessionRecord.rankingEligible !== true ? (
        <div className="rounded-xl border border-warn/45 bg-warn/10 px-4 py-4 text-sm leading-6 text-textMuted" role="alert">
          <p className="font-semibold text-text">This result is diagnostic only and cannot rank.</p>
          <p>
            {sessionRecord.completionReason === "time-expired"
              ? "The benchmark deadline expired before the prompt completed."
              : sessionRecord.integrity?.invalidReasons[0]
                ? describeIntegrityInvalidReason(sessionRecord.integrity.invalidReasons[0])
                : "The benchmark did not complete under ranking-eligible conditions."}
            {" "}It remains in local history so you can understand what happened.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col items-center justify-center gap-5 py-2 sm:flex-row">
        <BenchmarkMetricBlock label="Speed" value={formatRate(sessionRecord.netWpm)} unit="WPM" />
        <div className="hidden h-20 border-l border-borderTone/80 sm:block" />
        <BenchmarkMetricBlock label="Accuracy" value={formatPercent(sessionRecord.accuracy)} unit="%" />
      </div>
      <p className="text-center text-sm leading-6 text-textMuted">{report.coach.summary}</p>

      <div className="grid gap-3 lg:grid-cols-3">
        <CoachingCard
          label="Run shape"
          value={report.coach.speedShift < -4 ? "Faded late" : report.coach.speedShift > 4 ? "Finished stronger" : "Stayed even"}
          description={report.coach.takeaways[0] ?? "The run shape is too short to interpret yet."}
        />
        <CoachingCard
          label="Likely cause"
          value={report.coach.confusionPairs[0]
            ? `${report.coach.confusionPairs[0].expectedCharacter}/${report.coach.confusionPairs[0].enteredCharacter}`
            : report.errorCharacters[0]?.character ?? "General control"}
          description={report.coach.takeaways[1] ?? report.coach.takeaways[0] ?? "No single bottleneck dominated this run."}
        />
        <CoachingCard
          label="Train next"
          value={report.coach.percentileRank == null ? "Practice first" : `${report.coach.percentileRank}th percentile`}
          description={report.coach.nextSteps[0]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <BenchmarkSummaryCell label="Gross speed" value={formatRate(sessionRecord.grossWpm)} description="Raw pace before error penalties." />
        <BenchmarkSummaryCell label="Corrected errors" value={String(sessionRecord.correctedErrorCount)} description={`Uncorrected ${sessionRecord.uncorrectedErrorCount}`} />
        <BenchmarkSummaryCell label="Duration" value={`${sessionRecord.benchmarkDurationSeconds ?? benchmarkDurationSeconds}s`} description={contentFamilyLabel} />
        <BenchmarkSummaryCell label="Recorded" value={formatRelativeSessionDate(sessionRecord.endedAt)} description={keyboardLayoutId} />
        <BenchmarkSummaryCell label="Local rank" value={report.localRank == null ? "n/a" : `#${report.localRank}`} description={`${matchingHistory.length} matching local tests`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionChart title="Speed histogram" description="Current result against local runs with the same preset and source family." buckets={report.speedDistribution} />
        <DistributionChart title="Accuracy histogram" description="Control compared with your matching local history." buckets={report.accuracyDistribution} accentClassName="bg-success" />
        <TrendChart title="WPM graph" data={report.rollingSegments.map(({ label, speed }) => ({ label, value: speed }))} />
        <TrendChart title="Accuracy graph" data={report.rollingSegments.map(({ label, accuracy }) => ({ label, value: accuracy }))} colorClassName="stroke-success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <DistributionChart title="Timing distribution" description="Per-character timings grouped into response bands." buckets={report.latencyDistribution} accentClassName="bg-success" />
        <ReportListCard
          title="Segment review"
          emptyMessage="This run was too short to divide into meaningful segments."
          items={report.rollingSegments.map((segment) => ({
            key: segment.label,
            title: segment.label,
            detail: `${formatRate(segment.speed)} WPM · ${formatPercent(segment.accuracy)} accuracy`,
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TextListCard title="What changed in this run" items={report.coach.takeaways} />
        <TextListCard title="Practice recommendation" items={report.coach.nextSteps} />
        <CharacterListCard title="Slowest keys in this run" entries={report.slowCharacters} detail="slow" />
        <CharacterListCard title="Error hotspots" entries={report.errorCharacters} detail="errors" />
      </div>

      <ReportListCard
        title="Confusion pairs"
        emptyMessage="No dominant confusion pair stood out in this result."
        items={report.confusionPairs.map((pair) => ({
          key: `${pair.expectedCharacter}-${pair.enteredCharacter}`,
          title: `${pair.expectedCharacter} / ${pair.enteredCharacter}`,
          detail: `${pair.count} slips in this run`,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <ReportListCard
          title="Matching tests"
          emptyMessage="No matching history yet."
          items={recentMatchingHistory.map((record) => ({
            key: record.sessionId,
            title: `${formatRate(record.netWpm)} net WPM`,
            detail: `${formatPercent(record.accuracy)} accuracy · ${formatRelativeSessionDate(record.endedAt)}`,
          }))}
        />
        <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4" data-testid="benchmark-review-panel">
          <div className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-accent" /><p className="text-sm font-semibold text-text">Replay and review</p></div>
          <div className="mt-3 space-y-4">
            <BenchmarkReplayPreview sessionRecord={sessionRecord} />
            <p className="rounded-xl border border-borderTone/80 bg-panel px-4 py-4 text-sm leading-6 text-textMuted">Replay is best for locating drift. Focus first on {report.coach.nextSteps[0]}</p>
            <div className="space-y-2 rounded-xl border border-borderTone/80 bg-panel px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Prompt text</p>
              <p lang={reportLanguage.localeTag} dir={reportLanguage.direction} data-testid="benchmark-prompt-preview" className={classNames("text-start text-sm leading-7 text-textMuted [unicode-bidi:plaintext]", reportLanguage.direction === "rtl" && "font-sans leading-[1.85] tracking-[0] [word-break:keep-all]", reportLanguage.scriptFamily === "cyrillic" && "tracking-[-0.004em]", reportLanguage.scriptFamily === "hiragana" && "font-sans leading-[1.74] tracking-[0.015em] [line-break:strict] [word-break:keep-all]")}>{sessionRecord.promptText}</p>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function CoachingCard({ label, value, description }: { label: string; value: string; description: string }) {
  return <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"><p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">{label}</p><p className="mt-2 text-lg font-semibold text-text">{value}</p><p className="mt-1 text-sm leading-6 text-textMuted">{description}</p></div>;
}

interface ReportListItem { key: string; title: string; detail: string }

function ReportListCard({ title, items, emptyMessage }: { title: string; items: ReportListItem[]; emptyMessage: string }) {
  return <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"><p className="text-sm font-semibold text-text">{title}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{items.length === 0 ? <p className="text-sm text-textMuted">{emptyMessage}</p> : items.map((item) => <div key={item.key} className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3"><p className="text-sm font-semibold text-text">{item.title}</p><p className="mt-1 text-sm text-textMuted">{item.detail}</p></div>)}</div></div>;
}

function TextListCard({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" /><p className="text-sm font-semibold text-text">{title}</p></div><div className="mt-3 space-y-3">{items.map((item) => <div key={item} className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3 text-sm leading-6 text-textMuted">{item}</div>)}</div></div>;
}

function CharacterListCard({ title, entries, detail }: { title: string; entries: SessionRecord["perCharacterPerformance"][string][]; detail: "slow" | "errors" }) {
  return <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" /><p className="text-sm font-semibold text-text">{title}</p></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{entries.map((entry) => <div key={entry.character} className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3"><p className="text-lg font-semibold text-text">{entry.character}</p><p className="text-sm text-textMuted">{detail === "slow" ? `${entry.smoothedResponseMs} ms · ${entry.mistakeCount} mistakes` : `${entry.mistakeCount} mistakes · ${entry.masteryScore} mastery`}</p></div>)}</div></div>;
}
