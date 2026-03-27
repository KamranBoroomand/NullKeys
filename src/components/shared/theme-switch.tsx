"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import type { ThemeChoice } from "@/features/user-preferences/preferences-schema";
import {
  getNextThemeChoice,
  getThemeDefinition,
} from "@/features/user-preferences/theme-registry";

interface ThemeSwitchProps {
  themeChoice: ThemeChoice;
  onChange: (themeChoice: ThemeChoice) => void;
}

export function ThemeSwitch({ themeChoice, onChange }: ThemeSwitchProps) {
  const activeTheme = getThemeDefinition(themeChoice);
  const nextThemeChoice = getNextThemeChoice(themeChoice);

  return (
    <ActionButton
      tone="secondary"
      onClick={() => onChange(nextThemeChoice)}
      aria-label={`Switch theme to ${getThemeDefinition(nextThemeChoice).label}`}
    >
      {activeTheme.mode === "dark" ? (
        <MoonStar className="mr-2 h-4 w-4" />
      ) : (
        <SunMedium className="mr-2 h-4 w-4" />
      )}
      Theme: {activeTheme.label}
    </ActionButton>
  );
}
