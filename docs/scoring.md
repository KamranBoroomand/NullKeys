# Scoring And Session Semantics

This document defines the internal scoring rules used by NullKeys. Stored session records keep raw numeric values; UI formatting rounds values only for display.

## Text Model

Typing position is measured in Unicode grapheme clusters through the shared text segmentation helpers in `src/lib/text/language-text-normalization.ts`.

Input is not silently normalized during typing. A composed character and its decomposed equivalent may occupy one prompt position each, but they are only correct when the actual grapheme text matches.

## Session Lifecycle

- A session starts when the first grapheme is committed.
- Restart, skip, prompt change, and route changes finalize an active record as diagnostic history.
- Benchmark focus loss or page hiding immediately finalizes an interrupted, rank-ineligible diagnostic record.
- Adaptive focus loss or page hiding preserves the prompt and typed text, pauses active timing, and resumes when the page is visible and focused. Paused time is excluded from speed and attempt intervals.
- Adaptive learner-model eligibility still requires authoritative attempt timing. If timing cannot be trusted across a pause or an input event, the record is excluded from learner modeling.
- Input events are checked against a monotonic deadline before completion is evaluated. Events before the deadline are eligible; events at or after it are late.
- Completion is finalized only from an integrity-valid, deadline-eligible input event that fills the prompt.
- Finalization is idempotent; repeated completion calls do not create additional records.
- Benchmark timeout saves the current snapshot as incomplete unless the accepted input event filled the prompt first.
- Corrected errors are counted when an incorrect active grapheme is removed before finalization.
- Paste, drop, autofill, replacement, undo/redo, suspicious multi-grapheme insertion, benchmark focus loss, benchmark visibility loss, and unusable event timing make a run ineligible for ranking.

## Eligibility datasets

| Record | Diagnostic history | Ranking | Practice analytics | Learner model |
| --- | --- | --- | --- | --- |
| Completed, integrity-valid benchmark; accepted duration/configuration; current scoring and analytics | Yes | Yes | Yes | No |
| Completed, integrity-valid adaptive session; current scoring and analytics | Yes | No | Yes | Yes only with authoritative attempt timing |
| Interrupted benchmark or adaptive session | Yes | No | No | No |
| Timed-out or incomplete session | Yes | No | No | No |
| Invalid-input or integrity-invalid session | Yes | No | No | No |
| Legacy scoring/analytics record or unusable metrics | Yes | No | No | No |

Accepted benchmark durations are 30, 45, 60, and 120 seconds. Ranking also requires at least 10 seconds of active duration or at least 80 non-whitespace grapheme clusters in the prompt. Local board positions are computed only within an exact match of duration, language, keyboard family and layout, input mode, session flavor, content family, and programmer preset. Higher net WPM ranks first; accuracy is the tie-break, followed by session identifier for deterministic display.

Scoring and analytics schemas are versioned. Older records remain visible in diagnostic history but do not silently enter current rankings or aggregates.

## Metrics

- Active elapsed time is monotonic session time minus adaptive pause intervals, clamped to at least 1 ms for metric calculation.
- `pausedDurationMs` records excluded adaptive pause time; benchmark interruptions do not create pause intervals.
- Gross WPM is `typedGraphemeCount / 5 / elapsedMinutes`.
- Uncorrected errors are final mismatched graphemes plus final extra graphemes beyond the prompt.
- Net WPM is `(typedGraphemeCount - uncorrectedErrorCount) / 5 / elapsedMinutes`, clamped at zero.
- Character accuracy is `correctFinalGraphemes / typedGraphemeCount * 100`.
- Empty typed text reports 100% accuracy and 0 WPM.
- Percentages are clamped to the inclusive range 0-100.
- Metrics never store `NaN`, `Infinity`, negative elapsed time, or negative speed.

Word accuracy is not stored in `v1.0.0`; the product reports character-level accuracy and per-character performance.
