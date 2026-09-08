import {
  DEADLINE_TIE_POLICY,
  buildSessionDeadline,
  elapsedMonotonicMs,
  isInputEventEligible,
  normalizeEventTimestamp,
} from "@/lib/input/deadline-policy";

describe("typing deadline policy", () => {
  it("uses an exclusive deadline with deterministic before, tie, and after behavior", () => {
    const deadline = buildSessionDeadline(2_000, 1);

    expect(DEADLINE_TIE_POLICY).toBe("deadline-exclusive");
    expect(isInputEventEligible(2_999.999, deadline)).toBe(true);
    expect(isInputEventEligible(3_000, deadline)).toBe(false);
    expect(isInputEventEligible(3_000.001, deadline)).toBe(false);
  });

  it("normalizes epoch-based browser timestamps onto the monotonic timeline", () => {
    expect(
      normalizeEventTimestamp(1_700_000_000_250, {
        monotonicMs: 5_000,
        wallClockMs: 1_700_000_000_500,
      }),
    ).toEqual({ monotonicMs: 4_750, clockAnomalyDetected: false });
  });

  it("marks unusable timestamps as anomalous without trusting wall-clock jumps", () => {
    expect(
      normalizeEventTimestamp(-9_000_000_000, {
        monotonicMs: 5_000,
        wallClockMs: 1_700_000_000_500,
      }),
    ).toEqual({ monotonicMs: 5_000, clockAnomalyDetected: true });
    expect(elapsedMonotonicMs(5_000, 4_000)).toBe(0);
  });
});
