"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { getAdaptiveContentFamilies } from "@/features/content-families/content-family-registry";
import { languageOptions } from "@/features/language-support/language-registry";
import {
  primaryNavigationItems,
  utilityNavigationItems,
  type SiteNavigationItem,
} from "@/features/product-shell/site-navigation";
import { getBuildMetadata } from "@/lib/product/build-metadata";
import type {
  CharacterPerformanceEntry,
  ContentDifficultyBand,
  LearnerCharacterProfile,
  SessionRecord,
} from "@/lib/scoring/session-models";
import { classNames } from "@/lib/utils/class-names";
import { formatPercent, formatRate, formatRelativeSessionDate } from "@/lib/utils/formatting";

const buildMetadata = getBuildMetadata();

export function aggregateCharacterPerformanceMap(sessionRecords: SessionRecord[]) {
  return sessionRecords.reduce<Record<string, CharacterPerformanceEntry>>((aggregate, record) => {
    for (const [character, next] of Object.entries(record.perCharacterPerformance)) {
      const current = aggregate[character];
      aggregate[character] = current
        ? {
            ...current,
            attemptCount: current.attemptCount + next.attemptCount,
            correctCount: current.correctCount + next.correctCount,
            mistakeCount: current.mistakeCount + next.mistakeCount,
            smoothedResponseMs: Math.round((current.smoothedResponseMs + next.smoothedResponseMs) / 2),
            bestRecentResponseMs: current.bestRecentResponseMs === 0
              ? next.bestRecentResponseMs
              : Math.min(current.bestRecentResponseMs, next.bestRecentResponseMs),
            masteryScore: Math.round((current.masteryScore + next.masteryScore) / 2),
            lastSeenAt: Date.parse(current.lastSeenAt) > Date.parse(next.lastSeenAt)
              ? current.lastSeenAt
              : next.lastSeenAt,
          }
        : { ...next };
    }
    return aggregate;
  }, {});
}

export function formatLegacyPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function formatSignedRate(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}wpm`;
}

export function formatMetricDelta(value: number | null, suffix: string, digits = 1) {
  if (value === null || Number.isNaN(value) || value === 0) return null;
  return `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}${suffix}`;
}

export function metricDeltaClassName(value: number | null) {
  if (value === null || value === 0) return "text-textMuted/72";
  return value > 0 ? "text-[hsl(var(--trend-up))]" : "text-[hsl(var(--trend-down))]";
}

export function averageCharacterSpeed(sessionRecords: SessionRecord[], character: string | null) {
  if (!character) return null;
  const entries = sessionRecords
    .map((record) => record.perCharacterPerformance[character])
    .filter((entry): entry is CharacterPerformanceEntry => entry !== undefined);
  if (entries.length === 0) return null;
  return entries.reduce((sum, entry) => {
    const responseMs = entry.bestRecentResponseMs || entry.smoothedResponseMs;
    return sum + (responseMs <= 0 ? 0 : 12_000 / responseMs);
  }, 0) / entries.length;
}

export function responseMsToWpm(responseMs: number) {
  return responseMs <= 0 ? 0 : 12_000 / responseMs;
}

export function formatWhitespaceLabel(style: "none" | "bar" | "bullet") {
  return style === "none" ? "none" : style;
}

export function describeDifficultyProgression(options: {
  contentFamilyId: string;
  difficultyBand: ContentDifficultyBand;
  regressionHold: boolean;
  forgottenCount: number;
  confusionPairCount: number;
  introductionCount: number;
  reviewCount: number;
}) {
  if (options.regressionHold || options.forgottenCount > 0) return "Density is being held steady while recovery keys cycle back into view.";
  if (options.confusionPairCount > 0) return "The lesson adds contrast because recent confusions need cleaner separation.";
  if (options.contentFamilyId === "shell-drills") return options.difficultyBand === "foundational" ? "Shell work starts with short commands, simple paths, and clean flags." : "Shell work is widening into quotes, redirects, and layered command shapes.";
  if (options.contentFamilyId === "number-drills") return options.difficultyBand === "foundational" ? "Number work starts with clean integers, short times, and readable separators." : "Number work is broadening into decimals, grouped values, and mixed formats.";
  if (options.contentFamilyId === "symbol-drills") return options.difficultyBand === "foundational" ? "Symbol work starts with balanced pairs and short clusters." : "Symbol work is adding alternation, pairing pressure, and mixed punctuation.";
  if (["phrase-drills", "quote-drills"].includes(options.contentFamilyId)) return options.introductionCount > 0 ? "New characters enter through readable clauses with review material underneath." : "Phrase density is increasing through broader clauses and punctuation.";
  if (options.reviewCount > 0) return "The planner is mixing recovery and fluency while review pressure remains.";
  return "Recent stability is letting the planner broaden structure, punctuation, and variety.";
}

export function LegacyIndicatorRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="text-[0.88rem] leading-6 text-textMuted sm:flex sm:items-start sm:gap-3.5"><p className="mb-0.5 shrink-0 text-textMuted/82 sm:mb-0 sm:w-[5.75rem] sm:text-right">{label}:</p><div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-text">{children}</div></div>;
}

export function LegacyKeyBadge({ value, onClick, tone = "muted", selected = false }: { value: string; onClick?: () => void; tone?: "muted" | "active" | "warning"; selected?: boolean }) {
  const toneClassName = selected
    ? "border-[hsl(var(--chip-selected-border))] bg-[hsl(var(--chip-selected-background))] text-[hsl(var(--chip-selected-text))]"
    : tone === "active"
      ? "border-[hsl(var(--chip-active-border))] bg-[hsl(var(--chip-active-background))] text-[hsl(var(--chip-active-text))]"
      : tone === "warning"
        ? "border-[hsl(var(--chip-warning-border))] bg-[hsl(var(--chip-warning-background))] text-[hsl(var(--chip-warning-text))]"
        : "border-[hsl(var(--chip-muted-border))] bg-[hsl(var(--chip-muted-background))] text-[hsl(var(--chip-muted-text))]";
  const className = classNames("inline-flex min-w-[1.55rem] items-center justify-center rounded-[2px] border px-[0.38rem] py-[0.02rem] font-mono text-[0.82rem] leading-6 transition", toneClassName);
  return onClick ? <button type="button" onClick={onClick} className={classNames(className, "hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))]")}>{value}</button> : <span className={className}>{value}</span>;
}

export function LegacyToolbarButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-textMuted transition hover:bg-[hsl(var(--text)/0.08)] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))]">{children}</button>;
}

export const practiceGuideSteps = [
  { title: "Adaptive lessons stay targeted", body: "Each passage uses recent character timing, accuracy, and unlock state. Recovery keys remain visible until they settle." },
  { title: "Choose the amount of guidance", body: "Normal shows the keyboard and lesson details, compact reduces the chrome, and bare keeps the typing surface." },
  { title: "Focus characters explain the goal", body: "Priority, recovery, preview, and review strips explain why the generated prompt looks the way it does." },
  { title: "Content families change the lesson", body: "Switch between words, pseudo-words, phrases, symbols, numbers, code, and shell drills without leaving practice." },
];

export const practiceViewModes = [
  { id: "full", label: "Normal" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Bare" },
] as const;

function matchesPath(item: SiteNavigationItem, pathname: string) {
  return item.href === pathname || item.aliases?.includes(pathname);
}

function describeSelectedCharacter(entry: CharacterPerformanceEntry | undefined, character: string | null, profile?: LearnerCharacterProfile) {
  if (!character) return "Pick a focus character to inspect its timing, confidence, and recovery pressure.";
  if (profile?.state === "forgotten") return `${character} has faded enough to resurface. Keep it in mixed passages until it feels automatic again.`;
  if (profile?.state === "shaky") return `${character} is still shaky. Favor clean repetitions over pace.`;
  if (profile && profile.hesitationRate >= 0.22) return `${character} is more hesitant than incorrect. Keep it in flowing words so speed can settle.`;
  if (!entry) return `${character} is new to this practice window and needs enough clean attempts to establish a baseline.`;
  if (entry.mistakeCount >= 4) return `${character} is generating too many errors. Slow the rhythm and prioritize clean hits.`;
  if (entry.masteryScore >= 82) return `${character} is stable enough for mixed review.`;
  return `${character} remains in reinforcement until it becomes repeatable.`;
}

function SidebarSection({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return <section data-testid={testId} className="space-y-1.5 border-t border-borderTone/35 pt-3 first:border-t-0 first:pt-0"><h3 className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-textMuted/76">{label}</h3><div className="space-y-1.5 text-[0.82rem] leading-[1.45] text-textMuted">{children}</div></section>;
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3"><span className="text-textMuted/74">{label}</span><span className="max-w-full break-words text-left font-medium text-text sm:max-w-[8.5rem] sm:text-right">{value}</span></div>;
}

function SidebarSelect({ label, value, onChange, children, testId }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; testId?: string }) {
  return <label className="block space-y-1"><span className="block text-[0.68rem] uppercase tracking-[0.18em] text-textMuted/72">{label}</span><select data-testid={testId} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[0.45rem] border border-borderTone/60 bg-panelSolid px-2.5 py-2 text-[0.84rem] text-text">{children}</select></label>;
}

interface PracticeUtilitySidebarProps {
  pathname: string;
  selectedLanguageId: string;
  onLanguageChange: (languageId: string) => void;
  selectedContentFamilyId: string;
  onContentFamilyChange: (contentFamilyId: string) => void;
  showKeyDetails: boolean;
  showExtendedInsights: boolean;
  selectedCharacter: string | null;
  selectedCharacterPerformance: CharacterPerformanceEntry | undefined;
  selectedCharacterProfile: LearnerCharacterProfile | undefined;
  recentAdaptiveSessions: SessionRecord[];
  adaptivePlan: { activeCharacterSet: string[]; unlockPreviewCharacters: string[]; progressionSummary: { currentStageIndex: number; totalStages: number } };
  lessonMeta: { languageLabel: string; keyboardLayoutLabel: string; inputMode: string; whitespaceLabel: string; viewLabel: string };
  selectedContentFamilyLabel: string;
  adaptiveLessonPreferenceLabel: string | null;
  adaptiveLessonReason: string | null;
  keyboardContextLabel: string | null;
  currentDifficultyBand: ContentDifficultyBand;
  introductionCharacters: string[];
  reviewCharacters: string[];
  progressionReason: string;
}

export function PracticeUtilitySidebar(props: PracticeUtilitySidebarProps) {
  const navigationItems = primaryNavigationItems.filter((item) => ["/", "/typing-test", "/layouts", "/profile", "/help"].includes(item.href));
  const formatBand = (band: ContentDifficultyBand) => band.split("-").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
  return (
    <div data-testid="practice-utility-strip" className="grid gap-4 rounded-[0.95rem] border border-borderTone/45 bg-[hsl(var(--surface-raised)/0.72)] px-4 py-4 shadow-[0_1px_0_hsl(var(--text)/0.08)] sm:grid-cols-2 lg:grid-cols-3 xl:max-h-[calc(100svh-8rem)] xl:w-[14rem] xl:grid-cols-1 xl:overflow-y-auto xl:rounded-none xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:shadow-none">
      <div className="space-y-2.5">
        <SidebarSection label={buildMetadata.name}><p className="font-semibold uppercase tracking-[0.24em] text-text">{buildMetadata.name}</p><p className="font-medium text-text">{props.lessonMeta.languageLabel}</p><p>{props.lessonMeta.keyboardLayoutLabel}</p>{props.keyboardContextLabel ? <p>{props.keyboardContextLabel}</p> : null}</SidebarSection>
        <SidebarSection label="Language"><SidebarSelect label="Practice language" value={props.selectedLanguageId} onChange={props.onLanguageChange} testId="practice-language-select">{languageOptions.map((language) => <option key={language.id} value={language.id}>{language.label} · {language.nativeLabel}</option>)}</SidebarSelect><p>Changes apply to the prompt, keyboard context, and progression profile.</p></SidebarSection>
        <SidebarSection label="Lesson"><ValueRow label="Source" value={props.selectedContentFamilyLabel} />{props.adaptiveLessonPreferenceLabel ? <ValueRow label="Shape" value={props.adaptiveLessonPreferenceLabel} /> : null}<ValueRow label="Band" value={formatBand(props.currentDifficultyBand)} /><ValueRow label="View" value={props.lessonMeta.viewLabel} /><ValueRow label="Spaces" value={props.lessonMeta.whitespaceLabel} /><ValueRow label="Input" value={props.lessonMeta.inputMode} />{props.adaptiveLessonReason ? <p>{props.adaptiveLessonReason}</p> : null}</SidebarSection>
      </div>
      <div className="space-y-2.5">
        <SidebarSection label="Modes">{getAdaptiveContentFamilies().map((family) => <button key={family.id} type="button" onClick={() => props.onContentFamilyChange(family.id)} className={classNames("block text-left text-[0.8rem] leading-5", props.selectedContentFamilyId === family.id ? "font-medium text-text" : "text-textMuted hover:text-text")}>{family.shortLabel}</button>)}</SidebarSection>
        {props.showKeyDetails ? <SidebarSection label="Key details" testId="practice-key-detail-panel"><ValueRow label="Key" value={props.selectedCharacter ?? "?"} /><ValueRow label="Mastery" value={props.selectedCharacterPerformance ? `${props.selectedCharacterPerformance.masteryScore}%` : "new"} /><ValueRow label="Mistakes" value={String(props.selectedCharacterPerformance?.mistakeCount ?? 0)} /><ValueRow label="Response" value={props.selectedCharacterPerformance ? `${props.selectedCharacterPerformance.smoothedResponseMs} ms` : "n/a"} /><p>{describeSelectedCharacter(props.selectedCharacterPerformance, props.selectedCharacter, props.selectedCharacterProfile)}</p></SidebarSection> : null}
      </div>
      <div className="space-y-2.5">
        {props.showExtendedInsights ? <SidebarSection label="History" testId="practice-extended-insights"><ValueRow label="Stage" value={`${props.adaptivePlan.progressionSummary.currentStageIndex + 1}/${props.adaptivePlan.progressionSummary.totalStages}`} /><ValueRow label="Introduce" value={props.introductionCharacters.join(" ") || "none"} /><ValueRow label="Review" value={props.reviewCharacters.join(" ") || "light"} /><ValueRow label="Preview" value={props.adaptivePlan.unlockPreviewCharacters.join(" ") || "none"} /><p>{props.progressionReason}</p>{props.recentAdaptiveSessions.slice(0, 3).map((record) => <div key={record.sessionId}><p className="font-medium text-text">{formatRate(record.netWpm)} net WPM</p><p>{formatPercent(record.accuracy)} accuracy · {formatRelativeSessionDate(record.endedAt)}</p></div>)}</SidebarSection> : null}
        <SidebarSection label="Links"><nav className="space-y-1.5">{navigationItems.map((item) => <Link key={item.href} href={item.href} className={matchesPath(item, props.pathname) ? "block text-text" : "block text-textMuted hover:text-text"}>{item.label}</Link>)}</nav>{utilityNavigationItems.map((item) => <Link key={item.href} href={item.href} className="block text-textMuted hover:text-text">{item.label}</Link>)}</SidebarSection>
      </div>
    </div>
  );
}
