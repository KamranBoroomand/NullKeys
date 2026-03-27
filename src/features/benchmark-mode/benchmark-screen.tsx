"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, RotateCcw, ScrollText, Settings2 } from "lucide-react";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { PromptBoardContent, getPromptRenderMode } from "@/components/practice/prompt-board-content";
import { TrendChart } from "@/components/charts/trend-chart";
import { TypingSurface } from "@/components/practice/typing-surface";
import { ActionButton } from "@/components/shared/action-button";
import { FieldLabel, SelectField } from "@/components/shared/form-controls";
import { PageFrame } from "@/components/shared/page-frame";
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
import type {
  CharacterPerformanceEntry,
  SessionContentMetrics,
  SessionRecord,
} from "@/lib/scoring/session-models";
import { formatPercent, formatRate, formatRelativeSessionDate } from "@/lib/utils/formatting";
import { classNames } from "@/lib/utils/class-names";

function rankCharacters(
  performanceMap: Record<string, CharacterPerformanceEntry>,
  sortBy: "slow" | "errors",
) {
  return Object.values(performanceMap)
    .sort((left, right) =>
      sortBy === "slow"
        ? right.smoothedResponseMs - left.smoothedResponseMs || right.mistakeCount - left.mistakeCount
        : right.mistakeCount - left.mistakeCount || right.smoothedResponseMs - left.smoothedResponseMs,
    )
    .slice(0, 6);
}

function formatSignedDelta(value: number, unit: string) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${Math.abs(value).toFixed(1)} ${unit}`;
}

function buildResultNarrative(result: SessionRecord, previousResult: SessionRecord | null) {
  const slowCharacter = rankCharacters(result.perCharacterPerformance, "slow")[0];
  const errorCharacter = rankCharacters(result.perCharacterPerformance, "errors")[0];

  if (previousResult) {
    const speedDelta = result.netWpm - previousResult.netWpm;
    const accuracyDelta = result.accuracy - previousResult.accuracy;

    if (speedDelta > 0 && accuracyDelta >= 0) {
      return `This run beat the last matching test by ${formatSignedDelta(speedDelta, "WPM")} while holding accuracy steady.`;
    }

    if (speedDelta < 0 && accuracyDelta > 0) {
      return `You traded speed for control in this run: ${formatSignedDelta(speedDelta, "WPM")} with ${formatSignedDelta(accuracyDelta, "pts")} accuracy.`;
    }
  }

  if (errorCharacter && errorCharacter.mistakeCount > 0) {
    return `Most of the drag came from ${errorCharacter.character}, which carried the heaviest local error pressure in this result.`;
  }

  if (slowCharacter) {
    return `${slowCharacter.character} was the slowest recurring key in this run, so it is a good candidate for a follow-up lesson.`;
  }

  return "This test produced a clean baseline. Repeat it only if you want a direct comparison under the same conditions.";
}

function MetricBlock({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
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

function buildRollingSegments(sessionRecord: SessionRecord) {
  if (sessionRecord.attemptLog.length === 0) {
    return [];
  }

  const segmentCount = Math.min(6, Math.max(3, Math.round(sessionRecord.attemptLog.length / 18)));
  const segmentLabels =
    segmentCount <= 3
      ? ["Start", "Middle", "Finish"]
      : segmentCount === 4
        ? ["Start", "Build", "Settle", "Finish"]
        : segmentCount === 5
          ? ["Start", "Build", "Middle", "Settle", "Finish"]
          : ["Start", "Early", "Middle", "Late", "Settle", "Finish"];
  const totalDuration = sessionRecord.attemptLog.reduce((sum, attempt) => sum + attempt.elapsedMs, 0);
  const segmentSpan = totalDuration / segmentCount;
  const segments = Array.from({ length: segmentCount }, (_, index) => ({
    label: segmentLabels[index] ?? `Part ${index + 1}`,
    durationMs: 0,
    attempts: 0,
    correctAttempts: 0,
  }));
  let elapsedCursor = 0;

  for (const attempt of sessionRecord.attemptLog) {
    const segmentIndex = Math.min(
      segmentCount - 1,
      Math.floor(elapsedCursor / Math.max(segmentSpan, 1)),
    );
    const segment = segments[segmentIndex];
    segment.durationMs += attempt.elapsedMs;
    segment.attempts += 1;
    if (attempt.correct) {
      segment.correctAttempts += 1;
    }
    elapsedCursor += attempt.elapsedMs;
  }

  return segments.map((segment) => ({
    label: segment.label,
    speed:
      segment.durationMs === 0
        ? 0
        : Number(
            (((segment.correctAttempts / 5) * 60_000) / segment.durationMs).toFixed(1),
          ),
    accuracy:
      segment.attempts === 0
        ? 100
        : Number(((segment.correctAttempts / segment.attempts) * 100).toFixed(1)),
  }));
}

function buildLatencyDistribution(sessionRecord: SessionRecord) {
  const bucketEdges = [80, 120, 160, 200, 260, 340];
  const values = sessionRecord.attemptLog.map((attempt) => attempt.elapsedMs);

  return bucketEdges.map((bucketEdge, index) => {
    const previousEdge = index === 0 ? 0 : bucketEdges[index - 1];
    const count = values.filter((value) =>
      index === 0
        ? value <= bucketEdge
        : index === bucketEdges.length - 1
          ? value > previousEdge
          : value > previousEdge && value <= bucketEdge,
    ).length;

    return {
      label:
        index === 0
          ? `≤${bucketEdge}`
          : index === bucketEdges.length - 1
            ? `${previousEdge}+`
            : `${previousEdge}-${bucketEdge}`,
      count,
    };
  });
}

function collectBenchmarkConfusions(sessionRecord: SessionRecord) {
  return Object.values(sessionRecord.perCharacterPerformance)
    .flatMap((characterEntry) =>
      (characterEntry.dominantConfusions ?? []).map((confusionEntry) => ({
        expectedCharacter: characterEntry.character,
        enteredCharacter: confusionEntry.character,
        count: confusionEntry.count,
      })),
    )
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
}

function buildBenchmarkCoachReport(
  result: SessionRecord,
  previousResult: SessionRecord | null,
  matchingBenchmarkHistory: SessionRecord[],
) {
  const slowCharacter = rankCharacters(result.perCharacterPerformance, "slow")[0];
  const errorCharacter = rankCharacters(result.perCharacterPerformance, "errors")[0];
  const confusionPair = collectBenchmarkConfusions(result)[0];
  const rollingSegments = buildRollingSegments(result);
  const openingSegment = rollingSegments[0] ?? null;
  const closingSegment = rollingSegments[rollingSegments.length - 1] ?? null;
  const speedShift =
    openingSegment && closingSegment
      ? Number((closingSegment.speed - openingSegment.speed).toFixed(1))
      : 0;
  const accuracyShift =
    openingSegment && closingSegment
      ? Number((closingSegment.accuracy - openingSegment.accuracy).toFixed(1))
      : 0;
  const speedDelta = previousResult ? result.netWpm - previousResult.netWpm : null;
  const accuracyDelta = previousResult ? result.accuracy - previousResult.accuracy : null;
  const takeaways: string[] = [];
  const nextSteps: string[] = [];

  if (speedDelta !== null && accuracyDelta !== null) {
    if (speedDelta > 0 && accuracyDelta >= 0) {
      takeaways.push(
        `This beat the last matching test by ${formatSignedDelta(speedDelta, "WPM")} without giving back control.`,
      );
    } else if (speedDelta < 0 && accuracyDelta > 0) {
      takeaways.push(
        `You traded ${formatSignedDelta(speedDelta, "WPM")} for ${formatSignedDelta(accuracyDelta, "pts")} accuracy, which is a control-first result rather than a collapse.`,
      );
    }
  }

  if (openingSegment && closingSegment) {
    takeaways.push(
      speedShift < -4
        ? `Pace faded from ${formatRate(openingSegment.speed)} to ${formatRate(closingSegment.speed)} WPM, so endurance or hesitation spikes likely set the ceiling.`
        : speedShift > 4
          ? `You finished ${formatRate(speedShift)} WPM faster than you started, which suggests the run settled in after an uncertain opening.`
          : `Run shape stayed fairly even from start to finish, so the bottleneck is more local than global.`,
    );
  }

  if (confusionPair) {
    takeaways.push(
      `${confusionPair.expectedCharacter} drifted into ${confusionPair.enteredCharacter} ${confusionPair.count} times, which is the clearest confusion pair in this result.`,
    );
    nextSteps.push(
      `Train ${confusionPair.expectedCharacter}/${confusionPair.enteredCharacter} together in adaptive practice before you retest the same preset.`,
    );
  }

  if (errorCharacter && errorCharacter.mistakeCount > 0) {
    takeaways.push(
      `${errorCharacter.character} carried the heaviest local error load with ${errorCharacter.mistakeCount} mistakes.`,
    );
  }

  if (slowCharacter) {
    nextSteps.push(
      `${slowCharacter.character} stayed slow at ${slowCharacter.smoothedResponseMs} ms, so it is the cleanest candidate for the next recovery lesson.`,
    );
  }

  if (result.correctedErrorCount > Math.max(2, result.uncorrectedErrorCount)) {
    nextSteps.push(
      "Use shorter adaptive passages that favor clean transitions over raw pace, because corrected errors are eating into this score before the finish line.",
    );
  } else if (accuracyShift < -1.5) {
    nextSteps.push(
      "Run a follow-up lesson with deliberate punctuation or symbol control, because accuracy slipped late rather than failing evenly.",
    );
  }

  if (nextSteps.length === 0) {
    nextSteps.push(
      "Retest only after one or two adaptive lessons that keep the weakest keys in mixed passages instead of isolated repeats.",
    );
  }

  const percentileRank =
    matchingBenchmarkHistory.length === 0
      ? null
      : Math.round(
          (matchingBenchmarkHistory.filter((sessionRecord) => sessionRecord.netWpm <= result.netWpm).length /
            matchingBenchmarkHistory.length) *
            100,
        );

  return {
    summary: buildResultNarrative(result, previousResult),
    takeaways: takeaways.slice(0, 3),
    nextSteps: nextSteps.slice(0, 3),
    speedShift,
    accuracyShift,
    confusionPairs: collectBenchmarkConfusions(result),
    percentileRank,
  };
}

function buildBenchmarkMetricDistribution(
  sessionRecords: SessionRecord[],
  metric: "speed" | "accuracy",
) {
  const bucketEdges =
    metric === "speed" ? [30, 45, 60, 75, 90, 105] : [92, 95, 97, 98, 99, 100];
  const values = sessionRecords.map((sessionRecord) =>
    metric === "speed" ? sessionRecord.netWpm : sessionRecord.accuracy,
  );

  return bucketEdges.map((bucketEdge, index) => {
    const previousEdge = index === 0 ? 0 : bucketEdges[index - 1];
    const count = values.filter((value) =>
      index === 0
        ? value <= bucketEdge
        : index === bucketEdges.length - 1
          ? value > previousEdge
          : value > previousEdge && value <= bucketEdge,
    ).length;

    return {
      label:
        metric === "speed"
          ? index === 0
            ? `≤${bucketEdge}`
            : index === bucketEdges.length - 1
              ? `${previousEdge}+`
              : `${previousEdge}-${bucketEdge}`
          : index === 0
            ? `≤${bucketEdge}%`
            : index === bucketEdges.length - 1
              ? `${previousEdge}%+`
              : `${previousEdge}-${bucketEdge}%`,
      count,
    };
  });
}

function ReportReplayPreview({ sessionRecord }: { sessionRecord: SessionRecord }) {
  const replayLanguage = getLanguageDefinition(sessionRecord.languageId);
  const [stepIndex, setStepIndex] = useState(sessionRecord.attemptLog.length);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) {
      return;
    }

    const intervalHandle = window.setInterval(() => {
      setStepIndex((currentStepIndex) => {
        if (currentStepIndex >= sessionRecord.attemptLog.length) {
          window.clearInterval(intervalHandle);
          setPlaying(false);
          return currentStepIndex;
        }

        return currentStepIndex + 1;
      });
    }, 50);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [playing, sessionRecord.attemptLog.length]);

  useEffect(() => {
    setStepIndex(sessionRecord.attemptLog.length);
    setPlaying(false);
  }, [sessionRecord.sessionId, sessionRecord.attemptLog.length]);

  const replayAttempts = sessionRecord.attemptLog.slice(0, stepIndex);
  const completedCharacters = replayAttempts.filter((attempt) => attempt.correct).length;
  const elapsedMs = replayAttempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0);
  const accuracy =
    replayAttempts.length === 0
      ? 100
      : Number(
          (
            (replayAttempts.filter((attempt) => attempt.correct).length / replayAttempts.length) *
            100
          ).toFixed(1),
        );
  const replaySpeed =
    elapsedMs === 0
      ? 0
      : Number((((completedCharacters / 5) * 60_000) / elapsedMs).toFixed(1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-textMuted">
          Replay progress {completedCharacters}/{sessionRecord.promptText.length} ·{" "}
          {formatRate(replaySpeed)} WPM · {formatPercent(accuracy)}
        </div>
        <div className="flex gap-2">
          <ActionButton
            tone="secondary"
            onClick={() => {
              setStepIndex(0);
              setPlaying(true);
            }}
          >
            Replay
          </ActionButton>
          <ActionButton tone="ghost" onClick={() => setPlaying((value) => !value)}>
            {playing ? "Pause" : "Play"}
          </ActionButton>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={sessionRecord.attemptLog.length}
        value={stepIndex}
        onChange={(event) => {
          setPlaying(false);
          setStepIndex(Number(event.target.value));
        }}
        className="w-full accent-[hsl(var(--accent))]"
      />
      <div className="border border-borderTone/70 bg-panel/70 px-4 py-4 text-lg leading-9 text-text sm:text-xl">
        <div
          lang={replayLanguage.localeTag}
          dir={replayLanguage.direction}
          data-prompt-render-mode={getPromptRenderMode(replayLanguage.scriptFamily)}
          className={classNames(
            "text-start [unicode-bidi:plaintext] [text-wrap:pretty]",
            replayLanguage.direction === "rtl" && "font-sans leading-[1.8] tracking-[0]",
            replayLanguage.scriptFamily === "hiragana" &&
              "font-sans leading-[1.74] tracking-[0.015em] [line-break:strict] [word-break:keep-all]",
          )}
        >
          <PromptBoardContent
            promptText={sessionRecord.promptText}
            completedCount={completedCharacters}
            whitespaceStyle="none"
            direction={replayLanguage.direction}
            scriptFamily={replayLanguage.scriptFamily}
          />
        </div>
      </div>
    </div>
  );
}

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

    void listSessionRecords().then(setSessionRecords);
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
    onComplete: async (completionPayload) => {
      const scoringOutput = scoreTypingSession({
        promptText: completionPayload.promptText,
        typedText: completionPayload.typedText,
        attemptLog: completionPayload.attemptLog,
        correctedErrorCount: completionPayload.correctedErrorCount,
        startedAt: completionPayload.startedAt,
        endedAt: completionPayload.endedAt,
        masterySpeedGoal: preferences.masterySpeedGoal,
      });

      const sessionRecord: SessionRecord = {
        sessionId: `benchmark-${Date.now()}`,
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
        priorityCharacters: [],
        activeCharacterSet: Array.from(new Set(Array.from(completionPayload.promptText))).slice(0, 64),
        unlockedCharacters: Array.from(new Set(Array.from(languageDefinition.sampleSentence))),
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
      setSessionRecords(nextSessions);
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
    return null;
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
  const recentMatchingBenchmarks = matchingBenchmarkHistory.slice(0, 6);
  const previousMatchingResult =
    reportSession == null
      ? recentMatchingBenchmarks[0] ?? null
      : recentMatchingBenchmarks.find(
          (sessionRecord) => sessionRecord.sessionId !== reportSession.sessionId,
        ) ?? null;
  const coachReport =
    reportSession != null
      ? buildBenchmarkCoachReport(
          reportSession,
          previousMatchingResult,
          matchingBenchmarkHistory,
        )
      : null;
  const reportNarrative =
    coachReport != null
      ? coachReport.summary
      : "Use a fixed preset and source family when you want comparable scores. Move to practice when the report points to weak keys.";
  const slowCharacters =
    reportSession != null ? rankCharacters(reportSession.perCharacterPerformance, "slow") : [];
  const errorCharacters =
    reportSession != null ? rankCharacters(reportSession.perCharacterPerformance, "errors") : [];
  const confusionPairs = reportSession != null ? collectBenchmarkConfusions(reportSession) : [];
  const rollingSegments = reportSession != null ? buildRollingSegments(reportSession) : [];
  const latencyDistribution = reportSession != null ? buildLatencyDistribution(reportSession) : [];
  const speedDistribution =
    reportSession != null
      ? buildBenchmarkMetricDistribution(matchingBenchmarkHistory, "speed")
      : [];
  const accuracyDistribution =
    reportSession != null
      ? buildBenchmarkMetricDistribution(matchingBenchmarkHistory, "accuracy")
      : [];
  const reportLanguage =
    reportSession != null ? getLanguageDefinition(reportSession.languageId) : languageDefinition;
  const localRank =
    reportSession == null
      ? null
      : matchingBenchmarkHistory
          .slice()
          .sort(
            (left, right) =>
              right.netWpm - left.netWpm || right.accuracy - left.accuracy,
          )
          .findIndex((sessionRecord) => sessionRecord.sessionId === reportSession.sessionId) + 1;

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
          <Panel className="space-y-5" data-testid="benchmark-report">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Completion report</p>
                <h2 className="text-2xl font-semibold text-text">Most recent local result</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton tone="secondary" onClick={queueReplayPrompt}>
                  Replay same prompt
                </ActionButton>
                <ActionButton tone="secondary" onClick={queueFreshPrompt}>
                  Next test
                </ActionButton>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-5 py-2 sm:flex-row">
              <MetricBlock label="Speed" value={formatRate(reportSession.netWpm)} unit="WPM" />
              <div className="hidden h-20 border-l border-borderTone/80 sm:block" />
              <MetricBlock label="Accuracy" value={formatPercent(reportSession.accuracy)} unit="%" />
            </div>

            <p className="text-center text-sm leading-6 text-textMuted">{reportNarrative}</p>

            {coachReport ? (
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Run shape</p>
                  <p className="mt-2 text-lg font-semibold text-text">
                    {coachReport.speedShift < -4
                      ? "Faded late"
                      : coachReport.speedShift > 4
                        ? "Finished stronger"
                        : "Stayed even"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-textMuted">
                    {coachReport.takeaways[0] ?? "The run shape is too short to interpret yet."}
                  </p>
                </div>
                <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Likely cause</p>
                  <p className="mt-2 text-lg font-semibold text-text">
                    {coachReport.confusionPairs[0]
                      ? `${coachReport.confusionPairs[0].expectedCharacter}/${coachReport.confusionPairs[0].enteredCharacter}`
                      : errorCharacters[0]?.character ?? "General control"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-textMuted">
                    {coachReport.takeaways[1] ?? coachReport.takeaways[0] ?? "This run did not surface a single dominant bottleneck."}
                  </p>
                </div>
                <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Train next</p>
                  <p className="mt-2 text-lg font-semibold text-text">
                    {coachReport.percentileRank == null ? "Practice first" : `${coachReport.percentileRank}th percentile`}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-textMuted">
                    {coachReport.nextSteps[0]}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCell
                label="Gross speed"
                value={formatRate(reportSession.grossWpm)}
                description="Raw pace before error penalties."
              />
              <SummaryCell
                label="Corrected errors"
                value={String(reportSession.correctedErrorCount)}
                description={`Uncorrected ${reportSession.uncorrectedErrorCount}`}
              />
              <SummaryCell
                label="Duration"
                value={`${reportSession.benchmarkDurationSeconds ?? benchmarkPreset.durationSeconds}s`}
                description={benchmarkContentFamily.label}
              />
              <SummaryCell
                label="Recorded"
                value={formatRelativeSessionDate(reportSession.endedAt)}
                description={preferences.selectedKeyboardLayoutId}
              />
              <SummaryCell
                label="Local rank"
                value={localRank == null ? "n/a" : `#${localRank}`}
                description={`${matchingBenchmarkHistory.length} matching local tests`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DistributionChart
                title="Speed histogram"
                description="This compares the current result against local runs with the same preset and source family."
                buckets={speedDistribution}
              />
              <DistributionChart
                title="Accuracy histogram"
                description="Use this to see whether the result was clean by your own normal standard, not just by one score."
                buckets={accuracyDistribution}
                accentClassName="bg-success"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TrendChart
                title="WPM graph"
                data={rollingSegments.map((segment) => ({
                  label: segment.label,
                  value: segment.speed,
                }))}
              />
              <TrendChart
                title="Accuracy graph"
                data={rollingSegments.map((segment) => ({
                  label: segment.label,
                  value: segment.accuracy,
                }))}
                colorClassName="stroke-success"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
              <DistributionChart
                title="Timing distribution"
                description="This groups per-character timings into rough bands so you can see whether the run stayed smooth or was held back by spikes."
                buckets={latencyDistribution}
                accentClassName="bg-success"
              />
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                  Segment review
                </p>
                <div className="mt-3 space-y-3">
                  {rollingSegments.length === 0 ? (
                    <p className="text-sm text-textMuted">
                      This run was too short to divide into meaningful segments.
                    </p>
                  ) : (
                    rollingSegments.map((segment) => (
                      <div
                        key={segment.label}
                        className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-text">{segment.label}</p>
                          <span className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                            {formatRate(segment.speed)} WPM
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-textMuted">
                          {formatPercent(segment.accuracy)} accuracy
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  <p className="text-sm font-semibold text-text">What changed in this run</p>
                </div>
                <div className="mt-3 space-y-3">
                  {(coachReport?.takeaways ?? []).map((takeaway) => (
                    <div
                      key={takeaway}
                      className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3 text-sm leading-6 text-textMuted"
                    >
                      {takeaway}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  <p className="text-sm font-semibold text-text">Practice recommendation</p>
                </div>
                <div className="mt-3 space-y-3">
                  {(coachReport?.nextSteps ?? []).map((step) => (
                    <div
                      key={step}
                      className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3 text-sm leading-6 text-textMuted"
                    >
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  <p className="text-sm font-semibold text-text">Slowest keys in this run</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {slowCharacters.map((characterEntry) => (
                    <div
                      key={`slow-${characterEntry.character}`}
                      className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3"
                    >
                      <p className="text-lg font-semibold text-text">{characterEntry.character}</p>
                      <p className="text-sm text-textMuted">
                        {characterEntry.smoothedResponseMs} ms · {characterEntry.mistakeCount} mistakes
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  <p className="text-sm font-semibold text-text">Error hotspots</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {errorCharacters.map((characterEntry) => (
                    <div
                      key={`error-${characterEntry.character}`}
                      className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3"
                    >
                      <p className="text-lg font-semibold text-text">{characterEntry.character}</p>
                      <p className="text-sm text-textMuted">
                        {characterEntry.mistakeCount} mistakes · {characterEntry.masteryScore} mastery
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold text-text">Confusion pairs</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {confusionPairs.length === 0 ? (
                  <p className="text-sm text-textMuted">
                    No dominant confusion pair stood out in this result.
                  </p>
                ) : (
                  confusionPairs.map((pair) => (
                    <div
                      key={`${pair.expectedCharacter}-${pair.enteredCharacter}`}
                      className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3"
                    >
                      <p className="text-lg font-semibold text-text">
                        {pair.expectedCharacter} / {pair.enteredCharacter}
                      </p>
                      <p className="text-sm text-textMuted">{pair.count} slips in this run</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                  Matching tests
                </p>
                <div className="mt-3 space-y-3">
                  {recentMatchingBenchmarks.length === 0 ? (
                    <p className="text-sm text-textMuted">No matching history yet.</p>
                  ) : (
                    recentMatchingBenchmarks.map((sessionRecord) => (
                      <div
                        key={sessionRecord.sessionId}
                        className="rounded-xl border border-borderTone/80 bg-panel px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-text">
                            {formatRate(sessionRecord.netWpm)} net WPM
                          </p>
                          <span className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                            {formatRelativeSessionDate(sessionRecord.endedAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-textMuted">
                          {formatPercent(sessionRecord.accuracy)} accuracy
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"
                data-testid="benchmark-review-panel"
              >
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-accent" />
                  <p className="text-sm font-semibold text-text">Replay and review</p>
                </div>
                <div className="mt-3 space-y-4">
                  <ReportReplayPreview sessionRecord={reportSession} />
                  {coachReport?.nextSteps[0] ? (
                    <div className="rounded-xl border border-borderTone/80 bg-panel px-4 py-4 text-sm leading-6 text-textMuted">
                      Replay is best for seeing where the run drifted. Keep an eye on this first:
                      {" "}
                      {coachReport.nextSteps[0]}
                    </div>
                  ) : null}
                  <div className="space-y-2 rounded-xl border border-borderTone/80 bg-panel px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                      Prompt text
                    </p>
                    <p
                      lang={reportLanguage.localeTag}
                      dir={reportLanguage.direction}
                      data-testid="benchmark-prompt-preview"
                      className={classNames(
                        "text-start text-sm leading-7 text-textMuted [unicode-bidi:plaintext] [text-wrap:pretty]",
                        reportLanguage.direction === "rtl" &&
                          "font-sans leading-[1.85] tracking-[0] [word-break:keep-all]",
                        reportLanguage.scriptFamily === "cyrillic" && "tracking-[-0.004em]",
                        reportLanguage.scriptFamily === "hiragana" &&
                          "font-sans leading-[1.74] tracking-[0.015em] [line-break:strict] [word-break:keep-all]",
                      )}
                    >
                      {reportSession.promptText}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
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
