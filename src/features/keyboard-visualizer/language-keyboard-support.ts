import { getLanguageDefinition } from "@/features/language-support/language-registry";
import type { InputMode } from "@/lib/scoring/session-models";

export interface LanguageKeyboardLegendOverride {
  primary?: string;
  secondary?: string;
  trainingCharacters?: string[];
}

interface LanguageKeyboardSupportDefinition {
  languageId: string;
  overlayLabel: string;
  overlayShortLabel: string;
  suggestedHardwareLabel?: string;
  suggestedTouchLabel?: string;
  keyOverrides: Record<string, LanguageKeyboardLegendOverride>;
}

export interface ResolvedLanguageKeyboardContext {
  languageId: string;
  source: "layout-native" | "language-overlay";
  overlayLabel: string | null;
  overlayShortLabel: string | null;
  suggestedLabel: string | null;
}

const russianOverrides: Record<string, LanguageKeyboardLegendOverride> = {
  Backquote: { primary: "ё" },
  KeyQ: { primary: "й" },
  KeyW: { primary: "ц" },
  KeyE: { primary: "у" },
  KeyR: { primary: "к" },
  KeyT: { primary: "е" },
  KeyY: { primary: "н" },
  KeyU: { primary: "г" },
  KeyI: { primary: "ш" },
  KeyO: { primary: "щ" },
  KeyP: { primary: "з" },
  BracketLeft: { primary: "х" },
  BracketRight: { primary: "ъ" },
  KeyA: { primary: "ф" },
  KeyS: { primary: "ы" },
  KeyD: { primary: "в" },
  KeyF: { primary: "а" },
  KeyG: { primary: "п" },
  KeyH: { primary: "р" },
  KeyJ: { primary: "о" },
  KeyK: { primary: "л" },
  KeyL: { primary: "д" },
  Semicolon: { primary: "ж" },
  Quote: { primary: "э" },
  KeyZ: { primary: "я" },
  KeyX: { primary: "ч" },
  KeyC: { primary: "с" },
  KeyV: { primary: "м" },
  KeyB: { primary: "и" },
  KeyN: { primary: "т" },
  KeyM: { primary: "ь" },
  Comma: { primary: "б" },
  Period: { primary: "ю" },
  Slash: { primary: ".", secondary: "," },
  LanguageMode: { primary: "ру", trainingCharacters: [] },
};

const persianOverrides: Record<string, LanguageKeyboardLegendOverride> = {
  Digit1: { primary: "۱", secondary: "!" },
  Digit2: { primary: "۲", secondary: "@" },
  Digit3: { primary: "۳", secondary: "#" },
  Digit4: { primary: "۴", secondary: "$" },
  Digit5: { primary: "۵", secondary: "%" },
  Digit6: { primary: "۶", secondary: "^" },
  Digit7: { primary: "۷", secondary: "&" },
  Digit8: { primary: "۸", secondary: "*" },
  Digit9: { primary: "۹", secondary: "(" },
  Digit0: { primary: "۰", secondary: ")" },
  KeyQ: { primary: "ض" },
  KeyW: { primary: "ص" },
  KeyE: { primary: "ث" },
  KeyR: { primary: "ق" },
  KeyT: { primary: "ف" },
  KeyY: { primary: "غ" },
  KeyU: { primary: "ع" },
  KeyI: { primary: "ه" },
  KeyO: { primary: "خ" },
  KeyP: { primary: "ح" },
  BracketLeft: { primary: "ج" },
  BracketRight: { primary: "چ" },
  KeyA: { primary: "ش" },
  KeyS: { primary: "س" },
  KeyD: { primary: "ی" },
  KeyF: { primary: "ب" },
  KeyG: { primary: "ل" },
  KeyH: { primary: "ا" },
  KeyJ: { primary: "ت" },
  KeyK: { primary: "ن" },
  KeyL: { primary: "م" },
  Semicolon: { primary: "ک" },
  Quote: { primary: "گ" },
  KeyZ: { primary: "ظ" },
  KeyX: { primary: "ط" },
  KeyC: { primary: "ز" },
  KeyV: { primary: "ر" },
  KeyB: { primary: "ذ" },
  KeyN: { primary: "د" },
  KeyM: { primary: "پ" },
  Comma: { primary: "و" },
  Period: { primary: "،", trainingCharacters: ["،", "."] },
  Slash: { primary: "؟", secondary: "/" },
  LanguageMode: { primary: "فا", trainingCharacters: [] },
};

const languageKeyboardSupportMap: Record<string, LanguageKeyboardSupportDefinition> = {
  russian: {
    languageId: "russian",
    overlayLabel: "Russian JCUKEN legends",
    overlayShortLabel: "JCUKEN",
    suggestedHardwareLabel: "Current hardware board with Russian JCUKEN legends",
    suggestedTouchLabel: "Touch keyboard with Russian legends",
    keyOverrides: russianOverrides,
  },
  persian: {
    languageId: "persian",
    overlayLabel: "Persian standard legends",
    overlayShortLabel: "Persian",
    suggestedHardwareLabel: "Current hardware board with Persian standard legends",
    suggestedTouchLabel: "Touch keyboard with Persian legends and native digits",
    keyOverrides: persianOverrides,
  },
};

export function getLanguageKeyboardSupport(languageId?: string) {
  if (!languageId) {
    return null;
  }

  return languageKeyboardSupportMap[languageId] ?? null;
}

export function getLanguageKeyboardLegendOverrides(languageId?: string) {
  return getLanguageKeyboardSupport(languageId)?.keyOverrides ?? {};
}

export function resolveLanguageKeyboardContext(options: {
  languageId: string;
  inputMode: InputMode;
}) {
  const languageDefinition = getLanguageDefinition(options.languageId);
  const support = getLanguageKeyboardSupport(options.languageId);

  if (!support) {
    return {
      languageId: options.languageId,
      source: "layout-native",
      overlayLabel: null,
      overlayShortLabel: null,
      suggestedLabel:
        languageDefinition.scriptFamily === "latin"
          ? "Current layout legends already match the active language."
          : null,
    } satisfies ResolvedLanguageKeyboardContext;
  }

  return {
    languageId: options.languageId,
    source: "language-overlay",
    overlayLabel: support.overlayLabel,
    overlayShortLabel: support.overlayShortLabel,
    suggestedLabel:
      options.inputMode === "touch"
        ? support.suggestedTouchLabel ?? support.overlayLabel
        : support.suggestedHardwareLabel ?? support.overlayLabel,
  } satisfies ResolvedLanguageKeyboardContext;
}
