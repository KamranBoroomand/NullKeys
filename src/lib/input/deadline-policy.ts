export const DEADLINE_TIE_POLICY = "deadline-exclusive" as const;

export interface MonotonicSample {
  monotonicMs: number;
  wallClockMs: number;
}

export interface NormalizedEventTimestamp {
  monotonicMs: number;
  clockAnomalyDetected: boolean;
}

export function readMonotonicSample(): MonotonicSample {
  return {
    monotonicMs:
      typeof performance === "undefined" ? Date.now() : performance.now(),
    wallClockMs: Date.now(),
  };
}

export function normalizeEventTimestamp(
  eventTimestampMs: number | undefined,
  sample = readMonotonicSample(),
): NormalizedEventTimestamp {
  if (!Number.isFinite(eventTimestampMs)) {
    return {
      monotonicMs: sample.monotonicMs,
      clockAnomalyDetected: eventTimestampMs !== undefined,
    };
  }

  const timestamp = Number(eventTimestampMs);
  const monotonicDistance = Math.abs(timestamp - sample.monotonicMs);

  if (timestamp >= 0 && monotonicDistance <= 24 * 60 * 60 * 1000) {
    return { monotonicMs: timestamp, clockAnomalyDetected: false };
  }

  const wallClockDistance = Math.abs(timestamp - sample.wallClockMs);

  if (wallClockDistance <= 24 * 60 * 60 * 1000) {
    return {
      monotonicMs: sample.monotonicMs - (sample.wallClockMs - timestamp),
      clockAnomalyDetected: false,
    };
  }

  return {
    monotonicMs: sample.monotonicMs,
    clockAnomalyDetected: true,
  };
}

export function buildSessionDeadline(startedMonotonicMs: number, durationSeconds: number) {
  return startedMonotonicMs + durationSeconds * 1000;
}

export function isInputEventEligible(eventMonotonicMs: number, deadlineMonotonicMs: number) {
  return eventMonotonicMs < deadlineMonotonicMs;
}

export function elapsedMonotonicMs(startedMonotonicMs: number, endedMonotonicMs: number) {
  return Math.max(0, endedMonotonicMs - startedMonotonicMs);
}
