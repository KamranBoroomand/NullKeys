import { inferKeyboardSelection } from "@/features/keyboard-visualizer/keyboard-layout-registry";

const localeToLanguageId: Record<string, string> = {
  en: "english",
  es: "spanish",
  fr: "french",
  de: "german",
  pt: "portuguese",
  it: "italian",
  nl: "dutch",
  et: "estonian",
  sv: "swedish",
  nb: "norwegian-bokmal",
  nn: "norwegian-bokmal",
  no: "norwegian-bokmal",
  da: "danish",
  fi: "finnish",
  pl: "polish",
  cs: "czech",
  hr: "croatian",
  ro: "romanian",
  hu: "hungarian",
  sl: "slovenian",
  tr: "turkish",
  id: "indonesian",
  uk: "ukrainian",
  be: "belarusian",
  ru: "russian",
  el: "greek",
  he: "hebrew",
  fa: "persian",
  ar: "arabic",
  hi: "hindi",
  ja: "japanese",
  lt: "lithuanian",
  lv: "latvian",
  th: "thai",
};

export function inferSuggestedLanguageId(localeHint?: string) {
  const normalizedLocale = (localeHint ?? "").toLowerCase();
  const exactMatch = Object.entries(localeToLanguageId).find(([localePrefix]) =>
    normalizedLocale.startsWith(localePrefix),
  );

  return exactMatch?.[1] ?? "english";
}

export function inferSuggestedPreferences() {
  const platformHint = typeof navigator !== "undefined" ? navigator.platform : "";
  const localeHint = typeof navigator !== "undefined" ? navigator.language : "";
  const isTouchDevice =
    typeof window !== "undefined" &&
    (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
  const keyboardSuggestion = inferKeyboardSelection(platformHint, isTouchDevice);

  return {
    selectedLanguageId: inferSuggestedLanguageId(localeHint),
    selectedKeyboardFamilyId: keyboardSuggestion.familyId,
    selectedKeyboardLayoutId: keyboardSuggestion.layoutId,
    devicePreference: isTouchDevice ? "mobile" : "desktop",
    selectedInputMode: isTouchDevice ? "touch" : "hardware",
    touchOptimizationEnabled: isTouchDevice,
  } as const;
}
