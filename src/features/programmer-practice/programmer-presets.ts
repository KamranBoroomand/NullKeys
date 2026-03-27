import { commandLineFragments, programmerTokenGroups } from "@/content/code-snippets/programmer-fragments";

export interface ProgrammerDrillPreset {
  id: string;
  label: string;
  description: string;
  emphasisCharacters: string[];
  fragments: string[];
}

export const programmerDrillPresets: ProgrammerDrillPreset[] = [
  {
    id: "typescript-symbols",
    label: "TS Symbols",
    description: "Nullish coalescing, optional chaining, brackets, and typed signatures.",
    emphasisCharacters: Array.from("[]{}()<>?.:=+_-\"'"),
    fragments: programmerTokenGroups.javascript,
  },
  {
    id: "python-structure",
    label: "Python Structure",
    description: "Colons, underscores, slicing, and compact control flow.",
    emphasisCharacters: Array.from("()[]:_=,\"'"),
    fragments: programmerTokenGroups.python,
  },
  {
    id: "markup-angle",
    label: "HTML / XML",
    description: "Angle brackets, quotes, and slash-heavy tag shapes.",
    emphasisCharacters: Array.from("<>/=\"'-"),
    fragments: programmerTokenGroups.markup,
  },
  {
    id: "shell-commands",
    label: "Shell Commands",
    description: "Hyphens, slashes, flags, paths, and quoted command sequences.",
    emphasisCharacters: Array.from("-_/~\"'.:$"),
    fragments: [...programmerTokenGroups.shell, ...commandLineFragments],
  },
];

export function getProgrammerDrillPreset(presetId?: string) {
  if (!presetId) {
    return programmerDrillPresets[0];
  }

  return programmerDrillPresets.find((preset) => preset.id === presetId) ?? programmerDrillPresets[0];
}
