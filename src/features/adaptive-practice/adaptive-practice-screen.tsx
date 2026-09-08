"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Maximize2, Redo2, Settings2, Undo2 } from "lucide-react";
import { KeyboardSurface } from "@/components/keyboard/keyboard-surface";
import { PracticeGuideDialog } from "@/components/practice/practice-guide-dialog";
import { TypingSurface } from "@/components/practice/typing-surface";
import { PreferencesHydrationShell } from "@/components/shared/preferences-hydration-shell";
import { ActionButton } from "@/components/shared/action-button";
import { planAdaptiveSession } from "@/features/adaptive-practice/adaptive-planner";
import {
  aggregateCharacterPerformanceMap,
  averageCharacterSpeed,
  describeDifficultyProgression,
  formatLegacyPercent,
  formatMetricDelta,
  formatSignedRate,
  formatWhitespaceLabel,
  LegacyIndicatorRow,
  LegacyKeyBadge,
  LegacyToolbarButton,
  metricDeltaClassName,
  PracticeUtilitySidebar,
  practiceGuideSteps,
  practiceViewModes,
  responseMsToWpm,
} from "@/features/adaptive-practice/adaptive-practice-support";
import { evaluateLearnerProgressProfile } from "@/features/adaptive-practice/learner-progression";
import { generatePracticePassage } from "@/features/adaptive-practice/passage-generator";
import { getContentFamily } from "@/features/content-families/content-family-registry";
import { loadLanguageContentBundle } from "@/features/content-packs/content-pack-loader";
import { getLanguageDefinition } from "@/features/language-support/language-registry";
import {
  getKeyboardLayout,
} from "@/features/keyboard-visualizer/keyboard-layout-registry";
import { resolveLanguageKeyboardContext } from "@/features/keyboard-visualizer/language-keyboard-support";
import type { PracticePresentationMode } from "@/features/user-preferences/preferences-schema";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import {
  listSessionRecords,
  readLearnerProgressProfile,
  saveLearnerProgressProfile,
  saveSessionRecord,
} from "@/lib/persistence/session-repository";
import { buildInputLanguageMismatchWarning } from "@/lib/input/input-language-mismatch";
import { useDepressedKeys } from "@/lib/input/use-depressed-keys";
import { useTouchInputSupport } from "@/lib/input/use-touch-input-support";
import { useTypingSession } from "@/lib/input/use-typing-session";
import { scoreTypingSession } from "@/lib/scoring/session-scorer";
import {
  buildSessionDatasets,
  CURRENT_ANALYTICS_VERSION,
  CURRENT_SCORING_VERSION,
} from "@/lib/scoring/session-validity";
import type {
  LearnerProgressProfile,
  SessionContentMetrics,
  SessionRecord,
} from "@/lib/scoring/session-models";
import { formatRate } from "@/lib/utils/formatting";
import { classNames } from "@/lib/utils/class-names";

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

    void listSessionRecords().then((records) =>
      setSessionRecords(buildSessionDatasets(records).learnerModel),
    );
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
    focusLossPolicy: "pause",
    onComplete: async (completionPayload) => {
      const scoringOutput = scoreTypingSession({
        promptText: completionPayload.promptText,
        typedText: completionPayload.typedText,
        attemptLog: completionPayload.attemptLog,
        correctedErrorCount: completionPayload.correctedErrorCount,
        startedAt: completionPayload.startedAt,
        endedAt: completionPayload.endedAt,
        durationMs: completionPayload.activeElapsedMs,
        masterySpeedGoal: preferences.masterySpeedGoal,
      });

      const sessionRecord: SessionRecord = {
        sessionId: completionPayload.sessionId,
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
        completionReason: completionPayload.completionReason,
        integrity: completionPayload.integrity,
        promptCompleted: completionPayload.promptCompleted,
        analyticsEligible: completionPayload.analyticsEligible,
        rankingEligible: completionPayload.rankingEligible,
        learnerModelEligible: completionPayload.learnerModelEligible,
        activeElapsedMs: completionPayload.activeElapsedMs,
        pausedDurationMs: completionPayload.pausedDurationMs,
        scoringVersion: CURRENT_SCORING_VERSION,
        analyticsVersion: CURRENT_ANALYTICS_VERSION,
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
      setSessionRecords(buildSessionDatasets(nextSessions).learnerModel);
      setPromptRevision((revision) => revision + 1);
    },
  });

  if (!hydrated) {
    return (
      <PreferencesHydrationShell
        eyebrow="Practice"
        title="Adaptive practice"
        description="Focused local lessons adapt to eligible saved typing history."
      />
    );
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
        <a id="skip-to-main-content" href="#main-content" className="sr-only z-50 rounded-md bg-panel px-4 py-2 text-text focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
        <h1 className="sr-only">Adaptive typing practice</h1>
        <div className="mx-auto w-full max-w-[90rem] px-4 pb-12 pt-5 sm:px-6 sm:pt-6">
          <div className="sticky top-3 z-20 mb-3 pb-1 xl:static xl:pb-0 xl:pr-[0.75rem]">
            <div className="flex w-full flex-wrap items-center justify-between gap-1.5 rounded-[0.55rem] border border-borderTone/55 bg-[hsl(var(--surface-raised)/0.9)] px-2 py-1 shadow-[0_1px_0_hsl(var(--text)/0.08)] backdrop-blur-sm xl:justify-end xl:bg-[hsl(var(--surface-raised)/0.7)] xl:backdrop-blur-none">
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
                className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-surfaceStrong px-2.5 text-[0.82rem] font-medium text-surfaceStrongText transition hover:bg-[hsl(var(--surface-strong-hover))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))] sm:px-3"
              >
                <Settings2 className="h-4 w-4" />
                Settings
              </Link>
            </div>
          </div>

          <main id="main-content" tabIndex={-1} className="relative flex flex-col xl:block">
            {showUtilitySidebar ? (
              <aside className="order-2 mt-6 w-full xl:absolute xl:right-0 xl:top-4 xl:z-10 xl:mt-0 xl:w-[14rem]">
                {utilitySidebar}
              </aside>
            ) : null}

            <div
              data-testid="practice-main-column"
              className={classNames(
                "order-1 mx-auto flex w-full max-w-[56rem] flex-col gap-4 pb-3 pt-2",
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

              {typingSession.persistenceStatus === "save-failed" ? (
                <div className="mx-auto w-full max-w-[56rem] rounded-[0.45rem] border border-warn/45 bg-warn/10 px-4 py-3 text-sm leading-6 text-textMuted" role="alert">
                  <p className="font-semibold text-text">This lesson result is still in memory.</p>
                  <p>Retry the on-device save before leaving so eligible practice is not lost.</p>
                  <ActionButton tone="secondary" onClick={() => typingSession.retrySave()}>
                    Retry save
                  </ActionButton>
                </div>
              ) : null}

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
          </main>
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
