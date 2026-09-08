import { findKeyMetadataForCharacter } from "@/features/keyboard-visualizer/keyboard-layout-registry";
import type {
  CharacterPerformanceEntry,
  LearnerProgressProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";

function isSameDay(leftDate: Date, rightDate: Date) {
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function toLocalDayKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function buildTrendSeries(sessionRecords: SessionRecord[]) {
  return sessionRecords
    .slice()
    .sort(
      (left, right) =>
        new Date(left.endedAt).getTime() - new Date(right.endedAt).getTime(),
    )
    .map((sessionRecord) => ({
      label: sessionRecord.endedAt,
      speed: Number(sessionRecord.netWpm.toFixed(1)),
      accuracy: Number(sessionRecord.accuracy.toFixed(1)),
    }));
}

export function buildOverviewStats(sessionRecords: SessionRecord[]) {
  const now = new Date();
  const allTimeSessions = sessionRecords.length;
  const adaptiveSessions = sessionRecords.filter((sessionRecord) => sessionRecord.sessionKind === "adaptive");
  const benchmarkSessions = sessionRecords.filter((sessionRecord) => sessionRecord.sessionKind === "benchmark");
  const todaySessions = sessionRecords.filter((sessionRecord) =>
    isSameDay(new Date(sessionRecord.endedAt), now),
  );
  const averageNetWpm =
    allTimeSessions === 0
      ? 0
      : sessionRecords.reduce((sum, sessionRecord) => sum + sessionRecord.netWpm, 0) / allTimeSessions;
  const averageAccuracy =
    allTimeSessions === 0
      ? 100
      : sessionRecords.reduce((sum, sessionRecord) => sum + sessionRecord.accuracy, 0) / allTimeSessions;
  const todayNetWpm =
    todaySessions.length === 0
      ? 0
      : todaySessions.reduce((sum, sessionRecord) => sum + sessionRecord.netWpm, 0) / todaySessions.length;
  const todayAccuracy =
    todaySessions.length === 0
      ? 100
      : todaySessions.reduce((sum, sessionRecord) => sum + sessionRecord.accuracy, 0) / todaySessions.length;
  const activeDays = Array.from(
    new Set(
      sessionRecords.map((sessionRecord) => toLocalDayKey(new Date(sessionRecord.endedAt))),
    ),
  ).sort((left, right) => left.localeCompare(right));
  let currentStreak = 0;
  let streakAnchor = new Date(now);

  while (activeDays.includes(toLocalDayKey(streakAnchor))) {
    currentStreak += 1;
    streakAnchor.setDate(streakAnchor.getDate() - 1);
  }

  return {
    allTimeSessions,
    adaptiveSessions: adaptiveSessions.length,
    benchmarkSessions: benchmarkSessions.length,
    allTimeMinutes: Math.round(
      sessionRecords.reduce((sum, sessionRecord) => sum + sessionRecord.durationMs, 0) / 60_000,
    ),
    averageNetWpm: Number(averageNetWpm.toFixed(1)),
    averageAccuracy: Number(averageAccuracy.toFixed(1)),
    todaySessions: todaySessions.length,
    todayMinutes: Math.round(
      todaySessions.reduce((sum, sessionRecord) => sum + sessionRecord.durationMs, 0) / 60_000,
    ),
    todayNetWpm: Number(todayNetWpm.toFixed(1)),
    todayAccuracy: Number(todayAccuracy.toFixed(1)),
    currentStreak,
  };
}

export function buildBreakdown(
  sessionRecords: SessionRecord[],
  pickValue: (sessionRecord: SessionRecord) => string,
) {
  const counts = new Map<string, number>();

  for (const sessionRecord of sessionRecords) {
    const value = pickValue(sessionRecord);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

function mergeCharacterPerformance(
  accumulator: Record<string, CharacterPerformanceEntry>,
  nextMap: Record<string, CharacterPerformanceEntry>,
) {
  for (const [character, nextEntry] of Object.entries(nextMap)) {
    const existingEntry = accumulator[character];

    if (!existingEntry) {
      accumulator[character] = { ...nextEntry };
      continue;
    }

    accumulator[character] = {
      character,
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
        new Date(existingEntry.lastSeenAt).getTime() >
        new Date(nextEntry.lastSeenAt).getTime()
          ? existingEntry.lastSeenAt
          : nextEntry.lastSeenAt,
    };
  }

  return accumulator;
}

function buildAggregatedCharacterPerformance(sessionRecords: SessionRecord[]) {
  return sessionRecords.reduce<Record<string, CharacterPerformanceEntry>>(
    (accumulator, sessionRecord) =>
      mergeCharacterPerformance(accumulator, sessionRecord.perCharacterPerformance),
    {},
  );
}

export function buildCharacterPanels(sessionRecords: SessionRecord[]) {
  const aggregatedPerformance = buildAggregatedCharacterPerformance(sessionRecords);
  const sortedCharacters = Object.values(aggregatedPerformance).sort(
    (left, right) =>
      left.masteryScore - right.masteryScore ||
      right.mistakeCount - left.mistakeCount ||
      right.smoothedResponseMs - left.smoothedResponseMs,
  );
  const recentSessions = sessionRecords.slice(0, 8);
  const olderSessions = sessionRecords.slice(8, 24);
  const recentPerformance = recentSessions.reduce<Record<string, CharacterPerformanceEntry>>(
    (accumulator, sessionRecord) =>
      mergeCharacterPerformance(accumulator, sessionRecord.perCharacterPerformance),
    {},
  );
  const olderPerformance = olderSessions.reduce<Record<string, CharacterPerformanceEntry>>(
    (accumulator, sessionRecord) =>
      mergeCharacterPerformance(accumulator, sessionRecord.perCharacterPerformance),
    {},
  );

  const improvedCharacters = Object.keys(recentPerformance)
    .map((character) => ({
      character,
      delta:
        recentPerformance[character].masteryScore -
        (olderPerformance[character]?.masteryScore ?? 0),
    }))
    .sort((left, right) => right.delta - left.delta)
    .slice(0, 8);

  const regressingCharacters = Object.keys(recentPerformance)
    .map((character) => ({
      character,
      delta:
        recentPerformance[character].masteryScore -
        (olderPerformance[character]?.masteryScore ?? recentPerformance[character].masteryScore),
      responseDelta:
        recentPerformance[character].smoothedResponseMs -
        (olderPerformance[character]?.smoothedResponseMs ??
          recentPerformance[character].smoothedResponseMs),
    }))
    .sort((left, right) => left.delta - right.delta || right.responseDelta - left.responseDelta)
    .slice(0, 8);

  return {
    weakCharacters: sortedCharacters.slice(0, 12),
    improvedCharacters,
    slowCharacters: sortedCharacters
      .slice()
      .sort((left, right) => right.smoothedResponseMs - left.smoothedResponseMs)
      .slice(0, 8),
    regressingCharacters,
  };
}

export function buildMetricDistribution(
  sessionRecords: SessionRecord[],
  metric: "speed" | "accuracy",
) {
  const bucketEdges =
    metric === "speed" ? [20, 40, 60, 80, 100, 120] : [85, 90, 94, 97, 99, 100];
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
        index === 0
          ? `≤${bucketEdge}`
          : index === bucketEdges.length - 1
            ? `${previousEdge}+`
            : `${previousEdge}-${bucketEdge}`,
      count,
    };
  });
}

export function buildCharacterHeatGrid(sessionRecords: SessionRecord[]) {
  return buildCharacterPanels(sessionRecords).weakCharacters.slice(0, 24).map((characterEntry) => ({
    label: characterEntry.character,
    value: characterEntry.mistakeCount * 18 + characterEntry.smoothedResponseMs / 4,
    hint: `${characterEntry.masteryScore} mastery · ${characterEntry.mistakeCount} mistakes · ${characterEntry.smoothedResponseMs} ms`,
  }));
}

export function buildCharacterMetricDistribution(
  sessionRecords: SessionRecord[],
  metric: "speed" | "frequency",
) {
  const aggregatedCharacters = Object.values(buildAggregatedCharacterPerformance(sessionRecords));
  const values = aggregatedCharacters.map((characterEntry) =>
    metric === "speed"
      ? Number((12000 / Math.max(characterEntry.smoothedResponseMs, 1)).toFixed(1))
      : characterEntry.attemptCount,
  );
  const bucketEdges =
    metric === "speed" ? [40, 60, 80, 100, 120, 140] : [10, 20, 30, 45, 60, 90];

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

export function buildKeyboardHeatmap(
  sessionRecords: SessionRecord[],
  layoutId: string,
  languageId?: string,
  metric: "frequency" | "speed" = "frequency",
) {
  const aggregatedPerformance = Object.values(buildAggregatedCharacterPerformance(sessionRecords));
  const keyValues = new Map<string, number>();

  for (const characterEntry of aggregatedPerformance) {
    const keyMetadata = findKeyMetadataForCharacter(layoutId, characterEntry.character, languageId);

    if (!keyMetadata) {
      continue;
    }

    const nextValue =
      metric === "frequency"
        ? characterEntry.attemptCount
        : Number((12000 / Math.max(characterEntry.smoothedResponseMs, 1)).toFixed(1));

    keyValues.set(
      keyMetadata.code,
      (keyValues.get(keyMetadata.code) ?? 0) + nextValue,
    );
  }

  return Object.fromEntries(keyValues.entries());
}

export function buildCharacterBreakdown(
  sessionRecords: SessionRecord[],
  metric: "frequency" | "speed",
) {
  return Object.values(buildAggregatedCharacterPerformance(sessionRecords))
    .sort((left, right) =>
      metric === "frequency"
        ? right.attemptCount - left.attemptCount
        : right.smoothedResponseMs - left.smoothedResponseMs,
    )
    .slice(0, 10)
    .map((characterEntry) => ({
      label: characterEntry.character,
      count:
        metric === "frequency"
          ? characterEntry.attemptCount
          : characterEntry.smoothedResponseMs,
    }));
}

export function buildAccuracyStreaks(sessionRecords: SessionRecord[]) {
  const orderedSessions = sessionRecords
    .slice()
    .sort(
      (left, right) =>
        new Date(left.endedAt).getTime() - new Date(right.endedAt).getTime(),
    );

  const thresholds = [99, 97, 95];

  return thresholds.map((threshold) => {
    let best = 0;
    let current = 0;

    for (const sessionRecord of orderedSessions) {
      if (sessionRecord.accuracy >= threshold) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }

    return {
      threshold,
      best,
      current,
    };
  });
}

export function buildCalendarActivity(sessionRecords: SessionRecord[], days = 28) {
  return Array.from({ length: days }, (_, index) => {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - (days - index - 1));
    const matchingSessions = sessionRecords.filter((sessionRecord) =>
      isSameDay(new Date(sessionRecord.endedAt), currentDate),
    );

    return {
      label: `${currentDate.getMonth() + 1}/${currentDate.getDate()}`,
      sessionCount: matchingSessions.length,
      totalMinutes: Math.round(
        matchingSessions.reduce((sum, sessionRecord) => sum + sessionRecord.durationMs, 0) /
          60_000,
      ),
    };
  });
}

export function summarizeSessionFamilies(sessionRecords: SessionRecord[]) {
  return {
    recentSessions: sessionRecords.slice(0, 10),
    adaptiveSessions: sessionRecords.filter((sessionRecord) => sessionRecord.sessionKind === "adaptive"),
    benchmarkSessions: sessionRecords.filter((sessionRecord) => sessionRecord.sessionKind === "benchmark"),
    programmerSessions: sessionRecords.filter(
      (sessionRecord) => sessionRecord.programmerDrillPresetId !== undefined,
    ),
  };
}

function buildAverageComparison(
  sessionRecords: SessionRecord[],
  pickLabel: (sessionRecord: SessionRecord) => string,
) {
  const groupedSessions = new Map<
    string,
    { count: number; netWpmSum: number; accuracySum: number }
  >();

  for (const sessionRecord of sessionRecords) {
    const label = pickLabel(sessionRecord);
    const existingGroup =
      groupedSessions.get(label) ?? { count: 0, netWpmSum: 0, accuracySum: 0 };

    groupedSessions.set(label, {
      count: existingGroup.count + 1,
      netWpmSum: existingGroup.netWpmSum + sessionRecord.netWpm,
      accuracySum: existingGroup.accuracySum + sessionRecord.accuracy,
    });
  }

  return Array.from(groupedSessions.entries())
    .map(([label, group]) => ({
      label,
      count: group.count,
      averageNetWpm: Number((group.netWpmSum / group.count).toFixed(1)),
      averageAccuracy: Number((group.accuracySum / group.count).toFixed(1)),
    }))
    .sort((left, right) => right.averageNetWpm - left.averageNetWpm);
}

function buildConsistencyScore(sessionRecords: SessionRecord[]) {
  const recentSessions = sessionRecords
    .slice()
    .sort(
      (left, right) =>
        new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime(),
    )
    .slice(0, 8);

  if (recentSessions.length < 2) {
    return 100;
  }

  const averageNetWpm =
    recentSessions.reduce((sum, sessionRecord) => sum + sessionRecord.netWpm, 0) /
    recentSessions.length;
  const averageDrift =
    recentSessions.reduce(
      (sum, sessionRecord) => sum + Math.abs(sessionRecord.netWpm - averageNetWpm),
      0,
    ) / recentSessions.length;

  return Math.max(0, Math.round(100 - averageDrift * 2));
}

export function buildZonePerformance(sessionRecords: SessionRecord[]) {
  const zoneAccumulator = new Map<
    string,
    {
      attempts: number;
      mistakes: number;
      responseSum: number;
      masterySum: number;
      samples: number;
    }
  >();

  for (const sessionRecord of sessionRecords) {
    for (const [character, performanceEntry] of Object.entries(
      sessionRecord.perCharacterPerformance,
    )) {
      const keyMetadata = findKeyMetadataForCharacter(
        sessionRecord.keyboardLayoutId,
        character,
        sessionRecord.languageId,
      );

      if (!keyMetadata) {
        continue;
      }

      const existingZone =
        zoneAccumulator.get(keyMetadata.rowZone) ??
        {
          attempts: 0,
          mistakes: 0,
          responseSum: 0,
          masterySum: 0,
          samples: 0,
        };

      zoneAccumulator.set(keyMetadata.rowZone, {
        attempts: existingZone.attempts + performanceEntry.attemptCount,
        mistakes: existingZone.mistakes + performanceEntry.mistakeCount,
        responseSum:
          existingZone.responseSum +
          performanceEntry.smoothedResponseMs * performanceEntry.attemptCount,
        masterySum: existingZone.masterySum + performanceEntry.masteryScore,
        samples: existingZone.samples + 1,
      });
    }
  }

  return Array.from(zoneAccumulator.entries())
    .map(([label, zone]) => ({
      label,
      attempts: zone.attempts,
      mistakeCount: zone.mistakes,
      averageResponseMs:
        zone.attempts === 0 ? 0 : Number((zone.responseSum / zone.attempts).toFixed(1)),
      averageMastery:
        zone.samples === 0 ? 0 : Number((zone.masterySum / zone.samples).toFixed(1)),
    }))
    .sort((left, right) => right.mistakeCount - left.mistakeCount);
}

function buildRegressionAlerts(sessionRecords: SessionRecord[]) {
  const characterPanels = buildCharacterPanels(sessionRecords);
  const alerts = characterPanels.regressingCharacters
    .filter((characterDelta) => characterDelta.delta < 0 || characterDelta.responseDelta > 0)
    .slice(0, 4)
    .map(
      (characterDelta) =>
        `${characterDelta.character} slipped ${Math.abs(characterDelta.delta)} mastery with ${Math.max(
          0,
          characterDelta.responseDelta,
        )} ms slower timing.`,
    );

  return alerts;
}

function formatCharacterList(characters: string[]) {
  if (characters.length === 0) {
    return "";
  }

  if (characters.length === 1) {
    return characters[0];
  }

  return `${characters.slice(0, -1).join(", ")} and ${characters[characters.length - 1]}`;
}

export function buildComparisonSummary(sessionRecords: SessionRecord[]) {
  const languageComparisons = buildAverageComparison(
    sessionRecords,
    (sessionRecord) => sessionRecord.languageId,
  ).slice(0, 6);
  const layoutComparisons = buildAverageComparison(
    sessionRecords,
    (sessionRecord) => sessionRecord.keyboardLayoutId,
  ).slice(0, 6);
  const inputModeComparisons = buildAverageComparison(
    sessionRecords,
    (sessionRecord) => sessionRecord.inputMode,
  );
  const modeComparisons = buildAverageComparison(
    sessionRecords,
    (sessionRecord) => sessionRecord.sessionKind,
  );
  const contentFamilyComparisons = buildAverageComparison(
    sessionRecords,
    (sessionRecord) => sessionRecord.contentFamilyId ?? sessionRecord.sessionFlavor,
  );
  const bestBenchmarks = sessionRecords
    .filter((sessionRecord) => sessionRecord.sessionKind === "benchmark")
    .slice()
    .sort((left, right) => right.netWpm - left.netWpm)
    .slice(0, 5);
  const adaptiveAverage =
    modeComparisons.find((modeComparison) => modeComparison.label === "adaptive") ?? null;
  const benchmarkAverage =
    modeComparisons.find((modeComparison) => modeComparison.label === "benchmark") ?? null;

  return {
    languageComparisons,
    layoutComparisons,
    inputModeComparisons,
    modeComparisons,
    contentFamilyComparisons,
    bestBenchmarks,
    consistencyScore: buildConsistencyScore(sessionRecords),
    zonePerformance: buildZonePerformance(sessionRecords),
    regressionAlerts: buildRegressionAlerts(sessionRecords),
    benchmarkVsAdaptiveDelta:
      adaptiveAverage && benchmarkAverage
        ? {
            netWpmDelta: Number(
              (benchmarkAverage.averageNetWpm - adaptiveAverage.averageNetWpm).toFixed(1),
            ),
            accuracyDelta: Number(
              (benchmarkAverage.averageAccuracy - adaptiveAverage.averageAccuracy).toFixed(1),
            ),
          }
        : null,
  };
}

export function buildProgressCoachReport(options: {
  sessionRecords: SessionRecord[];
  learnerProgressProfile?: LearnerProgressProfile | null;
}) {
  const overviewStats = buildOverviewStats(options.sessionRecords);
  const characterPanels = buildCharacterPanels(options.sessionRecords);
  const comparisonSummary = buildComparisonSummary(options.sessionRecords);
  const recentSessions = options.sessionRecords.slice(0, 8);
  const olderSessions = options.sessionRecords.slice(8, 24);
  const recentAverageNetWpm =
    recentSessions.length === 0
      ? 0
      : recentSessions.reduce((sum, sessionRecord) => sum + sessionRecord.netWpm, 0) /
        recentSessions.length;
  const olderAverageNetWpm =
    olderSessions.length === 0
      ? recentAverageNetWpm
      : olderSessions.reduce((sum, sessionRecord) => sum + sessionRecord.netWpm, 0) /
        olderSessions.length;
  const recentAverageAccuracy =
    recentSessions.length === 0
      ? 100
      : recentSessions.reduce((sum, sessionRecord) => sum + sessionRecord.accuracy, 0) /
        recentSessions.length;
  const olderAverageAccuracy =
    olderSessions.length === 0
      ? recentAverageAccuracy
      : olderSessions.reduce((sum, sessionRecord) => sum + sessionRecord.accuracy, 0) /
        olderSessions.length;
  const speedDelta = Number((recentAverageNetWpm - olderAverageNetWpm).toFixed(1));
  const accuracyDelta = Number((recentAverageAccuracy - olderAverageAccuracy).toFixed(1));
  const learnerProfile = options.learnerProgressProfile ?? null;
  const movementCauses: string[] = [];

  if (speedDelta > 2 && accuracyDelta >= 0) {
    movementCauses.push(
      `Recent speed is up ${speedDelta.toFixed(1)} WPM without losing control, so the last block of sessions looks like genuine fluency rather than risky pacing.`,
    );
  } else if (speedDelta < -2 && accuracyDelta > 0.5) {
    movementCauses.push(
      `Recent speed is down ${Math.abs(speedDelta).toFixed(1)} WPM while accuracy climbed ${accuracyDelta.toFixed(1)} points, which usually means you are consolidating control instead of regressing.`,
    );
  } else if (speedDelta < -2 || accuracyDelta < -0.8) {
    movementCauses.push(
      `The recent window is softer than the previous block, so the slowdown is broad enough to treat as a real drift rather than a single weak session.`,
    );
  } else {
    movementCauses.push(
      "Recent speed and accuracy are fairly close to the previous block, which means your current changes are local to certain keys more than the whole profile.",
    );
  }

  if (learnerProfile?.forgottenCharacters?.length) {
    movementCauses.push(
      `Older weak keys like ${formatCharacterList(learnerProfile.forgottenCharacters.slice(0, 3))} have resurfaced, so part of the variance is a healthy forgetting-and-recovery cycle.`,
    );
  }

  if (learnerProfile?.hesitationCharacters?.length) {
    movementCauses.push(
      `Hesitation is concentrating on ${formatCharacterList(learnerProfile.hesitationCharacters.slice(0, 3))}, which usually shows up as smooth accuracy with a lower WPM ceiling.`,
    );
  }

  const strongestImprovements =
    characterPanels.improvedCharacters.length === 0
      ? ["More history is needed before the profile can separate durable gains from noise."]
      : characterPanels.improvedCharacters.slice(0, 3).map((characterEntry) => {
          const characterProfile = learnerProfile?.characterProfiles?.[characterEntry.character];
          return characterProfile
            ? `${characterEntry.character} gained ${characterEntry.delta} mastery and now sits at ${characterProfile.memoryStrength} memory strength with ${characterProfile.stabilityScore} stability.`
            : `${characterEntry.character} gained ${characterEntry.delta} mastery across the recent block.`;
        });
  const regressionCauses =
    learnerProfile?.forgottenCharacters?.length || learnerProfile?.shakyCharacters?.length
      ? uniqueByText([
          ...(learnerProfile?.forgottenCharacters ?? []).slice(0, 3).map((character) => {
            const characterProfile = learnerProfile.characterProfiles?.[character];
            return `${character} is resurfacing after a gap and is only at ${characterProfile?.memoryStrength ?? 0} memory strength right now.`;
          }),
          ...(learnerProfile?.shakyCharacters ?? []).slice(0, 3).map((character) => {
            const characterProfile = learnerProfile.characterProfiles?.[character];
            return `${character} is still shaky with ${Math.round((characterProfile?.recentAccuracy ?? 0) * 100)}% recent accuracy and ${characterProfile?.recentResponseMs ?? 0} ms timing.`;
          }),
        ])
      : comparisonSummary.regressionAlerts.length > 0
        ? comparisonSummary.regressionAlerts
        : ["No major regression cause stands out beyond the normal weak-key queue."];
  const trainingPriorityCharacters = uniqueByCharacter([
    ...(learnerProfile?.forgottenCharacters ?? []),
    ...(learnerProfile?.shakyCharacters ?? []),
    ...(learnerProfile?.hesitationCharacters ?? []),
    ...(learnerProfile?.scheduledReviewCharacters ?? []),
    ...characterPanels.weakCharacters.map((characterEntry) => characterEntry.character),
  ]).slice(0, 5);
  const trainingPriorities = trainingPriorityCharacters.map((character) => {
    const characterProfile = learnerProfile?.characterProfiles?.[character];

    if (!characterProfile) {
      const panelEntry = characterPanels.weakCharacters.find(
        (characterEntry) => characterEntry.character === character,
      );
      return {
        character,
        title: `${character} needs recovery`,
        detail: panelEntry
          ? `${panelEntry.mistakeCount} mistakes and ${panelEntry.smoothedResponseMs} ms timing make it a real bottleneck, not just a rare outlier.`
          : "This key keeps reappearing in the weak-key queue.",
      };
    }

    if (characterProfile.state === "forgotten") {
      return {
        character,
        title: `${character} should resurface`,
        detail: `It went quiet long enough to fade and is now due with ${characterProfile.dueScore.toFixed(1)} review pressure.`,
      };
    }

    if (characterProfile.state === "shaky") {
      return {
        character,
        title: `${character} is still shaky`,
        detail: `${Math.round(characterProfile.recentAccuracy * 100)}% recent accuracy and ${characterProfile.recentResponseMs} ms timing suggest a control issue rather than lack of exposure alone.`,
      };
    }

    if ((learnerProfile?.hesitationCharacters ?? []).includes(character)) {
      return {
        character,
        title: `${character} is mostly a speed drag`,
        detail: `It is more hesitant than incorrect, so the next lesson should keep it in mixed passages instead of isolated error loops.`,
      };
    }

    return {
      character,
      title: `${character} is due for review`,
      detail: `It is stable enough to keep, but spaced review is needed so it does not slide into the forgotten queue.`,
    };
  });
  const perKeyNarratives = trainingPriorities.concat(
    characterPanels.improvedCharacters.slice(0, 2).map((characterEntry) => ({
      character: characterEntry.character,
      title: `${characterEntry.character} is a recent gain`,
      detail: `It moved ${characterEntry.delta} mastery points in the last local block, so it is a strong anchor for transition drills.`,
    })),
  ).slice(0, 6);

  return {
    movementCauses: movementCauses.slice(0, 3),
    strongestImprovements: strongestImprovements.slice(0, 3),
    regressionCauses: regressionCauses.slice(0, 3),
    trainingPriorities,
    perKeyNarratives,
    groupingNotes: [
      `Today vs all time: ${overviewStats.todaySessions} sessions today against ${overviewStats.allTimeSessions} saved overall, so read today's numbers as a rhythm check and the all-time numbers as your baseline.`,
      comparisonSummary.benchmarkVsAdaptiveDelta
        ? `By mode: typing tests are ${Math.abs(comparisonSummary.benchmarkVsAdaptiveDelta.netWpmDelta).toFixed(1)} WPM ${comparisonSummary.benchmarkVsAdaptiveDelta.netWpmDelta >= 0 ? "faster" : "slower"} than adaptive practice right now.`
        : "By mode: add both adaptive and typing-test history if you want the profile to explain the gap between coached practice and fixed tests.",
      `Current focus: ${trainingPriorities[0]?.title ?? "build more history"}${trainingPriorities[0]?.detail ? `; ${trainingPriorities[0].detail}` : ""}`,
    ],
  };
}

function uniqueByCharacter(characters: string[]) {
  return Array.from(new Set(characters.filter(Boolean)));
}

function uniqueByText(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}
