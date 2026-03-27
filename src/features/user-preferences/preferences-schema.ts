import type { BodyFontChoice, MonoFontChoice } from "@/features/user-preferences/font-registry";
import type { ThemeChoice } from "@/features/user-preferences/theme-registry";

export type { BodyFontChoice, MonoFontChoice } from "@/features/user-preferences/font-registry";
export type { ThemeChoice } from "@/features/user-preferences/theme-registry";

export type DevicePreference = "desktop" | "mobile" | "hybrid";
export type ActiveCharacterRange = "core" | "extended" | "full";
export type ContentSourceBias = "real" | "synthetic" | "mixed";
export type ProgressionPace = "measured" | "balanced" | "accelerated";
export type PracticePresentationMode = "full" | "compact" | "minimal";
export type WhitespaceStyle = "none" | "bar" | "bullet";
export type PreferredContentFamilyId =
  | "adaptive-blend"
  | "common-words"
  | "pseudo-words"
  | "phrase-drills"
  | "quote-drills"
  | "symbol-drills"
  | "number-drills"
  | "code-drills"
  | "shell-drills";

export interface PracticePreferences {
  schemaVersion: number;
  onboardingComplete: boolean;
  selectedLanguageId: string;
  selectedKeyboardFamilyId: string;
  selectedKeyboardLayoutId: string;
  devicePreference: DevicePreference;
  lessonSpanSeconds: number;
  passageWordGoal: number;
  masterySpeedGoal: number;
  progressionPace: ProgressionPace;
  practicePresentationMode: PracticePresentationMode;
  preferredContentFamilyId: PreferredContentFamilyId;
  punctuationEnabled: boolean;
  capitalizationEnabled: boolean;
  whitespaceStyle: WhitespaceStyle;
  spaceSkipsWords: boolean;
  contentSourceBias: ContentSourceBias;
  programmerModeEnabled: boolean;
  retrainWeakCharacters: boolean;
  activeCharacterRange: ActiveCharacterRange;
  selectedInputMode: "hardware" | "touch";
  numpadEnabled: boolean;
  touchOptimizationEnabled: boolean;
  themeChoice: ThemeChoice;
  bodyFontChoice: BodyFontChoice;
  displayFontChoice: BodyFontChoice;
  monoFontChoice: MonoFontChoice;
  soundEnabled: boolean;
  practiceGuideDismissed: boolean;
}

export const CURRENT_PREFERENCES_SCHEMA_VERSION = 1;

export const defaultPracticePreferences: PracticePreferences = {
  schemaVersion: CURRENT_PREFERENCES_SCHEMA_VERSION,
  onboardingComplete: false,
  selectedLanguageId: "english",
  selectedKeyboardFamilyId: "ansi-compact",
  selectedKeyboardLayoutId: "ansi-us-compact",
  devicePreference: "desktop",
  lessonSpanSeconds: 90,
  passageWordGoal: 24,
  masterySpeedGoal: 220,
  progressionPace: "balanced",
  practicePresentationMode: "full",
  preferredContentFamilyId: "adaptive-blend",
  punctuationEnabled: true,
  capitalizationEnabled: false,
  whitespaceStyle: "bullet",
  spaceSkipsWords: true,
  contentSourceBias: "mixed",
  programmerModeEnabled: false,
  retrainWeakCharacters: true,
  activeCharacterRange: "extended",
  selectedInputMode: "hardware",
  numpadEnabled: false,
  touchOptimizationEnabled: true,
  themeChoice: "nullkeys-classic",
  bodyFontChoice: "ibm-plex-sans",
  displayFontChoice: "ibm-plex-sans",
  monoFontChoice: "sf-mono-menlo",
  soundEnabled: false,
  practiceGuideDismissed: false,
};
