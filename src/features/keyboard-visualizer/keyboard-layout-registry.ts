import { getLanguageKeyboardLegendOverrides } from "@/features/keyboard-visualizer/language-keyboard-support";

export interface KeyboardKeyDefinition {
  code: string;
  primary: string;
  secondary?: string;
  width?: number;
  handZone?: "left" | "right" | "center";
  fingerZone?: "pinky" | "ring" | "middle" | "left-index" | "right-index" | "thumb" | "none";
  rowZone?:
    | "function"
    | "number"
    | "top"
    | "home"
    | "bottom"
    | "thumb"
    | "numpad"
    | "touch";
  trainingTags?: Array<"letter" | "digit" | "symbol" | "modifier" | "numpad" | "touch">;
  symbolAccess?: "direct" | "shift" | "alt-layer" | "symbol-layer";
}

export interface KeyboardLayoutDefinition {
  id: string;
  familyId: string;
  label: string;
  platformLabel: string;
  supportsNumpad: boolean;
  geometryKind?:
    | "ansi"
    | "iso"
    | "apple"
    | "linux"
    | "ortholinear"
    | "split"
    | "touch";
  localeProfile?: string;
  modifierLegendFamily?: "windows" | "apple" | "linux" | "touch";
  rows: KeyboardKeyDefinition[][];
}

export interface KeyboardFamilyDefinition {
  id: string;
  label: string;
  description: string;
  platformHint: string;
  supportsTouch: boolean;
  deviceClass?: "desktop" | "laptop" | "touch";
}

const functionRow: KeyboardKeyDefinition[][] = [
  [
    { code: "Escape", primary: "esc", width: 1.2 },
    { code: "F1", primary: "f1" },
    { code: "F2", primary: "f2" },
    { code: "F3", primary: "f3" },
    { code: "F4", primary: "f4" },
    { code: "F5", primary: "f5" },
    { code: "F6", primary: "f6" },
    { code: "F7", primary: "f7" },
    { code: "F8", primary: "f8" },
    { code: "F9", primary: "f9" },
    { code: "F10", primary: "f10" },
    { code: "F11", primary: "f11" },
    { code: "F12", primary: "f12" },
  ],
];

const ansiBaseRows: KeyboardKeyDefinition[][] = [
  [
    { code: "Backquote", primary: "`", secondary: "~" },
    { code: "Digit1", primary: "1", secondary: "!" },
    { code: "Digit2", primary: "2", secondary: "@" },
    { code: "Digit3", primary: "3", secondary: "#" },
    { code: "Digit4", primary: "4", secondary: "$" },
    { code: "Digit5", primary: "5", secondary: "%" },
    { code: "Digit6", primary: "6", secondary: "^" },
    { code: "Digit7", primary: "7", secondary: "&" },
    { code: "Digit8", primary: "8", secondary: "*" },
    { code: "Digit9", primary: "9", secondary: "(" },
    { code: "Digit0", primary: "0", secondary: ")" },
    { code: "Minus", primary: "-", secondary: "_" },
    { code: "Equal", primary: "=", secondary: "+" },
    { code: "Backspace", primary: "delete", width: 1.8 },
  ],
  [
    { code: "Tab", primary: "tab", width: 1.5 },
    { code: "KeyQ", primary: "q" },
    { code: "KeyW", primary: "w" },
    { code: "KeyE", primary: "e" },
    { code: "KeyR", primary: "r" },
    { code: "KeyT", primary: "t" },
    { code: "KeyY", primary: "y" },
    { code: "KeyU", primary: "u" },
    { code: "KeyI", primary: "i" },
    { code: "KeyO", primary: "o" },
    { code: "KeyP", primary: "p" },
    { code: "BracketLeft", primary: "[", secondary: "{" },
    { code: "BracketRight", primary: "]", secondary: "}" },
    { code: "Backslash", primary: "\\", secondary: "|" },
  ],
  [
    { code: "CapsLock", primary: "caps", width: 1.8 },
    { code: "KeyA", primary: "a" },
    { code: "KeyS", primary: "s" },
    { code: "KeyD", primary: "d" },
    { code: "KeyF", primary: "f" },
    { code: "KeyG", primary: "g" },
    { code: "KeyH", primary: "h" },
    { code: "KeyJ", primary: "j" },
    { code: "KeyK", primary: "k" },
    { code: "KeyL", primary: "l" },
    { code: "Semicolon", primary: ";", secondary: ":" },
    { code: "Quote", primary: "'", secondary: `"` },
    { code: "Enter", primary: "return", width: 2.1 },
  ],
  [
    { code: "ShiftLeft", primary: "shift", width: 2.3 },
    { code: "KeyZ", primary: "z" },
    { code: "KeyX", primary: "x" },
    { code: "KeyC", primary: "c" },
    { code: "KeyV", primary: "v" },
    { code: "KeyB", primary: "b" },
    { code: "KeyN", primary: "n" },
    { code: "KeyM", primary: "m" },
    { code: "Comma", primary: ",", secondary: "<" },
    { code: "Period", primary: ".", secondary: ">" },
    { code: "Slash", primary: "/", secondary: "?" },
    { code: "ShiftRight", primary: "shift", width: 2.7 },
  ],
  [
    { code: "ControlLeft", primary: "ctrl", width: 1.4 },
    { code: "MetaLeft", primary: "win", width: 1.4 },
    { code: "AltLeft", primary: "alt", width: 1.4 },
    { code: "Space", primary: "space", width: 5.5 },
    { code: "AltRight", primary: "alt", width: 1.4 },
    { code: "MetaRight", primary: "menu", width: 1.4 },
    { code: "ControlRight", primary: "ctrl", width: 1.4 },
  ],
];

const isoBaseRows: KeyboardKeyDefinition[][] = [
  [
    { code: "Backquote", primary: "`", secondary: "¬" },
    { code: "Digit1", primary: "1", secondary: "!" },
    { code: "Digit2", primary: "2", secondary: `"` },
    { code: "Digit3", primary: "3", secondary: "£" },
    { code: "Digit4", primary: "4", secondary: "$" },
    { code: "Digit5", primary: "5", secondary: "%" },
    { code: "Digit6", primary: "6", secondary: "^" },
    { code: "Digit7", primary: "7", secondary: "&" },
    { code: "Digit8", primary: "8", secondary: "*" },
    { code: "Digit9", primary: "9", secondary: "(" },
    { code: "Digit0", primary: "0", secondary: ")" },
    { code: "Minus", primary: "-", secondary: "_" },
    { code: "Equal", primary: "=", secondary: "+" },
    { code: "Backspace", primary: "delete", width: 1.8 },
  ],
  [
    { code: "Tab", primary: "tab", width: 1.5 },
    { code: "KeyQ", primary: "q" },
    { code: "KeyW", primary: "w" },
    { code: "KeyE", primary: "e" },
    { code: "KeyR", primary: "r" },
    { code: "KeyT", primary: "t" },
    { code: "KeyY", primary: "y" },
    { code: "KeyU", primary: "u" },
    { code: "KeyI", primary: "i" },
    { code: "KeyO", primary: "o" },
    { code: "KeyP", primary: "p" },
    { code: "BracketLeft", primary: "[", secondary: "{" },
    { code: "BracketRight", primary: "]", secondary: "}" },
  ],
  [
    { code: "CapsLock", primary: "caps", width: 1.8 },
    { code: "KeyA", primary: "a" },
    { code: "KeyS", primary: "s" },
    { code: "KeyD", primary: "d" },
    { code: "KeyF", primary: "f" },
    { code: "KeyG", primary: "g" },
    { code: "KeyH", primary: "h" },
    { code: "KeyJ", primary: "j" },
    { code: "KeyK", primary: "k" },
    { code: "KeyL", primary: "l" },
    { code: "Semicolon", primary: ";", secondary: ":" },
    { code: "Quote", primary: "'", secondary: "@" },
    { code: "Enter", primary: "return", width: 2.4 },
  ],
  [
    { code: "ShiftLeft", primary: "shift", width: 1.4 },
    { code: "IntlBackslash", primary: "\\", secondary: "|" },
    { code: "KeyZ", primary: "z" },
    { code: "KeyX", primary: "x" },
    { code: "KeyC", primary: "c" },
    { code: "KeyV", primary: "v" },
    { code: "KeyB", primary: "b" },
    { code: "KeyN", primary: "n" },
    { code: "KeyM", primary: "m" },
    { code: "Comma", primary: ",", secondary: "<" },
    { code: "Period", primary: ".", secondary: ">" },
    { code: "Slash", primary: "/", secondary: "?" },
    { code: "ShiftRight", primary: "shift", width: 2.2 },
  ],
  ansiBaseRows[4],
];

const ortholinearRows: KeyboardKeyDefinition[][] = [
  [
    { code: "Digit1", primary: "1" },
    { code: "Digit2", primary: "2" },
    { code: "Digit3", primary: "3" },
    { code: "Digit4", primary: "4" },
    { code: "Digit5", primary: "5" },
    { code: "Digit6", primary: "6" },
    { code: "Digit7", primary: "7" },
    { code: "Digit8", primary: "8" },
    { code: "Digit9", primary: "9" },
    { code: "Digit0", primary: "0" },
    { code: "Minus", primary: "-" },
    { code: "Equal", primary: "=" },
  ],
  [
    { code: "KeyQ", primary: "q" },
    { code: "KeyW", primary: "w" },
    { code: "KeyE", primary: "e" },
    { code: "KeyR", primary: "r" },
    { code: "KeyT", primary: "t" },
    { code: "KeyY", primary: "y" },
    { code: "KeyU", primary: "u" },
    { code: "KeyI", primary: "i" },
    { code: "KeyO", primary: "o" },
    { code: "KeyP", primary: "p" },
    { code: "BracketLeft", primary: "[" },
    { code: "BracketRight", primary: "]" },
  ],
  [
    { code: "KeyA", primary: "a" },
    { code: "KeyS", primary: "s" },
    { code: "KeyD", primary: "d" },
    { code: "KeyF", primary: "f" },
    { code: "KeyG", primary: "g" },
    { code: "KeyH", primary: "h" },
    { code: "KeyJ", primary: "j" },
    { code: "KeyK", primary: "k" },
    { code: "KeyL", primary: "l" },
    { code: "Semicolon", primary: ";" },
    { code: "Quote", primary: "'" },
    { code: "Backslash", primary: "\\" },
  ],
  [
    { code: "KeyZ", primary: "z" },
    { code: "KeyX", primary: "x" },
    { code: "KeyC", primary: "c" },
    { code: "KeyV", primary: "v" },
    { code: "KeyB", primary: "b" },
    { code: "KeyN", primary: "n" },
    { code: "KeyM", primary: "m" },
    { code: "Comma", primary: "," },
    { code: "Period", primary: "." },
    { code: "Slash", primary: "/" },
    { code: "Backspace", primary: "delete", width: 1.6 },
    { code: "Enter", primary: "return", width: 1.6 },
  ],
  [
    { code: "ControlLeft", primary: "ctrl", width: 1.4 },
    { code: "AltLeft", primary: "alt", width: 1.4 },
    { code: "Space", primary: "space", width: 3.8 },
    { code: "LayerRaise", primary: "raise", width: 1.6 },
    { code: "LayerLower", primary: "lower", width: 1.6 },
    { code: "ControlRight", primary: "ctrl", width: 1.4 },
  ],
];

const splitErgoRows: KeyboardKeyDefinition[][] = [
  [
    { code: "KeyQ", primary: "q" },
    { code: "KeyW", primary: "w" },
    { code: "KeyE", primary: "e" },
    { code: "KeyR", primary: "r" },
    { code: "KeyT", primary: "t" },
    { code: "SplitGap1", primary: "·", width: 1.3 },
    { code: "KeyY", primary: "y" },
    { code: "KeyU", primary: "u" },
    { code: "KeyI", primary: "i" },
    { code: "KeyO", primary: "o" },
    { code: "KeyP", primary: "p" },
  ],
  [
    { code: "KeyA", primary: "a" },
    { code: "KeyS", primary: "s" },
    { code: "KeyD", primary: "d" },
    { code: "KeyF", primary: "f" },
    { code: "KeyG", primary: "g" },
    { code: "SplitGap2", primary: "·", width: 1.3 },
    { code: "KeyH", primary: "h" },
    { code: "KeyJ", primary: "j" },
    { code: "KeyK", primary: "k" },
    { code: "KeyL", primary: "l" },
    { code: "Semicolon", primary: ";" },
  ],
  [
    { code: "KeyZ", primary: "z" },
    { code: "KeyX", primary: "x" },
    { code: "KeyC", primary: "c" },
    { code: "KeyV", primary: "v" },
    { code: "KeyB", primary: "b" },
    { code: "SplitGap3", primary: "·", width: 1.3 },
    { code: "KeyN", primary: "n" },
    { code: "KeyM", primary: "m" },
    { code: "Comma", primary: "," },
    { code: "Period", primary: "." },
    { code: "Slash", primary: "/" },
  ],
  [
    { code: "Thumb1", primary: "shift", width: 1.6 },
    { code: "Thumb2", primary: "space", width: 2.4 },
    { code: "Thumb3", primary: "tab", width: 1.4 },
    { code: "ThumbGap", primary: "·", width: 1.2 },
    { code: "Thumb4", primary: "enter", width: 1.4 },
    { code: "Thumb5", primary: "space", width: 2.4 },
    { code: "Thumb6", primary: "backspace", width: 1.6 },
  ],
];

const touchAndroidRows: KeyboardKeyDefinition[][] = [
  [
    { code: "Digit1", primary: "1" },
    { code: "Digit2", primary: "2" },
    { code: "Digit3", primary: "3" },
    { code: "Digit4", primary: "4" },
    { code: "Digit5", primary: "5" },
    { code: "Digit6", primary: "6" },
    { code: "Digit7", primary: "7" },
    { code: "Digit8", primary: "8" },
    { code: "Digit9", primary: "9" },
    { code: "Digit0", primary: "0" },
  ],
  ansiBaseRows[1].slice(1, 11),
  [{ code: "ShiftLeft", primary: "shift", width: 1.5 }, ...ansiBaseRows[2].slice(1, 11), { code: "Backspace", primary: "delete", width: 1.5 }],
  [{ code: "SymbolMode", primary: "?123", width: 1.6 }, ...ansiBaseRows[3].slice(4, 10), { code: "Enter", primary: "return", width: 1.6 }],
  [
    { code: "EmojiMode", primary: "☺", width: 1.4 },
    { code: "Comma", primary: ",", width: 1.2 },
    { code: "Space", primary: "space", width: 4.8 },
    { code: "Period", primary: ".", width: 1.2 },
    { code: "LanguageMode", primary: "lang", width: 1.4 },
  ],
];

const touchIOSRows: KeyboardKeyDefinition[][] = [
  ansiBaseRows[1].slice(1, 11),
  ansiBaseRows[2].slice(1, 10),
  [{ code: "ShiftLeft", primary: "shift", width: 1.6 }, ...ansiBaseRows[3].slice(0, 10), { code: "Backspace", primary: "delete", width: 1.6 }],
  [
    { code: "SymbolMode", primary: "123", width: 1.6 },
    { code: "Globe", primary: "globe", width: 1.3 },
    { code: "Space", primary: "space", width: 4.8 },
    { code: "Enter", primary: "return", width: 1.8 },
  ],
];

const numpadRows: KeyboardKeyDefinition[][] = [
  [
    { code: "Numpad7", primary: "7" },
    { code: "Numpad8", primary: "8" },
    { code: "Numpad9", primary: "9" },
    { code: "NumpadSubtract", primary: "-" },
  ],
  [
    { code: "Numpad4", primary: "4" },
    { code: "Numpad5", primary: "5" },
    { code: "Numpad6", primary: "6" },
    { code: "NumpadAdd", primary: "+" },
  ],
  [
    { code: "Numpad1", primary: "1" },
    { code: "Numpad2", primary: "2" },
    { code: "Numpad3", primary: "3" },
    { code: "NumpadEnter", primary: "enter", width: 1.4 },
  ],
  [
    { code: "Numpad0", primary: "0", width: 2.1 },
    { code: "NumpadDecimal", primary: "." },
  ],
];

function cloneRows(rows: KeyboardKeyDefinition[][]) {
  return rows.map((row) => row.map((keyDefinition) => ({ ...keyDefinition })));
}

function remapRows(
  rows: KeyboardKeyDefinition[][],
  replacements: Record<string, Partial<KeyboardKeyDefinition>>,
) {
  return rows.map((row) =>
    row.map((keyDefinition) =>
      replacements[keyDefinition.code]
        ? { ...keyDefinition, ...replacements[keyDefinition.code] }
        : { ...keyDefinition },
    ),
  );
}

export const keyboardFamilies: KeyboardFamilyDefinition[] = [
  {
    id: "ansi-compact",
    label: "Windows Compact",
    description: "Compact Windows-style desktop board without a numpad.",
    platformHint: "Windows",
    supportsTouch: false,
  },
  {
    id: "ansi-tenkeyless",
    label: "Windows TKL",
    description: "Tenkeyless Windows-style board with function row and no numpad.",
    platformHint: "Windows",
    supportsTouch: false,
  },
  {
    id: "ansi-full",
    label: "Windows Full",
    description: "Full-size Windows-style board with numpad drills.",
    platformHint: "Windows",
    supportsTouch: false,
  },
  {
    id: "iso-compact",
    label: "ISO Compact",
    description: "Compact ISO board with international enter and extra key.",
    platformHint: "Europe",
    supportsTouch: false,
  },
  {
    id: "iso-full",
    label: "ISO Full",
    description: "Full-size ISO layout with numpad coverage.",
    platformHint: "Europe",
    supportsTouch: false,
  },
  {
    id: "apple-compact",
    label: "Apple Compact",
    description: "Apple compact board with flat keycaps and Mac modifier legends.",
    platformHint: "macOS",
    supportsTouch: false,
  },
  {
    id: "apple-full",
    label: "Apple Full",
    description: "Mac full-size layout with numpad support.",
    platformHint: "macOS",
    supportsTouch: false,
  },
  {
    id: "linux-programmer",
    label: "Linux TKL",
    description: "Linux-focused TKL board with terminal-friendly legends and Super-key emphasis.",
    platformHint: "Linux",
    supportsTouch: false,
  },
  {
    id: "ortholinear-grid",
    label: "Ortholinear Grid",
    description: "Columnar board with aligned rows and layer keys.",
    platformHint: "Custom",
    supportsTouch: false,
  },
  {
    id: "split-ergo",
    label: "Split Ergo",
    description: "Split ergonomic board with thumb clusters.",
    platformHint: "Custom",
    supportsTouch: false,
  },
  {
    id: "touch-ios",
    label: "Touch iOS",
    description: "iPhone / iPad style virtual keyboard preview.",
    platformHint: "iOS",
    supportsTouch: true,
  },
  {
    id: "touch-android",
    label: "Touch Android",
    description: "Android-style virtual keyboard with symbol layer access.",
    platformHint: "Android",
    supportsTouch: true,
  },
];

const appleCompactRows = remapRows(ansiBaseRows, {
  MetaLeft: { primary: "cmd" },
  MetaRight: { primary: "cmd" },
  AltLeft: { primary: "option" },
  AltRight: { primary: "option" },
});

const linuxRows = remapRows([...functionRow, ...ansiBaseRows], {
  MetaLeft: { primary: "super" },
  MetaRight: { primary: "super" },
  AltRight: { primary: "alt gr" },
  Backspace: { primary: "backspace" },
});

export const keyboardLayouts: KeyboardLayoutDefinition[] = [
  {
    id: "ansi-us-compact",
    familyId: "ansi-compact",
    label: "ANSI US Compact",
    platformLabel: "Windows / Linux",
    supportsNumpad: false,
    rows: cloneRows(ansiBaseRows),
  },
  {
    id: "ansi-uk-compact",
    familyId: "ansi-compact",
    label: "ANSI UK Compact",
    platformLabel: "Windows / Linux",
    supportsNumpad: false,
    rows: remapRows(ansiBaseRows, {
      Digit2: { secondary: `"` },
      Digit3: { secondary: "£" },
      Quote: { primary: "#", secondary: "~" },
    }),
  },
  {
    id: "ansi-us-tenkeyless",
    familyId: "ansi-tenkeyless",
    label: "ANSI US TKL",
    platformLabel: "Windows / Linux",
    supportsNumpad: false,
    rows: [...cloneRows(functionRow), ...cloneRows(ansiBaseRows)],
  },
  {
    id: "ansi-programmer-tkl",
    familyId: "ansi-tenkeyless",
    label: "ANSI Programmer TKL",
    platformLabel: "Windows / Linux",
    supportsNumpad: false,
    rows: remapRows([...functionRow, ...ansiBaseRows], {
      BracketLeft: { primary: "{", secondary: "[" },
      BracketRight: { primary: "}", secondary: "]" },
      Backslash: { primary: "|", secondary: "\\" },
    }),
  },
  {
    id: "ansi-us-full",
    familyId: "ansi-full",
    label: "ANSI US Full",
    platformLabel: "Windows / Linux",
    supportsNumpad: true,
    rows: [...cloneRows(functionRow), ...cloneRows(ansiBaseRows), ...cloneRows(numpadRows)],
  },
  {
    id: "iso-intl-compact",
    familyId: "iso-compact",
    label: "ISO International Compact",
    platformLabel: "Europe",
    supportsNumpad: false,
    rows: cloneRows(isoBaseRows),
  },
  {
    id: "iso-developer-full",
    familyId: "iso-full",
    label: "ISO Developer Full",
    platformLabel: "Europe",
    supportsNumpad: true,
    rows: [...cloneRows(functionRow), ...cloneRows(isoBaseRows), ...cloneRows(numpadRows)],
  },
  {
    id: "apple-us-compact",
    familyId: "apple-compact",
    label: "Apple US Compact",
    platformLabel: "macOS",
    supportsNumpad: false,
    rows: cloneRows(appleCompactRows),
  },
  {
    id: "apple-intl-compact",
    familyId: "apple-compact",
    label: "Apple International Compact",
    platformLabel: "macOS",
    supportsNumpad: false,
    rows: remapRows(appleCompactRows, {
      Digit2: { secondary: "@" },
      Digit3: { secondary: "£" },
      AltRight: { primary: "option" },
    }),
  },
  {
    id: "apple-us-full",
    familyId: "apple-full",
    label: "Apple US Full",
    platformLabel: "macOS",
    supportsNumpad: true,
    rows: [...cloneRows(functionRow), ...cloneRows(appleCompactRows), ...cloneRows(numpadRows)],
  },
  {
    id: "linux-terminal-tkl",
    familyId: "linux-programmer",
    label: "Linux Terminal TKL",
    platformLabel: "Linux",
    supportsNumpad: false,
    rows: cloneRows(linuxRows),
  },
  {
    id: "ortholinear-48",
    familyId: "ortholinear-grid",
    label: "Ortholinear 48",
    platformLabel: "Custom",
    supportsNumpad: false,
    rows: cloneRows(ortholinearRows),
  },
  {
    id: "split-ergo-54",
    familyId: "split-ergo",
    label: "Split Ergo 54",
    platformLabel: "Custom",
    supportsNumpad: false,
    rows: cloneRows(splitErgoRows),
  },
  {
    id: "touch-ios-standard",
    familyId: "touch-ios",
    label: "Touch iOS Standard",
    platformLabel: "iOS",
    supportsNumpad: false,
    rows: cloneRows(touchIOSRows),
  },
  {
    id: "touch-android-standard",
    familyId: "touch-android",
    label: "Touch Android Standard",
    platformLabel: "Android",
    supportsNumpad: false,
    rows: cloneRows(touchAndroidRows),
  },
];

export function getKeyboardLayout(layoutId: string) {
  return keyboardLayouts.find((layout) => layout.id === layoutId) ?? keyboardLayouts[0];
}

export function getKeyboardFamily(familyId: string) {
  return keyboardFamilies.find((family) => family.id === familyId) ?? keyboardFamilies[0];
}

export function getLayoutsForFamily(familyId: string) {
  return keyboardLayouts.filter((layout) => layout.familyId === familyId);
}

function collectPrintableCharacters(
  keyDefinition: KeyboardKeyDefinition,
  languageId?: string,
) {
  const legendOverride = getLanguageKeyboardLegendOverrides(languageId)[keyDefinition.code];

  return [keyDefinition.primary, keyDefinition.secondary, ...(legendOverride?.trainingCharacters ?? []), legendOverride?.primary, legendOverride?.secondary]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())
    .filter((value) => value.length <= 2 && value !== "·");
}

export function buildKeyboardCompanionMap(layoutId: string, languageId?: string) {
  const layout = getKeyboardLayout(layoutId);
  const companionMap = new Map<string, Set<string>>();

  for (const [rowIndex, row] of layout.rows.entries()) {
    for (const [columnIndex, keyDefinition] of row.entries()) {
      const sourceCharacters = collectPrintableCharacters(keyDefinition, languageId);
      const neighborKeys = [
        row[columnIndex - 1],
        row[columnIndex + 1],
        layout.rows[rowIndex - 1]?.[columnIndex],
        layout.rows[rowIndex + 1]?.[columnIndex],
      ].filter((neighborKey): neighborKey is KeyboardKeyDefinition => Boolean(neighborKey));

      for (const sourceCharacter of sourceCharacters) {
        const existingNeighbors = companionMap.get(sourceCharacter) ?? new Set<string>();

        for (const neighborKey of neighborKeys) {
          for (const neighborCharacter of collectPrintableCharacters(neighborKey, languageId)) {
            if (neighborCharacter !== sourceCharacter) {
              existingNeighbors.add(neighborCharacter);
            }
          }
        }

        companionMap.set(sourceCharacter, existingNeighbors);
      }
    }
  }

  return Object.fromEntries(
    Array.from(companionMap.entries()).map(([character, neighbors]) => [
      character,
      Array.from(neighbors),
    ]),
  ) as Record<string, string[]>;
}

function uniqueStringList(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function inferKeyboardSelection(platformHint?: string, isTouchDevice?: boolean) {
  const normalizedPlatformHint = (platformHint ?? "").toLowerCase();

  if (isTouchDevice) {
    return normalizedPlatformHint.includes("iphone") || normalizedPlatformHint.includes("ipad")
      ? {
          familyId: "touch-ios",
          layoutId: "touch-ios-standard",
        }
      : {
          familyId: "touch-android",
          layoutId: "touch-android-standard",
        };
  }

  if (normalizedPlatformHint.includes("mac")) {
    return {
      familyId: "apple-compact",
      layoutId: "apple-us-compact",
    };
  }

  if (normalizedPlatformHint.includes("linux")) {
    return {
      familyId: "linux-programmer",
      layoutId: "linux-terminal-tkl",
    };
  }

  return {
    familyId: "ansi-tenkeyless",
    layoutId: "ansi-us-tenkeyless",
  };
}

export interface KeyboardTrainingKeyMetadata {
  code: string;
  characters: string[];
  handZone: NonNullable<KeyboardKeyDefinition["handZone"]>;
  fingerZone: NonNullable<KeyboardKeyDefinition["fingerZone"]>;
  rowZone: NonNullable<KeyboardKeyDefinition["rowZone"]>;
  trainingTags: NonNullable<KeyboardKeyDefinition["trainingTags"]>;
  symbolAccess: NonNullable<KeyboardKeyDefinition["symbolAccess"]>;
}

export interface KeyboardTrainingProfile {
  layoutId: string;
  familyId: string;
  geometryKind: NonNullable<KeyboardLayoutDefinition["geometryKind"]>;
  localeProfile: string;
  modifierLegendFamily: NonNullable<KeyboardLayoutDefinition["modifierLegendFamily"]>;
  supportsNumpad: boolean;
  homeRowCharacters: string[];
  numberRowCharacters: string[];
  numpadCharacters: string[];
  modifierKeyCodes: string[];
  programmerSymbolCharacters: string[];
  keyMetadataMap: Record<string, KeyboardTrainingKeyMetadata>;
}

function inferGeometryKind(layoutDefinition: KeyboardLayoutDefinition) {
  if (layoutDefinition.geometryKind) {
    return layoutDefinition.geometryKind;
  }

  if (layoutDefinition.familyId.includes("iso")) {
    return "iso";
  }

  if (layoutDefinition.familyId.includes("apple")) {
    return "apple";
  }

  if (layoutDefinition.familyId.includes("linux")) {
    return "linux";
  }

  if (layoutDefinition.familyId.includes("ortholinear")) {
    return "ortholinear";
  }

  if (layoutDefinition.familyId.includes("split")) {
    return "split";
  }

  if (layoutDefinition.familyId.includes("touch")) {
    return "touch";
  }

  return "ansi";
}

function inferLocaleProfile(layoutDefinition: KeyboardLayoutDefinition) {
  if (layoutDefinition.localeProfile) {
    return layoutDefinition.localeProfile;
  }

  if (layoutDefinition.id.includes("uk")) {
    return "uk";
  }

  if (layoutDefinition.id.includes("intl")) {
    return "international";
  }

  if (layoutDefinition.id.includes("developer")) {
    return "developer";
  }

  if (layoutDefinition.familyId.includes("apple")) {
    return "apple-us";
  }

  if (layoutDefinition.familyId.includes("linux")) {
    return "linux-terminal";
  }

  if (layoutDefinition.familyId.includes("touch-ios")) {
    return "ios";
  }

  if (layoutDefinition.familyId.includes("touch-android")) {
    return "android";
  }

  return "us";
}

function inferModifierLegendFamily(layoutDefinition: KeyboardLayoutDefinition) {
  if (layoutDefinition.modifierLegendFamily) {
    return layoutDefinition.modifierLegendFamily;
  }

  if (layoutDefinition.familyId.includes("apple")) {
    return "apple";
  }

  if (layoutDefinition.familyId.includes("linux")) {
    return "linux";
  }

  if (layoutDefinition.familyId.includes("touch")) {
    return "touch";
  }

  return "windows";
}

function inferRowZone(
  keyDefinition: KeyboardKeyDefinition,
  row: KeyboardKeyDefinition[],
  layoutDefinition: KeyboardLayoutDefinition,
): KeyboardTrainingKeyMetadata["rowZone"] {
  if (keyDefinition.rowZone) {
    return keyDefinition.rowZone;
  }

  if (keyDefinition.code.startsWith("F") || keyDefinition.code === "Escape") {
    return "function";
  }

  if (keyDefinition.code.startsWith("Numpad")) {
    return "numpad";
  }

  if (layoutDefinition.familyId.includes("touch")) {
    return "touch";
  }

  if (row.some((rowKeyDefinition) => rowKeyDefinition.code === "Tab")) {
    return "top";
  }

  if (row.some((rowKeyDefinition) => rowKeyDefinition.code === "CapsLock")) {
    return "home";
  }

  if (row.some((rowKeyDefinition) => rowKeyDefinition.code === "ShiftLeft")) {
    return "bottom";
  }

  if (
    row.some(
      (rowKeyDefinition) =>
        rowKeyDefinition.code === "ControlLeft" || rowKeyDefinition.code === "Space",
    )
  ) {
    return "thumb";
  }

  if (
    row.some(
      (rowKeyDefinition) =>
        rowKeyDefinition.code === "Backquote" || rowKeyDefinition.code === "Digit1",
    )
  ) {
    return "number";
  }

  if (
    keyDefinition.code === "Space" ||
    keyDefinition.code.startsWith("Thumb") ||
    keyDefinition.code.startsWith("Layer")
  ) {
    return "thumb";
  }

  return "number";
}

function inferHandAndFinger(
  row: KeyboardKeyDefinition[],
  columnIndex: number,
  rowZone: KeyboardTrainingKeyMetadata["rowZone"],
  keyDefinition: KeyboardKeyDefinition,
) {
  if (keyDefinition.handZone && keyDefinition.fingerZone) {
    return {
      handZone: keyDefinition.handZone,
      fingerZone: keyDefinition.fingerZone,
    };
  }

  if (rowZone === "numpad") {
    return {
      handZone: "right" as const,
      fingerZone:
        columnIndex === 0
          ? ("right-index" as const)
          : columnIndex === 1
            ? ("middle" as const)
            : columnIndex === 2
              ? ("ring" as const)
              : ("pinky" as const),
    };
  }

  if (rowZone === "thumb") {
    return {
      handZone: columnIndex <= Math.floor(row.length / 2) ? ("left" as const) : ("right" as const),
      fingerZone: "thumb" as const,
    };
  }

  const normalizedColumn = row.length <= 1 ? 0.5 : columnIndex / (row.length - 1);

  if (normalizedColumn <= 0.08) {
    return { handZone: "left" as const, fingerZone: "pinky" as const };
  }

  if (normalizedColumn <= 0.2) {
    return { handZone: "left" as const, fingerZone: "ring" as const };
  }

  if (normalizedColumn <= 0.32) {
    return { handZone: "left" as const, fingerZone: "middle" as const };
  }

  if (normalizedColumn <= 0.48) {
    return { handZone: "left" as const, fingerZone: "left-index" as const };
  }

  if (normalizedColumn < 0.58) {
    return { handZone: "center" as const, fingerZone: "thumb" as const };
  }

  if (normalizedColumn <= 0.72) {
    return { handZone: "right" as const, fingerZone: "right-index" as const };
  }

  if (normalizedColumn <= 0.84) {
    return { handZone: "right" as const, fingerZone: "middle" as const };
  }

  if (normalizedColumn <= 0.94) {
    return { handZone: "right" as const, fingerZone: "ring" as const };
  }

  return { handZone: "right" as const, fingerZone: "pinky" as const };
}

function inferTrainingTags(
  keyDefinition: KeyboardKeyDefinition,
): KeyboardTrainingKeyMetadata["trainingTags"] {
  const emptyTags: KeyboardTrainingKeyMetadata["trainingTags"] = [];

  if (keyDefinition.trainingTags) {
    return keyDefinition.trainingTags;
  }

  if (
    keyDefinition.code.includes("Shift") ||
    keyDefinition.code.includes("Control") ||
    keyDefinition.code.includes("Alt") ||
    keyDefinition.code.includes("Meta") ||
    keyDefinition.code === "CapsLock" ||
    keyDefinition.code === "Tab"
  ) {
    return ["modifier"] as KeyboardTrainingKeyMetadata["trainingTags"];
  }

  if (keyDefinition.code.startsWith("Numpad")) {
    return ["numpad", "digit"];
  }

  if (keyDefinition.code.startsWith("Digit")) {
    return ["digit"];
  }

  if (keyDefinition.primary.length === 1 && /[a-z]/i.test(keyDefinition.primary)) {
    return ["letter"];
  }

  if (keyDefinition.primary.length === 1 || (keyDefinition.secondary ?? "").length === 1) {
    return ["symbol"];
  }

  if (keyDefinition.code === "Space") {
    return ["touch"];
  }

  return emptyTags;
}

function inferSymbolAccess(keyDefinition: KeyboardKeyDefinition) {
  if (keyDefinition.symbolAccess) {
    return keyDefinition.symbolAccess;
  }

  if (keyDefinition.code.startsWith("Numpad")) {
    return "direct";
  }

  if (keyDefinition.secondary) {
    return "shift";
  }

  if (keyDefinition.code === "SymbolMode") {
    return "symbol-layer";
  }

  if (keyDefinition.code === "LanguageMode" || keyDefinition.code === "Globe") {
    return "alt-layer";
  }

  return "direct";
}

export function buildKeyboardTrainingProfile(layoutId: string, languageId?: string) {
  const layoutDefinition = getKeyboardLayout(layoutId);
  const keyMetadataEntries = layoutDefinition.rows.flatMap((row, rowIndex) =>
    row.map((keyDefinition, columnIndex) => {
      const rowZone = inferRowZone(keyDefinition, row, layoutDefinition);
      const { handZone, fingerZone } = inferHandAndFinger(
        row,
        columnIndex,
        rowZone,
        keyDefinition,
      );
      const trainingTags = inferTrainingTags(keyDefinition);
      const characters = collectPrintableCharacters(keyDefinition, languageId);

      return [
        keyDefinition.code,
        {
          code: keyDefinition.code,
          characters,
          handZone,
          fingerZone,
          rowZone,
          trainingTags,
          symbolAccess: inferSymbolAccess(keyDefinition),
        } satisfies KeyboardTrainingKeyMetadata,
      ] as const;
    }),
  );
  const keyMetadataMap = Object.fromEntries(keyMetadataEntries) as Record<
    string,
    KeyboardTrainingKeyMetadata
  >;
  const allCharacters = Object.values(keyMetadataMap).flatMap((metadata) => metadata.characters);

  return {
    layoutId: layoutDefinition.id,
    familyId: layoutDefinition.familyId,
    geometryKind: inferGeometryKind(layoutDefinition),
    localeProfile: inferLocaleProfile(layoutDefinition),
    modifierLegendFamily: inferModifierLegendFamily(layoutDefinition),
    supportsNumpad: layoutDefinition.supportsNumpad,
    homeRowCharacters: uniqueStringList(
      Object.values(keyMetadataMap)
        .filter((metadata) => metadata.rowZone === "home")
        .flatMap((metadata) => metadata.characters),
    ),
    numberRowCharacters: uniqueStringList(
      Object.values(keyMetadataMap)
        .filter((metadata) => metadata.rowZone === "number")
        .flatMap((metadata) => metadata.characters),
    ),
    numpadCharacters: uniqueStringList(
      Object.values(keyMetadataMap)
        .filter((metadata) => metadata.trainingTags.includes("numpad"))
        .flatMap((metadata) => metadata.characters),
    ),
    modifierKeyCodes: Object.values(keyMetadataMap)
      .filter((metadata) => metadata.trainingTags.includes("modifier"))
      .map((metadata) => metadata.code),
    programmerSymbolCharacters: uniqueStringList(
      allCharacters.filter((character) => /[[\]{}()<>/\\_=+\-:;"'`,.?!@#$%^&*]/.test(character)),
    ),
    keyMetadataMap,
  } satisfies KeyboardTrainingProfile;
}

export function findKeyMetadataForCharacter(layoutId: string, character: string, languageId?: string) {
  const keyboardTrainingProfile = buildKeyboardTrainingProfile(layoutId, languageId);
  const normalizedCharacter = character.toLowerCase();

  return (
    Object.values(keyboardTrainingProfile.keyMetadataMap).find((metadata) =>
      metadata.characters.includes(normalizedCharacter),
    ) ?? null
  );
}
