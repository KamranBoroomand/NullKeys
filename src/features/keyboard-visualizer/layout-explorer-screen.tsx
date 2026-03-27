"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyboardSurface } from "@/components/keyboard/keyboard-surface";
import { ActionButton } from "@/components/shared/action-button";
import { FieldLabel, SelectField } from "@/components/shared/form-controls";
import { PageFrame } from "@/components/shared/page-frame";
import { Panel } from "@/components/shared/panel";
import {
  analyzeKeyboardLayout,
  buildLayoutAnalysisTable,
  type LayoutAnalysisSummary,
} from "@/features/keyboard-visualizer/layout-analysis";
import {
  buildKeyboardTrainingProfile,
  keyboardFamilies,
  keyboardLayouts,
} from "@/features/keyboard-visualizer/keyboard-layout-registry";
import {
  getLanguageDefinition,
  languageOptions,
} from "@/features/language-support/language-registry";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import { useDepressedKeys } from "@/lib/input/use-depressed-keys";

const explorerHighlightSets = {
  heat: [],
  letters: Array.from("asdfjkl;"),
  numbers: Array.from("1234567890"),
  modifiers: ["shift", "ctrl", "alt", "cmd", "option", "space"],
  symbols: Array.from("[]{}()<>+-=_/\\"),
  numpad: Array.from("1234567890.+-"),
} as const;

function compositeScore(summary: LayoutAnalysisSummary) {
  return Number(
    (
      summary.homeRowShare * 0.32 +
      summary.alternationShare * 0.24 +
      summary.coverageShare * 0.16 +
      summary.directSymbolShare * 0.12 -
      summary.sameHandShare * 0.16 -
      summary.sameFingerShare * 0.18 -
      summary.handBalanceDelta * 0.08
    ).toFixed(1),
  );
}

function UsageBars({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={`${title}-${item.label}`} className="space-y-1">
            <div className="flex items-center justify-between text-sm text-textMuted">
              <span>{item.label}</span>
              <span>{item.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-panelMuted">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${Math.max(8, (item.value / maxValue) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeltaCard({
  label,
  currentValue,
  comparisonValue,
  higherIsBetter = true,
}: {
  label: string;
  currentValue: number;
  comparisonValue: number;
  higherIsBetter?: boolean;
}) {
  const delta = Number((currentValue - comparisonValue).toFixed(1));
  const favorable = delta === 0 ? null : higherIsBetter ? delta > 0 : delta < 0;

  return (
    <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text">{currentValue}%</p>
      <p className="mt-1 text-xs text-textMuted">
        vs {comparisonValue}% ·{" "}
        <span
          className={
            favorable == null ? "text-textMuted" : favorable ? "text-success" : "text-danger"
          }
        >
          {delta > 0 ? "+" : ""}
          {delta} pts
        </span>
      </p>
    </div>
  );
}

function SandboxCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-sm text-textMuted">{description}</p>
    </div>
  );
}

function normalizeSandboxRow(value: string) {
  return Array.from(new Set(value.toLowerCase().replace(/[^a-zа-яё]/gi, "").split(""))).join("");
}

function buildSandboxInsights({
  languageId,
  topRow,
  homeRow,
  bottomRow,
}: {
  languageId: string;
  topRow: string;
  homeRow: string;
  bottomRow: string;
}) {
  const languageDefinition = getLanguageDefinition(languageId);
  const corpus = `${languageDefinition.sampleSentence} ${languageDefinition.wordBank.join(" ")}`.toLowerCase();
  const frequencyMap = new Map<string, number>();

  for (const character of Array.from(corpus)) {
    if (!/[a-zа-яё]/i.test(character)) {
      continue;
    }

    frequencyMap.set(character, (frequencyMap.get(character) ?? 0) + 1);
  }

  const frequentCharacters = Array.from(frequencyMap.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([character]) => character);
  const homeRowSet = new Set(homeRow.split(""));
  const topRowSet = new Set(topRow.split(""));
  const bottomRowSet = new Set(bottomRow.split(""));
  const allCharacters = Array.from(new Set([...topRowSet, ...homeRowSet, ...bottomRowSet]));
  const leftCount = Math.ceil(homeRow.length / 2) + Math.ceil(topRow.length / 2) + Math.ceil(bottomRow.length / 2);
  const rightCount =
    Math.floor(homeRow.length / 2) + Math.floor(topRow.length / 2) + Math.floor(bottomRow.length / 2);

  return {
    homeRowCoverage: frequentCharacters.filter((character) => homeRowSet.has(character)).length,
    topRowCoverage: frequentCharacters.filter((character) => topRowSet.has(character)).length,
    bottomRowCoverage: frequentCharacters.filter((character) => bottomRowSet.has(character)).length,
    missingFrequentCharacters: frequentCharacters.filter((character) => !allCharacters.includes(character)),
    balanceDelta: Math.abs(leftCount - rightCount),
    totalKeys: allCharacters.length,
  };
}

export function LayoutExplorerScreen() {
  const { preferences, hydrated, patchPreferences } = usePracticePreferencesState();
  const depressedKeys = useDepressedKeys();
  const [highlightMode, setHighlightMode] = useState<keyof typeof explorerHighlightSets>("heat");
  const [analysisLanguageId, setAnalysisLanguageId] = useState(preferences.selectedLanguageId);
  const [comparisonLayoutId, setComparisonLayoutId] = useState("");
  const [customTopRow, setCustomTopRow] = useState("qwertyuiop");
  const [customHomeRow, setCustomHomeRow] = useState("asdfghjkl");
  const [customBottomRow, setCustomBottomRow] = useState("zxcvbnm");
  const matchingLayouts = useMemo(
    () =>
      keyboardLayouts.filter(
        (keyboardLayout) => keyboardLayout.familyId === preferences.selectedKeyboardFamilyId,
      ),
    [preferences.selectedKeyboardFamilyId],
  );
  const comparisonCandidates = useMemo(
    () =>
      keyboardLayouts.filter((keyboardLayout) => keyboardLayout.id !== preferences.selectedKeyboardLayoutId),
    [preferences.selectedKeyboardLayoutId],
  );
  const keyboardTrainingProfile = useMemo(
    () =>
      buildKeyboardTrainingProfile(
        preferences.selectedKeyboardLayoutId,
        analysisLanguageId,
      ),
    [analysisLanguageId, preferences.selectedKeyboardLayoutId],
  );
  const selectedLayoutAnalysis = useMemo(
    () =>
      analyzeKeyboardLayout({
        layoutId: preferences.selectedKeyboardLayoutId,
        languageId: analysisLanguageId,
      }),
    [analysisLanguageId, preferences.selectedKeyboardLayoutId],
  );
  const comparedLayoutAnalysis = useMemo(
    () =>
      analyzeKeyboardLayout({
        layoutId: comparisonLayoutId || comparisonCandidates[0]?.id || preferences.selectedKeyboardLayoutId,
        languageId: analysisLanguageId,
      }),
    [analysisLanguageId, comparisonCandidates, comparisonLayoutId, preferences.selectedKeyboardLayoutId],
  );
  const analysisTable = useMemo(
    () =>
      buildLayoutAnalysisTable(analysisLanguageId)
        .map((layoutAnalysis) => ({
          ...layoutAnalysis,
          compositeScore: compositeScore(layoutAnalysis),
        }))
        .sort((left, right) => right.compositeScore - left.compositeScore),
    [analysisLanguageId],
  );
  const sandboxInsights = useMemo(
    () =>
      buildSandboxInsights({
        languageId: analysisLanguageId,
        topRow: normalizeSandboxRow(customTopRow),
        homeRow: normalizeSandboxRow(customHomeRow),
        bottomRow: normalizeSandboxRow(customBottomRow),
      }),
    [analysisLanguageId, customBottomRow, customHomeRow, customTopRow],
  );
  const selectedRank =
    analysisTable.findIndex((layoutAnalysis) => layoutAnalysis.layoutId === preferences.selectedKeyboardLayoutId) + 1;

  useEffect(() => {
    if (comparisonCandidates.length === 0) {
      return;
    }

    if (!comparisonLayoutId || comparisonLayoutId === preferences.selectedKeyboardLayoutId) {
      setComparisonLayoutId(comparisonCandidates[0].id);
    }
  }, [comparisonCandidates, comparisonLayoutId, preferences.selectedKeyboardLayoutId]);

  if (!hydrated) {
    return null;
  }

  return (
    <PageFrame
      title="Layouts"
      eyebrow="Layouts"
      description="This page explains why a layout feels efficient or awkward under a specific language, instead of treating the keyboard as a simple selector."
      themeChoice={preferences.themeChoice}
      onThemeChange={(themeChoice) => patchPreferences({ themeChoice })}
    >
      <div className="space-y-5">
        <Panel className="space-y-4">
          <p className="max-w-4xl text-sm leading-7 text-textMuted">
            These charts and metrics visualize layout efficiency. Home-row share and alternation usually help flow, while same-hand and same-finger repetition usually add friction. The goal is not to declare a universal winner, but to understand what each layout asks of your hands under a real language corpus.
          </p>
          <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-text">Home row</dt>
              <dd className="mt-1 text-sm leading-6 text-textMuted">
                The percentage of keys typed without leaving the home row. Usually the more the better.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-text">Top and bottom rows</dt>
              <dd className="mt-1 text-sm leading-6 text-textMuted">
                Travel-heavy rows. Usually lower percentages are easier to sustain.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-text">Same hand</dt>
              <dd className="mt-1 text-sm leading-6 text-textMuted">
                The percentage of key pairs typed by the same hand. Lower usually means smoother alternation.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-text">Same finger</dt>
              <dd className="mt-1 text-sm leading-6 text-textMuted">
                Repeating the same finger across frequent pairs. Lower values usually feel easier and more stable.
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel title="Keyboard family" description="Switch the active board family without leaving the analysis page." />
              <SelectField
                value={preferences.selectedKeyboardFamilyId}
                onChange={(event) => {
                  const selectedFamilyId = event.target.value;
                  const firstMatchingLayout =
                    keyboardLayouts.find((keyboardLayout) => keyboardLayout.familyId === selectedFamilyId) ??
                    keyboardLayouts[0];

                  patchPreferences({
                    selectedKeyboardFamilyId: selectedFamilyId,
                    selectedKeyboardLayoutId: firstMatchingLayout.id,
                  });
                }}
              >
                {keyboardFamilies.map((keyboardFamily) => (
                  <option key={keyboardFamily.id} value={keyboardFamily.id}>
                    {keyboardFamily.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-2">
              <FieldLabel title="Active layout" description="This is the board used by practice and typing tests right now." />
              <SelectField
                value={preferences.selectedKeyboardLayoutId}
                onChange={(event) => patchPreferences({ selectedKeyboardLayoutId: event.target.value })}
              >
                {matchingLayouts.map((keyboardLayout) => (
                  <option key={keyboardLayout.id} value={keyboardLayout.id}>
                    {keyboardLayout.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-2">
              <FieldLabel title="Comparison layout" description="Compare the active board against another layout under the same language." />
              <SelectField
                value={comparisonLayoutId}
                onChange={(event) => setComparisonLayoutId(event.target.value)}
              >
                {comparisonCandidates.map((keyboardLayout) => (
                  <option key={keyboardLayout.id} value={keyboardLayout.id}>
                    {keyboardLayout.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-2">
              <FieldLabel title="Analysis language" description="Efficiency changes with the corpus, so switch languages to compare fairly." />
              <SelectField
                value={analysisLanguageId}
                onChange={(event) => setAnalysisLanguageId(event.target.value)}
              >
                {languageOptions.map((languageOption) => (
                  <option key={languageOption.id} value={languageOption.id}>
                    {languageOption.label}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Active board</p>
              <h2 className="text-2xl font-semibold text-text">{preferences.selectedKeyboardLayoutId}</h2>
              <p className="mt-1 text-sm text-textMuted">
                Ranked #{Math.max(1, selectedRank || 1)} for {analysisLanguageId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(explorerHighlightSets).map((modeKey) => (
              <ActionButton
                key={modeKey}
                tone={highlightMode === modeKey ? "primary" : "secondary"}
                onClick={() => setHighlightMode(modeKey as keyof typeof explorerHighlightSets)}
              >
                  {modeKey}
                </ActionButton>
              ))}
              <ActionButton
                tone="secondary"
                onClick={() => {
                  if (comparisonLayoutId) {
                    const nextComparisonLayout =
                      keyboardLayouts.find((keyboardLayout) => keyboardLayout.id === comparisonLayoutId) ??
                      keyboardLayouts[0];

                    patchPreferences({
                      selectedKeyboardFamilyId: nextComparisonLayout.familyId,
                      selectedKeyboardLayoutId: nextComparisonLayout.id,
                    });
                  }
                }}
              >
                Use comparison layout
              </ActionButton>
            </div>
          </div>
          <KeyboardSurface
            layoutId={preferences.selectedKeyboardLayoutId}
            languageId={analysisLanguageId}
            highlightedCharacters={explorerHighlightSets[highlightMode]}
            depressedKeyCodes={depressedKeys}
            heatmapValues={
              highlightMode === "heat" ? selectedLayoutAnalysis.keyHeatmapValues : undefined
            }
          />
          <p className="text-sm leading-6 text-textMuted">
            Heat mode paints the board by corpus frequency for {analysisLanguageId}. The other modes let you inspect letters, digits, symbols, modifiers, and numpad paths directly.
          </p>
        </Panel>

        <Panel className="space-y-4" data-testid="layout-comparison-section">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Direct comparison</p>
            <h2 className="text-2xl font-semibold text-text">How the active layout compares</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-sm font-semibold text-text">{preferences.selectedKeyboardLayoutId}</p>
              <KeyboardSurface
                layoutId={preferences.selectedKeyboardLayoutId}
                languageId={analysisLanguageId}
                highlightedCharacters={explorerHighlightSets[highlightMode]}
                depressedKeyCodes={depressedKeys}
                heatmapValues={
                  highlightMode === "heat" ? selectedLayoutAnalysis.keyHeatmapValues : undefined
                }
              />
            </div>
            <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-sm font-semibold text-text">{comparedLayoutAnalysis.layoutId}</p>
              <KeyboardSurface
                layoutId={comparedLayoutAnalysis.layoutId}
                languageId={analysisLanguageId}
                highlightedCharacters={explorerHighlightSets[highlightMode]}
                depressedKeyCodes={[]}
                heatmapValues={
                  highlightMode === "heat" ? comparedLayoutAnalysis.keyHeatmapValues : undefined
                }
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DeltaCard
              label="Home row"
              currentValue={selectedLayoutAnalysis.homeRowShare}
              comparisonValue={comparedLayoutAnalysis.homeRowShare}
            />
            <DeltaCard
              label="Hand alternation"
              currentValue={selectedLayoutAnalysis.alternationShare}
              comparisonValue={comparedLayoutAnalysis.alternationShare}
            />
            <DeltaCard
              label="Same hand"
              currentValue={selectedLayoutAnalysis.sameHandShare}
              comparisonValue={comparedLayoutAnalysis.sameHandShare}
              higherIsBetter={false}
            />
            <DeltaCard
              label="Same finger"
              currentValue={selectedLayoutAnalysis.sameFingerShare}
              comparisonValue={comparedLayoutAnalysis.sameFingerShare}
              higherIsBetter={false}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DeltaCard
              label="Top row"
              currentValue={selectedLayoutAnalysis.topRowShare}
              comparisonValue={comparedLayoutAnalysis.topRowShare}
              higherIsBetter={false}
            />
            <DeltaCard
              label="Bottom row"
              currentValue={selectedLayoutAnalysis.bottomRowShare}
              comparisonValue={comparedLayoutAnalysis.bottomRowShare}
              higherIsBetter={false}
            />
            <DeltaCard
              label="Direct symbols"
              currentValue={selectedLayoutAnalysis.directSymbolShare}
              comparisonValue={comparedLayoutAnalysis.directSymbolShare}
            />
            <DeltaCard
              label="Coverage"
              currentValue={selectedLayoutAnalysis.coverageShare}
              comparisonValue={comparedLayoutAnalysis.coverageShare}
            />
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Usage anatomy</p>
            <h2 className="text-2xl font-semibold text-text">Row, hand, and finger load</h2>
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <UsageBars title="Row usage" items={selectedLayoutAnalysis.rowUsage} />
            <UsageBars title="Hand usage" items={selectedLayoutAnalysis.handUsage} />
            <UsageBars title="Finger usage" items={selectedLayoutAnalysis.fingerUsage} />
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Training implications</p>
            <h2 className="text-2xl font-semibold text-text">Why the layout feels the way it does</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Geometry</p>
              <p className="mt-2 text-sm font-semibold text-text">{keyboardTrainingProfile.geometryKind}</p>
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Locale profile</p>
              <p className="mt-2 text-sm font-semibold text-text">{keyboardTrainingProfile.localeProfile}</p>
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Modifier legends</p>
              <p className="mt-2 text-sm font-semibold text-text">{keyboardTrainingProfile.modifierLegendFamily}</p>
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Numpad ready</p>
              <p className="mt-2 text-sm font-semibold text-text">{keyboardTrainingProfile.supportsNumpad ? "Yes" : "No"}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
              High direct symbol share usually helps code, shell, and punctuation-heavy drills feel more forgiving.
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
              High same-finger share usually means adaptive practice will need longer reinforcement windows because common repetitions stay awkward.
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Language-aware ranking</p>
            <h2 className="text-2xl font-semibold text-text">Relative layout ranking for {analysisLanguageId}</h2>
          </div>
          <div className="space-y-3">
            {analysisTable.slice(0, 8).map((layoutAnalysis, index) => (
              <div
                key={layoutAnalysis.layoutId}
                className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-text">
                    #{index + 1} · {layoutAnalysis.label}
                  </p>
                  <span className="text-[11px] uppercase tracking-[0.22em] text-textMuted">
                    score {layoutAnalysis.compositeScore}
                  </span>
                </div>
                <p className="mt-1 text-sm text-textMuted">
                  Home {layoutAnalysis.homeRowShare}% · Alternation {layoutAnalysis.alternationShare}% · Same finger {layoutAnalysis.sameFingerShare}%
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Design ideas</p>
            <h2 className="text-2xl font-semibold text-text">What to preserve in a custom layout</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
              Keep the most frequent letters close to the home row, but do not improve home-row share by overloading one hand.
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
              Reduce same-finger digraph pressure first. That usually matters more than a tiny row-usage gain.
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
              If you type code or shell text often, symbol placement should be treated as a first-class design constraint.
            </div>
            <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">
              Re-run the comparison under every language you care about. A layout that looks good for English may behave differently elsewhere.
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Custom sandbox</p>
            <h2 className="text-2xl font-semibold text-text">Sketch a custom row plan</h2>
          </div>
          <p className="text-sm leading-7 text-textMuted">
            This local notebook is not a full layout generator. It is a quick way to test whether your proposed rows keep common characters close to home before you invest in a larger redesign.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <FieldLabel title="Top row" description="Enter the letters you want on the top row." />
              <input
                value={customTopRow}
                onChange={(event) => setCustomTopRow(event.target.value)}
                className="w-full rounded-md border border-borderTone/70 bg-panel px-3 py-2 text-sm text-text outline-none transition focus:border-accent/35"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel title="Home row" description="Keep the most common characters here when possible." />
              <input
                value={customHomeRow}
                onChange={(event) => setCustomHomeRow(event.target.value)}
                className="w-full rounded-md border border-borderTone/70 bg-panel px-3 py-2 text-sm text-text outline-none transition focus:border-accent/35"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel title="Bottom row" description="Use the bottom row for the remainder of the alphabet." />
              <input
                value={customBottomRow}
                onChange={(event) => setCustomBottomRow(event.target.value)}
                className="w-full rounded-md border border-borderTone/70 bg-panel px-3 py-2 text-sm text-text outline-none transition focus:border-accent/35"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SandboxCard
              label="Home frequent letters"
              value={`${sandboxInsights.homeRowCoverage}/12`}
              description="Common letters placed on the home row."
            />
            <SandboxCard
              label="Top frequent letters"
              value={`${sandboxInsights.topRowCoverage}/12`}
              description="Common letters still living on the top row."
            />
            <SandboxCard
              label="Bottom frequent letters"
              value={`${sandboxInsights.bottomRowCoverage}/12`}
              description="Common letters pushed down to the bottom row."
            />
            <SandboxCard
              label="Left-right imbalance"
              value={String(sandboxInsights.balanceDelta)}
              description="Lower is usually easier to balance."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <h3 className="text-lg font-semibold text-text">Custom rows</h3>
              {[normalizeSandboxRow(customTopRow), normalizeSandboxRow(customHomeRow), normalizeSandboxRow(customBottomRow)].map((row, index) => (
                <div key={`${row}-${index}`} className="flex flex-wrap gap-2">
                  {row.split("").map((character) => (
                    <span
                      key={`${row}-${character}`}
                      className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-borderTone/70 bg-panel px-2 text-sm text-text"
                    >
                      {character}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
              <h3 className="text-lg font-semibold text-text">Sandbox notes</h3>
              <p className="text-sm leading-6 text-textMuted">
                Current sketch covers {sandboxInsights.totalKeys} unique letters. Missing frequent letters:{" "}
                {sandboxInsights.missingFrequentCharacters.length > 0
                  ? sandboxInsights.missingFrequentCharacters.join(", ")
                  : "none from the top frequency band"}
                .
              </p>
              <p className="text-sm leading-6 text-textMuted">
                Home-row coverage is the fastest signal for comfort, but same-finger collisions and hand imbalance still matter more than chasing a perfect score in one metric.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}
