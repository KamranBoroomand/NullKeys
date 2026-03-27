export type BodyFontChoice =
  | "system-sans"
  | "ibm-plex-sans"
  | "inter"
  | "avenir-ui"
  | "ubuntu"
  | "atkinson-hyperlegible"
  | "vazirmatn-friendly"
  | "noto-sans";

export type MonoFontChoice =
  | "system-mono"
  | "sf-mono-menlo"
  | "jetbrains-mono"
  | "ibm-plex-mono"
  | "noto-sans-mono";

export interface FontDefinition<Id extends string> {
  id: Id;
  label: string;
  description: string;
  stack: string;
}

export const bodyFontLibrary: FontDefinition<BodyFontChoice>[] = [
  {
    id: "system-sans",
    label: "System Sans",
    description: "Fast native UI stack tuned for each platform.",
    stack:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "Arial Nova", "Noto Sans", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", Tahoma, sans-serif',
  },
  {
    id: "ibm-plex-sans",
    label: "IBM Plex Sans",
    description: "Readable humanist sans with broad UI coverage.",
    stack:
      '"IBM Plex Sans", "IBM Plex Sans Arabic", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "IBM Plex Sans JP", "Noto Sans", "Noto Sans JP", "Segoe UI", "Helvetica Neue", Tahoma, sans-serif',
  },
  {
    id: "inter",
    label: "Inter",
    description: "Tight, modern sans with solid small-size rhythm.",
    stack:
      '"Inter", "Inter Variable", "Noto Sans", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "avenir-ui",
    label: "Avenir / UI Sans",
    description: "Avenir-first stack with dependable UI fallbacks.",
    stack:
      '"Avenir Next", Avenir, "Hiragino Sans", "Yu Gothic UI", Meiryo, "Noto Sans", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", "Segoe UI", "Helvetica Neue", Arial, Tahoma, sans-serif',
  },
  {
    id: "ubuntu",
    label: "Ubuntu",
    description: "Open, round sans that stays legible in dense UI.",
    stack:
      '"Ubuntu", "Noto Sans", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "atkinson-hyperlegible",
    label: "Atkinson Hyperlegible",
    description: "Accessibility-focused letterforms for clearer scanning.",
    stack:
      '"Atkinson Hyperlegible", "Noto Sans", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", "Segoe UI", "Helvetica Neue", "Arial Nova", sans-serif',
  },
  {
    id: "vazirmatn-friendly",
    label: "Vazirmatn-friendly",
    description: "Persian-aware stack with strong Arabic-script support.",
    stack:
      '"Vazirmatn", "Noto Naskh Arabic", "IBM Plex Sans Arabic", "Noto Sans Arabic", Tahoma, "Segoe UI", "Helvetica Neue", "Noto Sans", sans-serif',
  },
  {
    id: "noto-sans",
    label: "Noto-friendly Sans",
    description: "Broad language coverage for mixed-script practice.",
    stack:
      '"Noto Sans", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", Meiryo, "Noto Sans Hebrew", "Segoe UI", "Helvetica Neue", Tahoma, sans-serif',
  },
];

export const monoFontLibrary: FontDefinition<MonoFontChoice>[] = [
  {
    id: "system-mono",
    label: "System Mono",
    description: "Native monospace stack with compact metrics.",
    stack:
      'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Cascadia Mono", "Liberation Mono", "Noto Sans Mono", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", monospace',
  },
  {
    id: "sf-mono-menlo",
    label: "SF Mono / Menlo",
    description: "Classic Apple-style coding stack with safe fallbacks.",
    stack:
      '"SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Noto Sans Mono", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", monospace',
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    description: "Tall coding font with clear punctuation.",
    stack:
      '"JetBrains Mono", "SF Mono", Menlo, Consolas, "Noto Sans Mono", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", monospace',
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    description: "Balanced monospace with strong punctuation rhythm.",
    stack:
      '"IBM Plex Mono", "SF Mono", Menlo, Consolas, "Noto Sans Mono", "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", monospace',
  },
  {
    id: "noto-sans-mono",
    label: "Noto-friendly Mono",
    description: "Monospace stack that keeps wide script fallback nearby.",
    stack:
      '"Noto Sans Mono", "IBM Plex Mono", "SF Mono", Menlo, Consolas, "Vazirmatn", "Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans JP", monospace',
  },
];

export const bodyFontChoices = bodyFontLibrary.map((font) => font.id) as BodyFontChoice[];
export const monoFontChoices = monoFontLibrary.map((font) => font.id) as MonoFontChoice[];

export function getBodyFontDefinition(fontChoice?: string) {
  return bodyFontLibrary.find((font) => font.id === fontChoice) ?? bodyFontLibrary[0];
}

export function getMonoFontDefinition(fontChoice?: string) {
  return monoFontLibrary.find((font) => font.id === fontChoice) ?? monoFontLibrary[0];
}
