import type { CharacterPerformanceEntry, SessionRecord } from "@/lib/scoring/session-models";
import { formatRate } from "@/lib/utils/formatting";

export function rankBenchmarkCharacters(
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
  const slowCharacter = rankBenchmarkCharacters(result.perCharacterPerformance, "slow")[0];
  const errorCharacter = rankBenchmarkCharacters(result.perCharacterPerformance, "errors")[0];
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

export function buildBenchmarkRollingSegments(sessionRecord: SessionRecord) {
  if (sessionRecord.attemptLog.length === 0) return [];
  const segmentCount = Math.min(6, Math.max(3, Math.round(sessionRecord.attemptLog.length / 18)));
  const segmentLabels = segmentCount <= 3
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
    const segmentIndex = Math.min(segmentCount - 1, Math.floor(elapsedCursor / Math.max(segmentSpan, 1)));
    const segment = segments[segmentIndex];
    segment.durationMs += attempt.elapsedMs;
    segment.attempts += 1;
    if (attempt.correct) segment.correctAttempts += 1;
    elapsedCursor += attempt.elapsedMs;
  }
  return segments.map((segment) => ({
    label: segment.label,
    speed: segment.durationMs === 0 ? 0 : Number((((segment.correctAttempts / 5) * 60_000) / segment.durationMs).toFixed(1)),
    accuracy: segment.attempts === 0 ? 100 : Number(((segment.correctAttempts / segment.attempts) * 100).toFixed(1)),
  }));
}

export function buildBenchmarkLatencyDistribution(sessionRecord: SessionRecord) {
  const bucketEdges = [80, 120, 160, 200, 260, 340];
  const values = sessionRecord.attemptLog.filter((attempt) => attempt.timingValid !== false).map((attempt) => attempt.elapsedMs);
  return bucketEdges.map((bucketEdge, index) => {
    const previousEdge = index === 0 ? 0 : bucketEdges[index - 1];
    const count = values.filter((value) =>
      index === 0 ? value <= bucketEdge : index === bucketEdges.length - 1 ? value > previousEdge : value > previousEdge && value <= bucketEdge,
    ).length;
    return {
      label: index === 0 ? `≤${bucketEdge}` : index === bucketEdges.length - 1 ? `${previousEdge}+` : `${previousEdge}-${bucketEdge}`,
      count,
    };
  });
}

export function collectBenchmarkConfusions(sessionRecord: SessionRecord) {
  return Object.values(sessionRecord.perCharacterPerformance)
    .flatMap((entry) => (entry.dominantConfusions ?? []).map((confusion) => ({
      expectedCharacter: entry.character,
      enteredCharacter: confusion.character,
      count: confusion.count,
    })))
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
}

export function buildBenchmarkCoachReport(
  result: SessionRecord,
  previousResult: SessionRecord | null,
  matchingBenchmarkHistory: SessionRecord[],
) {
  const slowCharacter = rankBenchmarkCharacters(result.perCharacterPerformance, "slow")[0];
  const errorCharacter = rankBenchmarkCharacters(result.perCharacterPerformance, "errors")[0];
  const confusionPair = collectBenchmarkConfusions(result)[0];
  const rollingSegments = buildBenchmarkRollingSegments(result);
  const openingSegment = rollingSegments[0] ?? null;
  const closingSegment = rollingSegments.at(-1) ?? null;
  const speedShift = openingSegment && closingSegment ? Number((closingSegment.speed - openingSegment.speed).toFixed(1)) : 0;
  const accuracyShift = openingSegment && closingSegment ? Number((closingSegment.accuracy - openingSegment.accuracy).toFixed(1)) : 0;
  const speedDelta = previousResult ? result.netWpm - previousResult.netWpm : null;
  const accuracyDelta = previousResult ? result.accuracy - previousResult.accuracy : null;
  const takeaways: string[] = [];
  const nextSteps: string[] = [];

  if (speedDelta !== null && accuracyDelta !== null) {
    if (speedDelta > 0 && accuracyDelta >= 0) takeaways.push(`This beat the last matching test by ${formatSignedDelta(speedDelta, "WPM")} without giving back control.`);
    else if (speedDelta < 0 && accuracyDelta > 0) takeaways.push(`You traded ${formatSignedDelta(speedDelta, "WPM")} for ${formatSignedDelta(accuracyDelta, "pts")} accuracy, which is a control-first result rather than a collapse.`);
  }
  if (openingSegment && closingSegment) {
    takeaways.push(speedShift < -4
      ? `Pace faded from ${formatRate(openingSegment.speed)} to ${formatRate(closingSegment.speed)} WPM, so endurance or hesitation spikes likely set the ceiling.`
      : speedShift > 4
        ? `You finished ${formatRate(speedShift)} WPM faster than you started, which suggests the run settled in after an uncertain opening.`
        : "Run shape stayed fairly even from start to finish, so the bottleneck is more local than global.");
  }
  if (confusionPair) {
    takeaways.push(`${confusionPair.expectedCharacter} drifted into ${confusionPair.enteredCharacter} ${confusionPair.count} times, which is the clearest confusion pair in this result.`);
    nextSteps.push(`Train ${confusionPair.expectedCharacter}/${confusionPair.enteredCharacter} together in adaptive practice before you retest the same preset.`);
  }
  if (errorCharacter && errorCharacter.mistakeCount > 0) takeaways.push(`${errorCharacter.character} carried the heaviest local error load with ${errorCharacter.mistakeCount} mistakes.`);
  if (slowCharacter) nextSteps.push(`${slowCharacter.character} stayed slow at ${slowCharacter.smoothedResponseMs} ms, so it is the cleanest candidate for the next recovery lesson.`);
  if (result.correctedErrorCount > Math.max(2, result.uncorrectedErrorCount)) {
    nextSteps.push("Use shorter adaptive passages that favor clean transitions over raw pace, because corrected errors are eating into this score before the finish line.");
  } else if (accuracyShift < -1.5) {
    nextSteps.push("Run a follow-up lesson with deliberate punctuation or symbol control, because accuracy slipped late rather than failing evenly.");
  }
  if (nextSteps.length === 0) nextSteps.push("Retest only after one or two adaptive lessons that keep the weakest keys in mixed passages instead of isolated repeats.");
  const percentileRank = matchingBenchmarkHistory.length === 0 ? null : Math.round(
    (matchingBenchmarkHistory.filter((session) => session.netWpm <= result.netWpm).length / matchingBenchmarkHistory.length) * 100,
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

export function buildBenchmarkMetricDistribution(sessionRecords: SessionRecord[], metric: "speed" | "accuracy") {
  const bucketEdges = metric === "speed" ? [30, 45, 60, 75, 90, 105] : [92, 95, 97, 98, 99, 100];
  const values = sessionRecords.map((session) => metric === "speed" ? session.netWpm : session.accuracy);
  return bucketEdges.map((bucketEdge, index) => {
    const previousEdge = index === 0 ? 0 : bucketEdges[index - 1];
    const count = values.filter((value) => index === 0 ? value <= bucketEdge : index === bucketEdges.length - 1 ? value > previousEdge : value > previousEdge && value <= bucketEdge).length;
    const label = metric === "accuracy"
      ? index === 0
        ? `≤${bucketEdge}%`
        : index === bucketEdges.length - 1
          ? `${previousEdge}%+`
          : `${previousEdge}-${bucketEdge}%`
      : index === 0
        ? `≤${bucketEdge}`
        : index === bucketEdges.length - 1
          ? `${previousEdge}+`
          : `${previousEdge}-${bucketEdge}`;
    return { label, count };
  });
}
