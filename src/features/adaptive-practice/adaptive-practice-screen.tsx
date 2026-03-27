"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleHelp, Maximize2, Redo2, Settings2, Undo2 } from "lucide-react";
import { KeyboardSurface } from "@/components/keyboard/keyboard-surface";
import { PracticeGuideDialog } from "@/components/practice/practice-guide-dialog";
import { TypingSurface } from "@/components/practice/typing-surface";
import { planAdaptiveSession } from "@/features/adaptive-practice/adaptive-planner";
import { evaluateLearnerProgressProfile } from "@/features/adaptive-practice/learner-progression";
import { generatePracticePassage } from "@/features/adaptive-practice/passage-generator";
import {
  getAdaptiveContentFamilies,
  getContentFamily,
} from "@/features/content-families/content-family-registry";
import { loadLanguageContentBundle } from "@/features/content-packs/content-pack-loader";
import { getLanguageDefinition, languageOptions } from "@/features/language-support/language-registry";
import {
  getKeyboardLayout,
} from "@/features/keyboard-visualizer/keyboard-layout-registry";
import { resolveLanguageKeyboardContext } from "@/features/keyboard-visualizer/language-keyboard-support";
import {
  primaryNavigationItems,
  utilityNavigationItems,
  type SiteNavigationItem,
} from "@/features/product-shell/site-navigation";
import type { PracticePresentationMode } from "@/features/user-preferences/preferences-schema";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import {
  listSessionRecords,
  readLearnerProgressProfile,
  saveLearnerProgressProfile,
  saveSessionRecord,
} from "@/lib/persistence/session-repository";
import { buildInputLanguageMismatchWarning } from "@/lib/input/input-language-mismatch";
import { getBuildMetadata } from "@/lib/product/build-metadata";
import { useDepressedKeys } from "@/lib/input/use-depressed-keys";
import { useTouchInputSupport } from "@/lib/input/use-touch-input-support";
import { useTypingSession } from "@/lib/input/use-typing-session";
import { scoreTypingSession } from "@/lib/scoring/session-scorer";
import type {
  CharacterPerformanceEntry,
  ContentDifficultyBand,
  LearnerCharacterProfile,
  LearnerProgressProfile,
  SessionContentMetrics,
  SessionRecord,
} from "@/lib/scoring/session-models";
import { formatPercent, formatRate, formatRelativeSessionDate } from "@/lib/utils/formatting";
import { classNames } from "@/lib/utils/class-names";

const buildMetadata = getBuildMetadata();

function aggregateCharacterPerformanceMap(sessionRecords: SessionRecord[]) {
  return sessionRecords.reduce<Record<string, CharacterPerformanceEntry>>((accumulator, sessionRecord) => {
    for (const [character, nextEntry] of Object.entries(sessionRecord.perCharacterPerformance)) {
      const existingEntry = accumulator[character];

      if (!existingEntry) {
        accumulator[character] = { ...nextEntry };
        continue;
      }

      accumulator[character] = {
        ...existingEntry,
        attemptCount: existingEntry.attemptCount + nextEntry.attemptCount,
        correctCount: existingEntry.correctCount + nextEntry.correctCount,
        mistakeCount: existingEntry.mistakeCount + nextEntry.mistakeCount,
        smoothedResponseMs: Math.round(
          (existingEntry.smoothedResponseMs + nextEntry.smoothedResponseMs) / 2,
        ),
        bestRecentResponseMs:
          existingEntry.bestRecentResponseMs === 0
            ? nextEntry.bestRecentResponseMs
            : Math.min(existingEntry.bestRecentResponseMs, nextEntry.bestRecentResponseMs),
        masteryScore: Math.round((existingEntry.masteryScore + nextEntry.masteryScore) / 2),
        lastSeenAt:
          new Date(existingEntry.lastSeenAt).getTime() > new Date(nextEntry.lastSeenAt).getTime()
            ? existingEntry.lastSeenAt
            : nextEntry.lastSeenAt,
      };
    }

    return accumulator;
  }, {});
}

function describeSelectedCharacter(
  performanceEntry: CharacterPerformanceEntry | undefined,
  selectedCharacter: string | null,
  learnerCharacterProfile?: LearnerCharacterProfile,
) {
  if (!selectedCharacter) {
    return "Pick a focus character to inspect its timing, confidence, and recovery pressure.";
  }

  if (learnerCharacterProfile?.state === "forgotten") {
    return `${selectedCharacter} has faded enough to resurface. Keep it visible in mixed passages until it feels automatic again.`;
  }

  if (learnerCharacterProfile?.state === "shaky") {
    return `${selectedCharacter} is still shaky. Use short clean repetitions and avoid outrunning the current timing ceiling.`;
  }

  if (learnerCharacterProfile && learnerCharacterProfile.hesitationRate >= 0.22) {
    return `${selectedCharacter} is more hesitant than incorrect right now. Keep it in flowing words so speed can settle without turning it into a pure error drill.`;
  }

  if (!performanceEntry) {
    return `${selectedCharacter} is new to this practice window. Expect slower timing until it has enough clean attempts.`;
  }

  if (performanceEntry.mistakeCount >= 4) {
    return `${selectedCharacter} is currently generating too many errors. Slow the rhythm slightly and prioritize cleaner hits over pace.`;
  }

  if (performanceEntry.masteryScore >= 82) {
    return `${selectedCharacter} is stable enough for review. Keep it visible in mixed passages so the speed does not drift back down.`;
  }

  return `${selectedCharacter} is still in reinforcement. The next few lessons should make it more repeatable before the planner expands further.`;
}

function matchesPath(item: SiteNavigationItem, pathname: string) {
  return item.href === pathname || item.aliases?.includes(pathname);
}

function formatLegacyPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatSignedRate(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}wpm`;
}

function formatMetricDelta(value: number | null, suffix: string, digits = 1) {
  if (value === null || Number.isNaN(value) || value === 0) {
    return null;
  }

  return `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}${suffix}`;
}

function metricDeltaClassName(value: number | null) {
  if (value === null || value === 0) {
    return "text-textMuted/72";
  }

  return value > 0 ? "text-[hsl(var(--trend-up))]" : "text-[hsl(var(--trend-down))]";
}

function LegacyIndicatorRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="text-[0.88rem] leading-6 text-textMuted sm:flex sm:items-start sm:gap-3.5">
      <p className="mb-0.5 shrink-0 text-textMuted/82 sm:mb-0 sm:w-[5.75rem] sm:text-right">{label}:</p>
      <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-text">
        {children}
      </div>
    </div>
  );
}

function LegacyKeyBadge({
  value,
  onClick,
  tone = "muted",
  selected = false,
}: {
  value: string;
  onClick?: () => void;
  tone?: "muted" | "active" | "warning";
  selected?: boolean;
}) {
  const baseClassName =
    "inline-flex min-w-[1.55rem] items-center justify-center rounded-[2px] border px-[0.38rem] py-[0.02rem] font-mono text-[0.82rem] leading-6 transition";
  const toneClassName = selected
    ? "border-[hsl(var(--chip-selected-border))] bg-[hsl(var(--chip-selected-background))] text-[hsl(var(--chip-selected-text))]"
    : tone === "active"
      ? "border-[hsl(var(--chip-active-border))] bg-[hsl(var(--chip-active-background))] text-[hsl(var(--chip-active-text))]"
      : tone === "warning"
        ? "border-[hsl(var(--chip-warning-border))] bg-[hsl(var(--chip-warning-background))] text-[hsl(var(--chip-warning-text))]"
        : "border-[hsl(var(--chip-muted-border))] bg-[hsl(var(--chip-muted-background))] text-[hsl(var(--chip-muted-text))]";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={classNames(
          baseClassName,
          toneClassName,
          "hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))]",
        )}
      >
        {value}
      </button>
    );
  }

  return (
    <span className={classNames(baseClassName, toneClassName)}>{value}</span>
  );
}

function UtilitySidebarSection({
  label,
  children,
  testId,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="space-y-1 border-t border-borderTone/35 pt-2.5 first:border-t-0 first:pt-0"
    >
      <h3 className="text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-textMuted/76">
        {label}
      </h3>
      <div className="space-y-1 text-[0.72rem] leading-[1.35] text-textMuted">{children}</div>
    </section>
  );
}

function UtilitySidebarDisclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-borderTone/35 pt-2.5 first:border-t-0 first:pt-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-textMuted/76 [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span className="text-[0.78rem] tracking-normal text-textMuted/52 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-2 space-y-1.5 text-[0.72rem] leading-[1.35] text-textMuted">{children}</div>
    </details>
  );
}

function SidebarValueRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2.5">
      <span className="text-textMuted/74">{label}</span>
      <span className="text-right font-medium text-text">{value}</span>
    </div>
  );
}

function UtilitySidebarSelect({
  label,
  value,
  onChange,
  children,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[0.62rem] uppercase tracking-[0.18em] text-textMuted/72">
        {label}
      </span>
      <select
        data-testid={testId}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[0.35rem] border border-borderTone/60 bg-panelSolid px-2 py-1.5 text-[0.76rem] text-text shadow-[inset_0_1px_0_hsl(var(--text)/0.08)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))]"
      >
        {children}
      </select>
    </label>
  );
}

function formatDifficultyBandLabel(difficultyBand: ContentDifficultyBand) {
  return difficultyBand
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function describeDifficultyProgression(options: {
  contentFamilyId: string;
  difficultyBand: ContentDifficultyBand;
  regressionHold: boolean;
  forgottenCount: number;
  confusionPairCount: number;
  introductionCount: number;
  reviewCount: number;
}) {
  if (options.regressionHold || options.forgottenCount > 0) {
    return "Density is being held a little steadier while recovery keys cycle back into view.";
  }

  if (options.confusionPairCount > 0) {
    return "The lesson is adding extra contrast because recent confusions still need cleaner separation.";
  }

  if (options.contentFamilyId === "shell-drills") {
    return options.difficultyBand === "foundational"
      ? "Shell output stays on short commands, simple paths, and clean flags first."
      : options.difficultyBand === "expert-control"
        ? "Shell output is now mixing pipes, redirects, denser flags, and longer command chains."
        : "Shell output is widening into quotes, redirects, and more layered command shapes.";
  }

  if (options.contentFamilyId === "number-drills") {
    return options.difficultyBand === "foundational"
      ? "Number work stays on cleaner integers, short times, and readable separators first."
      : options.difficultyBand === "expert-control"
        ? "Number work is mixing timestamps, ratios, coordinates, currencies, and denser separators."
        : "Number work is broadening into mixed formats, decimals, grouped values, and longer patterns.";
  }

  if (options.contentFamilyId === "symbol-drills") {
    return options.difficultyBand === "foundational"
      ? "Symbol work stays on balanced pairs and short clusters before it gets denser."
      : options.difficultyBand === "expert-control"
        ? "Symbol work is now pushing denser chains, tighter nesting, and mixed operator families."
        : "Symbol work is adding more alternation, pairing pressure, and mixed punctuation families.";
  }

  if (options.contentFamilyId === "phrase-drills" || options.contentFamilyId === "quote-drills") {
    return options.introductionCount > 0
      ? "New characters are entering in readable clauses while review material stays mixed underneath."
      : "Phrase density is climbing through broader clauses and punctuation instead of simple length alone.";
  }

  if (options.reviewCount > 0) {
    return "Review pressure is still present, so the planner is mixing recovery and fluency rather than only lengthening the lesson.";
  }

  return "Recent stability is letting the planner broaden structure, punctuation, and variety rather than only adding more words.";
}

function PracticeUtilitySidebar({
  pathname,
  selectedLanguageId,
  onLanguageChange,
  selectedContentFamilyId,
  onContentFamilyChange,
  showKeyDetails,
  showExtendedInsights,
  selectedCharacter,
  selectedCharacterPerformance,
  selectedCharacterProfile,
  recentAdaptiveSessions,
  adaptivePlan,
  lessonMeta,
  selectedContentFamilyLabel,
  adaptiveLessonPreferenceLabel,
  adaptiveLessonReason,
  keyboardContextLabel,
  currentDifficultyBand,
  introductionCharacters,
  reviewCharacters,
  progressionReason,
}: {
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
  adaptivePlan: {
    activeCharacterSet: string[];
    unlockPreviewCharacters: string[];
    progressionSummary: {
      currentStageIndex: number;
      totalStages: number;
    };
  };
  lessonMeta: {
    languageLabel: string;
    keyboardLayoutLabel: string;
    inputMode: string;
    whitespaceLabel: string;
    viewLabel: string;
  };
  selectedContentFamilyLabel: string;
  adaptiveLessonPreferenceLabel: string | null;
  adaptiveLessonReason: string | null;
  keyboardContextLabel: string | null;
  currentDifficultyBand: ContentDifficultyBand;
  introductionCharacters: string[];
  reviewCharacters: string[];
  progressionReason: string;
}) {
  const compactPrimaryItems = primaryNavigationItems.filter((item) =>
    ["/", "/typing-test", "/layouts", "/profile", "/help"].includes(item.href),
  );

  return (
    <div
      data-testid="practice-utility-strip"
      className="grid gap-3 rounded-[0.95rem] border border-borderTone/45 bg-[hsl(var(--surface-raised)/0.72)] px-4 py-3.5 shadow-[0_1px_0_hsl(var(--text)/0.08)] sm:grid-cols-2 lg:grid-cols-3 min-[1280px]:max-h-[calc(100svh-8rem)] min-[1280px]:w-[8.75rem] min-[1280px]:grid-cols-1 min-[1280px]:overflow-y-auto min-[1280px]:rounded-none min-[1280px]:border-0 min-[1280px]:bg-transparent min-[1280px]:px-0 min-[1280px]:py-0 min-[1280px]:shadow-none"
    >
      <div className="space-y-2.5">
        <UtilitySidebarSection label={buildMetadata.name}>
          <div className="space-y-0.5 text-[0.7rem] leading-5">
            <p className="font-semibold uppercase tracking-[0.24em] text-text">{buildMetadata.name}</p>
            <p className="font-medium text-text">{lessonMeta.languageLabel}</p>
            <p>{lessonMeta.keyboardLayoutLabel}</p>
            {keyboardContextLabel ? <p className="text-textMuted/76">{keyboardContextLabel}</p> : null}
          </div>
        </UtilitySidebarSection>

        <UtilitySidebarSection label="Language">
          <UtilitySidebarSelect
            label="Practice language"
            value={selectedLanguageId}
            onChange={onLanguageChange}
            testId="practice-language-select"
          >
            {languageOptions.map((languageOption) => (
              <option key={languageOption.id} value={languageOption.id}>
                {languageOption.label} · {languageOption.nativeLabel}
              </option>
            ))}
          </UtilitySidebarSelect>
          <p className="pt-0.5 text-[0.68rem] leading-[1.45]">
            Changes here apply immediately to the prompt, keyboard context, and active progression profile.
          </p>
        </UtilitySidebarSection>

        <UtilitySidebarSection label="Lesson">
          <SidebarValueRow label="Source" value={selectedContentFamilyLabel} />
          {adaptiveLessonPreferenceLabel ? (
            <SidebarValueRow label="Shape" value={adaptiveLessonPreferenceLabel} />
          ) : null}
          <SidebarValueRow label="Band" value={formatDifficultyBandLabel(currentDifficultyBand)} />
          <SidebarValueRow label="View" value={lessonMeta.viewLabel} />
          <SidebarValueRow label="Spaces" value={lessonMeta.whitespaceLabel} />
          <SidebarValueRow label="Input" value={lessonMeta.inputMode} />
          {adaptiveLessonReason ? (
            <p className="pt-0.5 text-[0.68rem] leading-[1.45]">{adaptiveLessonReason}</p>
          ) : null}
        </UtilitySidebarSection>
      </div>

      <div className="space-y-2.5">
        <UtilitySidebarSection label="Modes">
          <div className="space-y-1">
            {getAdaptiveContentFamilies().map((contentFamily) => (
              <button
                key={contentFamily.id}
                type="button"
                onClick={() => onContentFamilyChange(contentFamily.id)}
                className={classNames(
                  "block text-left text-[0.74rem] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))]",
                  selectedContentFamilyId === contentFamily.id
                    ? "font-medium text-text"
                    : "text-textMuted hover:text-text",
                )}
              >
                {contentFamily.shortLabel}
              </button>
            ))}
          </div>
        </UtilitySidebarSection>

        {showKeyDetails ? (
          <UtilitySidebarSection label="Key details" testId="practice-key-detail-panel">
            <SidebarValueRow label="Key" value={selectedCharacter ?? "?"} />
            <SidebarValueRow
              label="Mastery"
              value={
                selectedCharacterPerformance
                  ? `${selectedCharacterPerformance.masteryScore}%`
                  : "new"
              }
            />
            <SidebarValueRow
              label="Mistakes"
              value={selectedCharacterPerformance ? String(selectedCharacterPerformance.mistakeCount) : "0"}
            />
            <SidebarValueRow
              label="Response"
              value={
                selectedCharacterPerformance
                  ? `${selectedCharacterPerformance.smoothedResponseMs} ms`
                  : "n/a"
              }
            />
            <p className="pt-0.5 text-[0.68rem] leading-[1.45]">
              {describeSelectedCharacter(
                selectedCharacterPerformance,
                selectedCharacter,
                selectedCharacterProfile,
              )}
            </p>
          </UtilitySidebarSection>
        ) : null}
      </div>

      <div className="space-y-2.5">
        {showExtendedInsights ? (
          <UtilitySidebarDisclosure label="History">
            <div data-testid="practice-extended-insights" className="space-y-1.5">
              <SidebarValueRow
                label="Stage"
                value={`${adaptivePlan.progressionSummary.currentStageIndex + 1}/${adaptivePlan.progressionSummary.totalStages}`}
              />
              <SidebarValueRow
                label="Introduce"
                value={introductionCharacters.length > 0 ? introductionCharacters.join(" ") : "none"}
              />
              <SidebarValueRow
                label="Review"
                value={reviewCharacters.length > 0 ? reviewCharacters.join(" ") : "light"}
              />
              <SidebarValueRow
                label="Preview"
                value={
                  adaptivePlan.unlockPreviewCharacters.length > 0
                    ? adaptivePlan.unlockPreviewCharacters.join(" ")
                    : "none"
                }
              />
              <p className="text-[0.68rem] leading-[1.45]">{progressionReason}</p>
              {recentAdaptiveSessions.length === 0 ? (
                <p>Finish a few local lessons to build recent history.</p>
              ) : (
                recentAdaptiveSessions.slice(0, 3).map((sessionRecord) => (
                  <div key={sessionRecord.sessionId} className="space-y-0.5">
                    <p className="font-medium text-text">{formatRate(sessionRecord.netWpm)} net WPM</p>
                    <p>
                      {formatPercent(sessionRecord.accuracy)} accuracy
                      {" · "}
                      {formatRelativeSessionDate(sessionRecord.endedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </UtilitySidebarDisclosure>
        ) : null}

        <UtilitySidebarDisclosure label="Links">
          <nav className="space-y-1.5">
            {compactPrimaryItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  "block text-[0.76rem] transition",
                  matchesPath(item, pathname) ? "text-text" : "text-textMuted hover:text-text",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="space-y-1 border-t border-borderTone/30 pt-2">
            {utilityNavigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block text-[0.72rem] text-textMuted transition hover:text-text"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </UtilitySidebarDisclosure>
      </div>
    </div>
  );
}

const practiceGuideSteps = [
  {
    title: "Adaptive lessons stay targeted",
    body: "Each practice passage is generated from your recent character timing, accuracy, and unlock state. Recovery keys stay visible until they settle, while stable keys fall back into review.",
  },
  {
    title: "Normal, compact, and bare mirror classic practice density",
    body: "Normal keeps the keyboard and guided details visible, compact reduces the chrome, and bare strips the screen down to the essential typing surface.",
  },
  {
    title: "Focus characters explain the lesson goal",
    body: "Priority, recovery, preview, and review strips show why the generated prompt looks the way it does. Tap a character chip to inspect it in more detail.",
  },
  {
    title: "Content families change the feel of the lesson",
    body: "You can switch between words, pseudo-words, phrases, symbols, numbers, code, and shell drills without leaving the practice page.",
  },
];

const practiceViewModes = [
  { id: "full", label: "Normal" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Bare" },
] as const;

function responseMsToWpm(responseMs: number) {
  if (responseMs <= 0) {
    return 0;
  }

  return 12000 / responseMs;
}

function averageCharacterSpeed(sessionRecords: SessionRecord[], character: string | null) {
  if (!character) {
    return null;
  }

  const matchingEntries = sessionRecords
    .map((sessionRecord) => sessionRecord.perCharacterPerformance[character])
    .filter((entry): entry is CharacterPerformanceEntry => entry !== undefined);

  if (matchingEntries.length === 0) {
    return null;
  }

  return (
    matchingEntries.reduce(
      (sum, entry) =>
        sum + responseMsToWpm(entry.bestRecentResponseMs || entry.smoothedResponseMs),
      0,
    ) / matchingEntries.length
  );
}

function formatWhitespaceLabel(whitespaceStyle: "none" | "bar" | "bullet") {
  return whitespaceStyle === "none"
    ? "none"
    : whitespaceStyle === "bar"
      ? "bar"
      : "bullet";
}

function LegacyToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-textMuted transition hover:bg-[hsl(var(--text)/0.08)] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))]"
    >
      {children}
    </button>
  );
}

export function AdaptivePracticeScreen() {
  const pathname = usePathname();
  const { preferences, hydrated, patchPreferences } = usePracticePreferencesState();
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [learnerProgressProfile, setLearnerProgressProfile] =
    useState<LearnerProgressProfile | null>(null);
  const [practicePresentationMode, setPracticePresentationMode] =
    useState<PracticePresentationMode>("full");
  const [promptRevision, setPromptRevision] = useState(0);
  const [promptText, setPromptText] = useState("");
  const [emphasizedCharacters, setEmphasizedCharacters] = useState<string[]>([]);
  const [generatedContentMetrics, setGeneratedContentMetrics] =
    useState<SessionContentMetrics | null>(null);
  const [selectedInsightCharacter, setSelectedInsightCharacter] = useState<string | null>(null);
  const [practiceGuideOpen, setPracticeGuideOpen] = useState(false);
  const depressedKeys = useDepressedKeys();
  const { keyboardInset } = useTouchInputSupport();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void listSessionRecords().then(setSessionRecords);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || preferences.practiceGuideDismissed || !preferences.onboardingComplete) {
      return;
    }

    setPracticeGuideOpen(true);
  }, [hydrated, preferences.onboardingComplete, preferences.practiceGuideDismissed]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    setPracticePresentationMode(preferences.practicePresentationMode);
  }, [hydrated, preferences.practicePresentationMode]);

  const characterPerformanceMap = useMemo(
    () => aggregateCharacterPerformanceMap(sessionRecords),
    [sessionRecords],
  );
  const adaptivePlan = useMemo(
    () =>
      planAdaptiveSession({
        characterPerformanceMap,
        preferences,
        recentSessions: sessionRecords.slice(0, 24),
        learnerProgressProfile,
      }),
    [characterPerformanceMap, learnerProgressProfile, preferences, sessionRecords],
  );
  const languageDefinition = getLanguageDefinition(preferences.selectedLanguageId);
  const selectedContentFamily = getContentFamily(preferences.preferredContentFamilyId);
  const adaptivePlanReference = useRef(adaptivePlan);
  const sessionRecordsReference = useRef(sessionRecords);
  const passageContentFamilyId = selectedContentFamily.id;
  const effectiveSessionFlavor =
    selectedContentFamily.id === "adaptive-blend"
      ? adaptivePlan.suggestedFlavor
      : selectedContentFamily.sessionFlavor;
  const effectiveContentSourceBias =
    selectedContentFamily.id === "adaptive-blend" ? "mixed" : selectedContentFamily.contentSourceBias;
  const effectivePunctuationEnabled = preferences.punctuationEnabled;
  const effectiveCapitalizationEnabled = preferences.capitalizationEnabled;

  useEffect(() => {
    adaptivePlanReference.current = adaptivePlan;
  }, [adaptivePlan]);

  useEffect(() => {
    sessionRecordsReference.current = sessionRecords;
  }, [sessionRecords]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let cancelled = false;

    async function refreshLearnerProgressProfile() {
      const progressionProfileId = [
        preferences.selectedLanguageId,
        preferences.selectedKeyboardLayoutId,
        preferences.selectedInputMode,
        preferences.programmerModeEnabled ? "programmer" : "general",
      ].join(":");
      const storedLearnerProgressProfile = await readLearnerProgressProfile(progressionProfileId);
      const nextLearnerProgressProfile = evaluateLearnerProgressProfile({
        existingProfile: storedLearnerProgressProfile,
        preferences,
        recentSessions: sessionRecords,
      });

      await saveLearnerProgressProfile(nextLearnerProgressProfile);

      if (!cancelled) {
        setLearnerProgressProfile(nextLearnerProgressProfile);
      }
    }

    void refreshLearnerProgressProfile();

    return () => {
      cancelled = true;
    };
  }, [hydrated, preferences, sessionRecords]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let cancelled = false;

    async function refreshPrompt() {
      const legacyPromptCharacterSet =
        selectedContentFamily.id === "adaptive-blend"
          ? new Set([...languageDefinition.letters, ...languageDefinition.uppercaseLetters])
          : null;
      const filterPromptCharacters = (characters: string[]) => {
        if (!legacyPromptCharacterSet) {
          return characters;
        }

        const filteredCharacters = characters.filter((character) =>
          legacyPromptCharacterSet.has(character),
        );

        return filteredCharacters.length > 0 ? filteredCharacters : characters;
      };
      const currentAdaptivePlan = adaptivePlanReference.current;
      const currentSessionRecords = sessionRecordsReference.current;
      const filteredActiveCharacterSet = filterPromptCharacters(currentAdaptivePlan.activeCharacterSet);
      const difficultyBand = currentAdaptivePlan.contentDifficultyBandsByFamily[passageContentFamilyId];
      const contentBundle = await loadLanguageContentBundle({
        languageId: preferences.selectedLanguageId,
        contentFamilyId: passageContentFamilyId,
        activeCharacterSet: filteredActiveCharacterSet,
        punctuationEnabled: effectivePunctuationEnabled,
        difficultyBand,
        targetWordCount: preferences.passageWordGoal,
      });

      if (cancelled) {
        return;
      }

      const generatedPassage = generatePracticePassage({
        languageId: preferences.selectedLanguageId,
        targetWordCount: preferences.passageWordGoal,
        sessionFlavor: effectiveSessionFlavor,
        priorityCharacters: filterPromptCharacters(currentAdaptivePlan.priorityCharacters),
        recoveryCharacters: filterPromptCharacters(currentAdaptivePlan.recoveryCharacters),
        reinforcementCharacters: filterPromptCharacters(currentAdaptivePlan.reinforcementCharacters),
        bridgeCharacters: filterPromptCharacters(currentAdaptivePlan.bridgeCharacters),
        newCharacters: filterPromptCharacters(currentAdaptivePlan.newCharacters),
        shakyCharacters: filterPromptCharacters(currentAdaptivePlan.shakyCharacters),
        forgottenCharacters: filterPromptCharacters(currentAdaptivePlan.forgottenCharacters),
        hesitationCharacters: filterPromptCharacters(currentAdaptivePlan.hesitationCharacters),
        confusionPairs: currentAdaptivePlan.confusionPairs,
        explorationCharacters: filterPromptCharacters(currentAdaptivePlan.explorationCharacters),
        fluencyCharacters: filterPromptCharacters(currentAdaptivePlan.fluencyCharacters),
        stableReviewCharacters: filterPromptCharacters(currentAdaptivePlan.stableReviewCharacters),
        overtrainedCharacters: filterPromptCharacters(currentAdaptivePlan.overtrainedCharacters),
        unlockPreviewCharacters: filterPromptCharacters(currentAdaptivePlan.unlockPreviewCharacters),
        activeCharacterSet: filteredActiveCharacterSet,
        contentSourceBias: effectiveContentSourceBias,
        contentFamilyId: passageContentFamilyId,
        punctuationEnabled: effectivePunctuationEnabled,
        capitalizationEnabled: effectiveCapitalizationEnabled,
        keyboardLayoutId: preferences.selectedKeyboardLayoutId,
        numpadPracticeEnabled: preferences.numpadEnabled,
        lessonBalance: currentAdaptivePlan.lessonBalance,
        programmerDrillPresetId: selectedContentFamily.programmerPresetId,
        difficultyBand,
        recentSessions: currentSessionRecords,
        contentBundle,
        adaptiveLessonPreference:
          passageContentFamilyId === "adaptive-blend"
            ? currentAdaptivePlan.adaptiveLessonPreference
            : undefined,
      });

      if (cancelled) {
        return;
      }

      setPromptText(generatedPassage.text);
      setEmphasizedCharacters(generatedPassage.emphasizedCharacters);
      setGeneratedContentMetrics(generatedPassage.contentMetrics);
    }

    void refreshPrompt();

    return () => {
      cancelled = true;
    };
  }, [
    adaptivePlan,
    effectiveCapitalizationEnabled,
    effectiveContentSourceBias,
    effectivePunctuationEnabled,
    effectiveSessionFlavor,
    hydrated,
    languageDefinition.letters,
    languageDefinition.uppercaseLetters,
    passageContentFamilyId,
    preferences.numpadEnabled,
    preferences.passageWordGoal,
    preferences.programmerModeEnabled,
    preferences.selectedKeyboardLayoutId,
    preferences.selectedLanguageId,
    promptRevision,
    sessionRecords,
    selectedContentFamily.id,
    selectedContentFamily.programmerPresetId,
  ]);

  useEffect(() => {
    const nextInsightCharacter =
      adaptivePlan.focusCharacter ??
      adaptivePlan.priorityCharacters[0] ??
      adaptivePlan.recoveryCharacters[0] ??
      adaptivePlan.activeCharacterSet[0] ??
      null;

    setSelectedInsightCharacter((currentCharacter) =>
      currentCharacter && adaptivePlan.activeCharacterSet.includes(currentCharacter)
        ? currentCharacter
        : nextInsightCharacter,
    );
  }, [
    adaptivePlan.activeCharacterSet,
    adaptivePlan.focusCharacter,
    adaptivePlan.priorityCharacters,
    adaptivePlan.recoveryCharacters,
  ]);

  const selectedCharacterPerformance = selectedInsightCharacter
    ? characterPerformanceMap[selectedInsightCharacter]
    : undefined;
  const selectedCharacterProfile = selectedInsightCharacter
    ? learnerProgressProfile?.characterProfiles?.[selectedInsightCharacter]
    : undefined;
  const recentAdaptiveSessions = sessionRecords
    .filter((sessionRecord) => sessionRecord.sessionKind === "adaptive")
    .slice(0, 5);
  const lastAdaptiveSession = recentAdaptiveSessions[0] ?? null;

  const typingSession = useTypingSession({
    promptText,
    sessionKind: "adaptive",
    sessionFlavor: effectiveSessionFlavor,
    inputMode: preferences.selectedInputMode,
    expectedScriptFamily: languageDefinition.scriptFamily,
    spaceSkipsWords: preferences.spaceSkipsWords,
    masterySpeedGoal: preferences.masterySpeedGoal,
    onComplete: async (completionPayload) => {
      const scoringOutput = scoreTypingSession({
        promptText: completionPayload.promptText,
        typedText: completionPayload.typedText,
        attemptLog: completionPayload.attemptLog,
        correctedErrorCount: completionPayload.correctedErrorCount,
        startedAt: completionPayload.startedAt,
        endedAt: completionPayload.endedAt,
        masterySpeedGoal: preferences.masterySpeedGoal,
      });

      const sessionRecord: SessionRecord = {
        sessionId: `adaptive-${Date.now()}`,
        sessionKind: "adaptive",
        sessionFlavor: effectiveSessionFlavor,
        contentFamilyId: preferences.preferredContentFamilyId,
        languageId: preferences.selectedLanguageId,
        keyboardFamilyId: preferences.selectedKeyboardFamilyId,
        keyboardLayoutId: preferences.selectedKeyboardLayoutId,
        inputMode: preferences.selectedInputMode,
        promptText: completionPayload.promptText,
        typedText: completionPayload.typedText,
        startedAt: completionPayload.startedAt,
        endedAt: completionPayload.endedAt,
        completed: completionPayload.completed,
        priorityCharacters: adaptivePlan.priorityCharacters,
        activeCharacterSet: adaptivePlan.activeCharacterSet,
        unlockedCharacters: adaptivePlan.unlockedCharacters,
        progressionStageIndex: adaptivePlan.progressionSummary.currentStageIndex,
        attemptLog: completionPayload.attemptLog,
        perCharacterPerformance: scoringOutput.perCharacterPerformance,
        programmerDrillPresetId: selectedContentFamily.programmerPresetId,
        contentMetrics: generatedContentMetrics ?? undefined,
        ...scoringOutput.metrics,
      };

      await saveSessionRecord(sessionRecord);
      const nextSessions = await listSessionRecords();
      setSessionRecords(nextSessions);
      setPromptRevision((revision) => revision + 1);
    },
  });

  if (!hydrated) {
    return null;
  }

  const showKeyboard = practicePresentationMode === "full";
  const showExtendedInsights = practicePresentationMode === "full";
  const showUtilitySidebar = practicePresentationMode !== "minimal";
  const showAllKeysRow = practicePresentationMode !== "minimal";
  const showCurrentKeyRow = practicePresentationMode !== "minimal";
  const currentKeyWpm = selectedCharacterPerformance
    ? responseMsToWpm(selectedCharacterPerformance.bestRecentResponseMs || selectedCharacterPerformance.smoothedResponseMs)
    : 0;
  const currentKeyConfidence = selectedCharacterPerformance
    ? (selectedCharacterPerformance.masteryScore / 100).toFixed(2)
    : "0.00";
  const recentFocusSpeed = averageCharacterSpeed(
    recentAdaptiveSessions.slice(0, 3),
    selectedInsightCharacter,
  );
  const olderFocusSpeed = averageCharacterSpeed(
    recentAdaptiveSessions.slice(3, 6),
    selectedInsightCharacter,
  );
  const currentKeyLearningRate =
    recentFocusSpeed == null
      ? 0
      : Number((recentFocusSpeed - (olderFocusSpeed ?? recentFocusSpeed)).toFixed(1));
  const masteryTargetWpm = responseMsToWpm(preferences.masterySpeedGoal);
  const estimatedRemainingLessons =
    selectedCharacterPerformance == null
      ? null
      : selectedCharacterPerformance.masteryScore >= 92
        ? 0
        : currentKeyLearningRate > 0.2
          ? Math.max(1, Math.ceil(Math.max(0, masteryTargetWpm - currentKeyWpm) / currentKeyLearningRate))
          : null;
  const topAdaptiveSpeed = recentAdaptiveSessions.length
    ? Math.max(...recentAdaptiveSessions.map((sessionRecord) => sessionRecord.netWpm))
    : typingSession.previewScore.metrics.netWpm;
  const currentViewIndex = practiceViewModes.findIndex(
    (mode) => mode.id === practicePresentationMode,
  );
  const nextViewMode =
    practiceViewModes[(currentViewIndex + 1) % practiceViewModes.length]?.id ?? "full";
  const keyboardLayout = getKeyboardLayout(preferences.selectedKeyboardLayoutId);
  const keyboardContext = resolveLanguageKeyboardContext({
    languageId: preferences.selectedLanguageId,
    inputMode: preferences.selectedInputMode,
  });
  const inputLanguageWarning = typingSession.inputLanguageMismatch
    ? buildInputLanguageMismatchWarning({
        expectedLanguageLabel: languageDefinition.label,
        expectedInputLabel: keyboardContext.overlayShortLabel ?? languageDefinition.label,
        mismatch: typingSession.inputLanguageMismatch,
      })
    : null;
  const currentDifficultyBand =
    adaptivePlan.contentDifficultyBandsByFamily[preferences.preferredContentFamilyId];
  const introductionCharacters = Array.from(
    new Set([...adaptivePlan.newCharacters, ...adaptivePlan.unlockPreviewCharacters]),
  ).slice(0, 4);
  const reviewCharacters = Array.from(
    new Set([...adaptivePlan.recoveryCharacters, ...adaptivePlan.hesitationCharacters]),
  ).slice(0, 4);
  const progressionReason = describeDifficultyProgression({
    contentFamilyId: preferences.preferredContentFamilyId,
    difficultyBand: currentDifficultyBand,
    regressionHold: adaptivePlan.progressionSummary.regressionHold,
    forgottenCount: adaptivePlan.progressionSummary.forgottenCount,
    confusionPairCount: adaptivePlan.progressionSummary.confusionPairCount,
    introductionCount: introductionCharacters.length,
    reviewCount: reviewCharacters.length,
  });
  const lessonMeta = {
    languageLabel: languageDefinition.label,
    keyboardLayoutLabel: keyboardLayout.label,
    inputMode: preferences.selectedInputMode,
    whitespaceLabel: formatWhitespaceLabel(preferences.whitespaceStyle),
    viewLabel: practiceViewModes[currentViewIndex]?.label ?? "Normal",
  };
  const speedDelta = lastAdaptiveSession
    ? Number((typingSession.previewScore.metrics.netWpm - lastAdaptiveSession.netWpm).toFixed(1))
    : null;
  const accuracyDelta = lastAdaptiveSession
    ? Number((typingSession.previewScore.metrics.accuracy - lastAdaptiveSession.accuracy).toFixed(2))
    : null;
  const utilitySidebar = (
    <PracticeUtilitySidebar
      pathname={pathname}
      selectedLanguageId={preferences.selectedLanguageId}
      onLanguageChange={(selectedLanguageId) => {
        if (selectedLanguageId === preferences.selectedLanguageId) {
          return;
        }

        typingSession.resetSession();
        setLearnerProgressProfile(null);
        patchPreferences({ selectedLanguageId });
        setPromptRevision((revision) => revision + 1);
      }}
      selectedContentFamilyId={preferences.preferredContentFamilyId}
      onContentFamilyChange={(preferredContentFamilyId) =>
        patchPreferences({
          preferredContentFamilyId: preferredContentFamilyId as typeof preferences.preferredContentFamilyId,
        })
      }
      showKeyDetails={practicePresentationMode !== "minimal"}
      showExtendedInsights={showExtendedInsights}
      selectedCharacter={selectedInsightCharacter}
      selectedCharacterPerformance={selectedCharacterPerformance}
      selectedCharacterProfile={selectedCharacterProfile}
      recentAdaptiveSessions={recentAdaptiveSessions}
      adaptivePlan={adaptivePlan}
      lessonMeta={lessonMeta}
      selectedContentFamilyLabel={selectedContentFamily.label}
      adaptiveLessonPreferenceLabel={
        selectedContentFamily.id === "adaptive-blend"
          ? getContentFamily(adaptivePlan.adaptiveLessonPreference).shortLabel
          : null
      }
      adaptiveLessonReason={
        selectedContentFamily.id === "adaptive-blend" ? adaptivePlan.adaptiveLessonReason : null
      }
      keyboardContextLabel={keyboardContext.overlayLabel ?? keyboardContext.suggestedLabel}
      currentDifficultyBand={currentDifficultyBand}
      introductionCharacters={introductionCharacters}
      reviewCharacters={reviewCharacters}
      progressionReason={progressionReason}
    />
  );

  return (
    <>
      <div
        className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--canvas-top)),hsl(var(--canvas-bottom)))] text-text"
      >
        <div className="mx-auto w-full max-w-[90rem] px-4 pb-12 pt-5 sm:px-6 sm:pt-6">
          <div className="sticky top-3 z-20 mb-3 -mx-1 overflow-x-auto px-1 pb-1 min-[1280px]:static min-[1280px]:mx-0 min-[1280px]:overflow-visible min-[1280px]:px-0 min-[1280px]:pb-0 min-[1280px]:pr-[0.75rem]">
            <div className="flex w-max min-w-full items-center justify-end gap-1.5 rounded-[0.55rem] border border-borderTone/55 bg-[hsl(var(--surface-raised)/0.9)] px-2 py-1 shadow-[0_1px_0_hsl(var(--text)/0.08)] backdrop-blur-sm min-[1280px]:w-auto min-[1280px]:bg-[hsl(var(--surface-raised)/0.7)] min-[1280px]:backdrop-blur-none">
              <LegacyToolbarButton title="Show guided tour" onClick={() => setPracticeGuideOpen(true)}>
                <CircleHelp className="h-4 w-4" />
              </LegacyToolbarButton>
              <LegacyToolbarButton title="Reset lesson" onClick={() => typingSession.resetSession()}>
                <Undo2 className="h-4 w-4" />
              </LegacyToolbarButton>
              <LegacyToolbarButton
                title="Skip lesson"
                onClick={() => {
                  typingSession.resetSession();
                  setPromptRevision((revision) => revision + 1);
                }}
              >
                <Redo2 className="h-4 w-4" />
              </LegacyToolbarButton>
              <LegacyToolbarButton
                title={`Switch view (${practiceViewModes[currentViewIndex]?.label ?? "Normal"})`}
                onClick={() => {
                  setPracticePresentationMode(nextViewMode);
                  patchPreferences({
                    practicePresentationMode: nextViewMode as typeof preferences.practicePresentationMode,
                  });
                }}
              >
                <Maximize2 className="h-4 w-4" />
              </LegacyToolbarButton>
              <Link
                href="/settings"
                className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-surfaceStrong px-3 text-[0.82rem] font-medium text-surfaceStrongText transition hover:bg-[hsl(var(--surface-strong-hover))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))]"
              >
                <Settings2 className="h-4 w-4" />
                Settings...
              </Link>
            </div>
          </div>

          <section className="relative flex flex-col min-[1280px]:min-h-[calc(100svh-7.75rem)] min-[1280px]:block">
            {showUtilitySidebar ? (
              <aside className="order-2 mt-6 w-full min-[1280px]:absolute min-[1280px]:right-0 min-[1280px]:top-4 min-[1280px]:z-10 min-[1280px]:mt-0 min-[1280px]:w-[8.75rem]">
                {utilitySidebar}
              </aside>
            ) : null}

            <div
              data-testid="practice-main-column"
              className={classNames(
                "order-1 mx-auto flex min-h-[calc(100svh-8.75rem)] w-full max-w-[56rem] flex-col justify-center gap-4 pb-2 pt-2",
                practicePresentationMode === "compact" && "max-w-[54rem] gap-4",
                practicePresentationMode === "minimal" && "max-w-[52rem] gap-3",
              )}
            >
              <div className="space-y-1">
                <LegacyIndicatorRow label="Metrics">
                  <span>
                    Speed:{" "}
                    <strong className="font-medium text-text">
                      {formatRate(typingSession.previewScore.metrics.netWpm)}wpm
                    </strong>
                    {speedDelta !== null ? (
                      <span className={classNames("ml-1.5", metricDeltaClassName(speedDelta))}>
                        ({formatMetricDelta(speedDelta, "wpm")})
                      </span>
                    ) : null}
                  </span>
                  <span>
                    Accuracy:{" "}
                    <strong className="font-medium text-text">
                      {formatLegacyPercent(typingSession.previewScore.metrics.accuracy)}
                    </strong>
                    {accuracyDelta !== null ? (
                      <span className={classNames("ml-1.5", metricDeltaClassName(accuracyDelta))}>
                        ({formatMetricDelta(accuracyDelta, "%", 2)})
                      </span>
                    ) : null}
                  </span>
                  <span>
                    Recent:{" "}
                    <strong className="font-medium text-text">
                      {formatRate(lastAdaptiveSession?.netWpm ?? typingSession.previewScore.metrics.netWpm)}wpm
                    </strong>
                  </span>
                  <span>
                    Top:{" "}
                    <strong className="font-medium text-text">{formatRate(topAdaptiveSpeed)}wpm</strong>
                  </span>
                </LegacyIndicatorRow>

                {showAllKeysRow ? (
                  <LegacyIndicatorRow label="All keys">
                    <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap pb-0.5">
                      <div className="inline-flex items-center gap-1">
                        {adaptivePlan.unlockedCharacters.slice(0, 26).map((character) => (
                          <LegacyKeyBadge
                            key={`all-key-${character}`}
                            value={character}
                            onClick={() => setSelectedInsightCharacter(character)}
                            tone={
                              adaptivePlan.recoveryCharacters.includes(character)
                                ? "warning"
                                : adaptivePlan.priorityCharacters.includes(character)
                                  ? "active"
                                  : "muted"
                            }
                            selected={selectedInsightCharacter === character}
                          />
                        ))}
                      </div>
                    </div>
                  </LegacyIndicatorRow>
                ) : null}

                {showCurrentKeyRow ? (
                  <LegacyIndicatorRow label="Current key">
                    <LegacyKeyBadge value={selectedInsightCharacter ?? "?"} selected />
                    <span>
                      Best typing speed:{" "}
                      <strong className="font-medium text-text">{formatRate(currentKeyWpm)}wpm</strong>
                    </span>
                    <span>
                      Confidence level:{" "}
                      <strong className="font-medium text-text">{currentKeyConfidence}</strong>
                    </span>
                    <span>
                      Learning rate:{" "}
                      <strong className="font-medium text-text">
                        {formatSignedRate(currentKeyLearningRate)}
                      </strong>
                    </span>
                    {estimatedRemainingLessons !== null ? (
                      <span>
                        Settle:{" "}
                        <strong className="font-medium text-text">
                          {estimatedRemainingLessons === 0
                            ? "stable"
                            : `${estimatedRemainingLessons} lessons`}
                        </strong>
                      </span>
                    ) : null}
                  </LegacyIndicatorRow>
                ) : null}

              </div>

              <TypingSurface
                promptText={promptText}
                typedText={typingSession.typedText}
                inputValue={typingSession.inputValue}
                onTypedTextChange={typingSession.handleTextChange}
                onCompositionStart={typingSession.handleCompositionStart}
                onCompositionUpdate={typingSession.handleCompositionUpdate}
                onCompositionEnd={typingSession.handleCompositionEnd}
                sessionMetrics={typingSession.previewScore.metrics}
                remainingMs={typingSession.remainingMs}
                languageId={languageDefinition.id}
                localeTag={languageDefinition.localeTag}
                scriptFamily={languageDefinition.scriptFamily}
                direction={languageDefinition.direction}
                keyboardInset={preferences.touchOptimizationEnabled ? keyboardInset : 0}
                statusMessage={typingSession.statusMessage}
                warningMessage={inputLanguageWarning}
                onRestart={() => typingSession.resetSession()}
                onSkip={() => {
                  typingSession.resetSession();
                  setPromptRevision((revision) => revision + 1);
                }}
                inputMode={preferences.selectedInputMode}
                imeProfile={languageDefinition.imeProfile}
                presentationMode={practicePresentationMode}
                whitespaceStyle={preferences.whitespaceStyle}
                showStatTiles={false}
                showSessionControls={false}
                showProgressBar={false}
                showReadyMessage={false}
                capturePaused={practiceGuideOpen}
                promptWrapperClassName={classNames(
                  "mx-auto w-full max-w-[56rem] min-h-[9rem]",
                  practicePresentationMode === "compact" && "max-w-[54rem] min-h-[8rem]",
                  practicePresentationMode === "minimal" && "max-w-[52rem] min-h-[7rem]",
                )}
                promptBoardClassName={classNames(
                  "max-w-none px-0 text-[clamp(1.86rem,2.5vw,2.32rem)] font-medium text-text",
                  languageDefinition.direction === "rtl" ||
                    languageDefinition.scriptFamily === "hiragana" ||
                    languageDefinition.scriptFamily === "thai" ||
                    languageDefinition.scriptFamily === "devanagari"
                    ? "font-sans leading-[1.5] tracking-[0]"
                    : "font-mono leading-[1.24] tracking-[-0.012em]",
                  practicePresentationMode === "compact" && "text-[clamp(1.72rem,2.15vw,1.98rem)]",
                  practicePresentationMode === "compact" &&
                    (languageDefinition.direction === "rtl" ||
                    languageDefinition.scriptFamily === "hiragana" ||
                    languageDefinition.scriptFamily === "thai" ||
                    languageDefinition.scriptFamily === "devanagari"
                      ? "leading-[1.48]"
                      : "leading-[1.24]"),
                  practicePresentationMode === "minimal" &&
                    "py-3 text-[clamp(1.9rem,2.35vw,2.16rem)] sm:py-4",
                  practicePresentationMode === "minimal" &&
                    (languageDefinition.direction === "rtl" ||
                    languageDefinition.scriptFamily === "hiragana" ||
                    languageDefinition.scriptFamily === "thai" ||
                    languageDefinition.scriptFamily === "devanagari"
                      ? "leading-[1.52]"
                      : "leading-[1.22]"),
                )}
              />

              {showKeyboard ? (
                <div className="mx-auto w-full max-w-[44rem]" data-testid="practice-keyboard-shell">
                  <KeyboardSurface
                    layoutId={preferences.selectedKeyboardLayoutId}
                    languageId={preferences.selectedLanguageId}
                    highlightedCharacters={emphasizedCharacters}
                    depressedKeyCodes={depressedKeys}
                    includeNumpad={preferences.numpadEnabled}
                    appearance="classic"
                    className="opacity-[0.86]"
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <PracticeGuideDialog
        open={practiceGuideOpen}
        onClose={() => {
          setPracticeGuideOpen(false);
          patchPreferences({ practiceGuideDismissed: true });
        }}
        steps={practiceGuideSteps}
      />
    </>
  );
}
