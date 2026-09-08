import type { SessionFlavor } from "@/lib/scoring/session-models";

export interface BenchmarkPreset {
  id: string;
  label: string;
  description: string;
  sessionFlavor: SessionFlavor;
  durationSeconds: number;
}

export const benchmarkPresets: BenchmarkPreset[] = [
  {
    id: "sprint-30",
    label: "30s Sprint",
    description: "Short-form pacing for quick checks and rapid warmups.",
    sessionFlavor: "mixed",
    durationSeconds: 30,
  },
  {
    id: "focus-45",
    label: "45s Focus",
    description: "A practical middle ground for repeated comparison runs.",
    sessionFlavor: "mixed",
    durationSeconds: 45,
  },
  {
    id: "classic-60",
    label: "60s Classic",
    description: "The standard benchmark window for balanced speed and control.",
    sessionFlavor: "mixed",
    durationSeconds: 60,
  },
  {
    id: "endurance-120",
    label: "120s Endurance",
    description: "Longer passages for consistency, fatigue, and rhythm retention.",
    sessionFlavor: "plain",
    durationSeconds: 120,
  },
  {
    id: "mobile-45",
    label: "45s Mobile",
    description: "Shorter benchmark pacing for touchscreen and virtual-keyboard sessions.",
    sessionFlavor: "plain",
    durationSeconds: 45,
  },
];

export function getBenchmarkPreset(presetId: string) {
  return benchmarkPresets.find((preset) => preset.id === presetId) ?? benchmarkPresets[2];
}
