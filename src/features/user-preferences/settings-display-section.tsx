"use client";

import { FieldLabel, SelectField } from "@/components/shared/form-controls";
import { getLanguageDefinition } from "@/features/language-support/language-registry";
import {
  bodyFontLibrary,
  getBodyFontDefinition,
  getMonoFontDefinition,
  monoFontLibrary,
} from "@/features/user-preferences/font-registry";
import type { PracticePreferences } from "@/features/user-preferences/preferences-schema";
import { SettingsSection } from "@/features/user-preferences/settings-section";
import {
  cssVariableToColor,
  getThemeDefinition,
  themeLibrary,
} from "@/features/user-preferences/theme-registry";
import { getBuildMetadata } from "@/lib/product/build-metadata";

interface SettingsDisplaySectionProps {
  preferences: PracticePreferences;
  onPreview: (preferences: Partial<PracticePreferences>) => void;
}

export function SettingsDisplaySection({ preferences, onPreview }: SettingsDisplaySectionProps) {
  const theme = getThemeDefinition(preferences.themeChoice);
  const bodyFont = getBodyFontDefinition(preferences.bodyFontChoice);
  const displayFont = getBodyFontDefinition(preferences.displayFontChoice);
  const monoFont = getMonoFontDefinition(preferences.monoFontChoice);
  const language = getLanguageDefinition(preferences.selectedLanguageId);
  const previewLanguages = ["english", "persian", "russian"].map(getLanguageDefinition);
  const buildMetadata = getBuildMetadata();

  return (
    <SettingsSection
      testId="settings-section-misc"
      title="Display"
      description="Themes and fonts stay local to this browser and preview immediately without changing the shell layout."
    >
      <div className="space-y-2">
        <FieldLabel title="Theme library" description="Preview a bundled theme before saving it." />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {themeLibrary.map((definition) => (
            <button
              key={definition.id}
              type="button"
              data-testid={`theme-option-${definition.id}`}
              aria-pressed={preferences.themeChoice === definition.id}
              onClick={() => onPreview({ themeChoice: definition.id })}
              className={preferences.themeChoice === definition.id
                ? "rounded-2xl border border-accent bg-[hsl(var(--surface-raised)/0.98)] p-3 text-left shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.12)]"
                : "rounded-2xl border border-borderTone/75 bg-[hsl(var(--surface-raised)/0.86)] p-3 text-left hover:border-accent/45"}
            >
              <p className="text-sm font-semibold text-text">{definition.label}</p>
              <p className="text-xs leading-5 text-textMuted">{definition.description}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <FontSelect label="Body font" value={preferences.bodyFontChoice} options={bodyFontLibrary} onChange={(bodyFontChoice) => onPreview({ bodyFontChoice })} description={bodyFont.description} />
        <FontSelect label="Display font" value={preferences.displayFontChoice} options={bodyFontLibrary} onChange={(displayFontChoice) => onPreview({ displayFontChoice })} description={displayFont.description} />
        <FontSelect label="Monospace font" value={preferences.monoFontChoice} options={monoFontLibrary} onChange={(monoFontChoice) => onPreview({ monoFontChoice })} description={monoFont.description} />
      </div>
      <div className="rounded-2xl border border-borderTone/80 bg-[hsl(var(--surface-raised)/0.9)] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Preview</p><p className="mt-1 text-sm text-textMuted">{theme.label} with the selected local fonts.</p></div>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {(["--canvas", "--panel-solid", "--accent", "--surface-strong"] as const).map((token) => <span key={token} className="h-4 w-4 rounded-full border border-borderTone/65" style={{ backgroundColor: cssVariableToColor(theme.cssVariables[token]) }} />)}
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <p className="text-2xl tracking-tight text-text" style={{ fontFamily: displayFont.stack }}>{buildMetadata.name} keeps the lesson shell steady.</p>
            <p lang={language.localeTag} dir={language.direction} className="text-start text-sm leading-7 text-textMuted [unicode-bidi:plaintext]" style={{ fontFamily: bodyFont.stack }}>{language.sampleSentence}</p>
            <p className="rounded-xl border border-borderTone/80 bg-[hsl(var(--surface-inset)/0.92)] px-3 py-3 text-sm text-text" style={{ fontFamily: monoFont.stack }}>grep -n &quot;adaptive&quot; src tests</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {previewLanguages.map((previewLanguage) => <div key={previewLanguage.id} className="rounded-xl border border-borderTone/80 bg-[hsl(var(--surface-inset)/0.92)] px-3 py-3"><p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">{previewLanguage.nativeLabel}</p><p lang={previewLanguage.localeTag} dir={previewLanguage.direction} className="mt-2 text-start text-sm leading-7 text-text [unicode-bidi:plaintext]" style={{ fontFamily: bodyFont.stack }}>{previewLanguage.sampleSentence}</p></div>)}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

function FontSelect<T extends string>({ label, value, options, onChange, description }: { label: string; value: T; options: readonly { id: T; label: string }[]; onChange: (value: T) => void; description: string }) {
  return <div className="space-y-2"><FieldLabel title={label} description={description} /><SelectField aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</SelectField></div>;
}
