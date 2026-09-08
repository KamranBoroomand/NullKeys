import {
  buildKeyboardTrainingProfile,
  getKeyboardLayout,
  keyboardLayouts,
} from "@/features/keyboard-visualizer/keyboard-layout-registry";
import { getLanguageDefinition } from "@/features/language-support/language-registry";

export interface LayoutAnalysisSummary {
  layoutId: string;
  label: string;
  homeRowShare: number;
  topRowShare: number;
  bottomRowShare: number;
  numberRowShare: number;
  alternationShare: number;
  sameHandShare: number;
  sameFingerShare: number;
  directSymbolShare: number;
  handBalanceDelta: number;
  coverageShare: number;
  numpadReady: boolean;
  modifierCount: number;
  keyHeatmapValues: Record<string, number>;
  rowUsage: Array<{ label: string; value: number }>;
  handUsage: Array<{ label: string; value: number }>;
  fingerUsage: Array<{ label: string; value: number }>;
}

function buildLanguageCorpus(languageId: string) {
  const languageDefinition = getLanguageDefinition(languageId);
  return `${languageDefinition.sampleSentence} ${languageDefinition.wordBank.join(" ")}`.toLowerCase();
}

function roundPercent(value: number) {
  return Number((value * 100).toFixed(1));
}

export function analyzeKeyboardLayout(options: {
  layoutId: string;
  languageId: string;
}) {
  const keyboardLayout = getKeyboardLayout(options.layoutId);
  const keyboardTrainingProfile = buildKeyboardTrainingProfile(
    options.layoutId,
    options.languageId,
  );
  const corpus = Array.from(buildLanguageCorpus(options.languageId));
  const trackedCharacters = corpus.filter((character) => character.trim().length > 0);
  const bigrams = trackedCharacters.slice(1).map((character, index) => [
    trackedCharacters[index],
    character,
  ]);
  let trackedCharacterCount = 0;
  let homeRowHits = 0;
  let topRowHits = 0;
  let bottomRowHits = 0;
  let numberRowHits = 0;
  let directSymbolHits = 0;
  const keyHeatmapValues = new Map<string, number>();
  const rowUsage = new Map<string, number>();
  const handUsage = new Map<string, number>();
  const fingerUsage = new Map<string, number>();

  for (const character of trackedCharacters) {
    const keyMetadata = Object.values(keyboardTrainingProfile.keyMetadataMap).find((metadata) =>
      metadata.characters.includes(character),
    );

    if (!keyMetadata) {
      continue;
    }

    trackedCharacterCount += 1;
    keyHeatmapValues.set(
      keyMetadata.code,
      (keyHeatmapValues.get(keyMetadata.code) ?? 0) + 1,
    );
    rowUsage.set(keyMetadata.rowZone, (rowUsage.get(keyMetadata.rowZone) ?? 0) + 1);
    handUsage.set(keyMetadata.handZone, (handUsage.get(keyMetadata.handZone) ?? 0) + 1);
    fingerUsage.set(keyMetadata.fingerZone, (fingerUsage.get(keyMetadata.fingerZone) ?? 0) + 1);

    if (keyMetadata.rowZone === "home") {
      homeRowHits += 1;
    }

    if (keyMetadata.rowZone === "top") {
      topRowHits += 1;
    }

    if (keyMetadata.rowZone === "bottom") {
      bottomRowHits += 1;
    }

    if (keyMetadata.rowZone === "number") {
      numberRowHits += 1;
    }

    if (
      keyboardTrainingProfile.programmerSymbolCharacters.includes(character) &&
      keyMetadata.symbolAccess === "direct"
    ) {
      directSymbolHits += 1;
    }
  }

  let comparableBigramCount = 0;
  let sameHandHits = 0;
  let sameFingerHits = 0;
  let alternationHits = 0;

  for (const [leftCharacter, rightCharacter] of bigrams) {
    const leftMetadata = Object.values(keyboardTrainingProfile.keyMetadataMap).find((metadata) =>
      metadata.characters.includes(leftCharacter),
    );
    const rightMetadata = Object.values(keyboardTrainingProfile.keyMetadataMap).find((metadata) =>
      metadata.characters.includes(rightCharacter),
    );

    if (!leftMetadata || !rightMetadata) {
      continue;
    }

    comparableBigramCount += 1;

    if (leftMetadata.handZone === rightMetadata.handZone) {
      sameHandHits += 1;
    } else {
      alternationHits += 1;
    }

    if (leftMetadata.fingerZone === rightMetadata.fingerZone) {
      sameFingerHits += 1;
    }
  }

  const leftHandShare = handUsage.get("left") ?? 0;
  const rightHandShare = handUsage.get("right") ?? 0;

  return {
    layoutId: keyboardLayout.id,
    label: keyboardLayout.label,
    homeRowShare: roundPercent(homeRowHits / Math.max(trackedCharacterCount, 1)),
    topRowShare: roundPercent(topRowHits / Math.max(trackedCharacterCount, 1)),
    bottomRowShare: roundPercent(bottomRowHits / Math.max(trackedCharacterCount, 1)),
    numberRowShare: roundPercent(numberRowHits / Math.max(trackedCharacterCount, 1)),
    alternationShare: roundPercent(alternationHits / Math.max(comparableBigramCount, 1)),
    sameHandShare: roundPercent(sameHandHits / Math.max(comparableBigramCount, 1)),
    sameFingerShare: roundPercent(sameFingerHits / Math.max(comparableBigramCount, 1)),
    directSymbolShare: roundPercent(
      directSymbolHits / Math.max(keyboardTrainingProfile.programmerSymbolCharacters.length, 1),
    ),
    handBalanceDelta: roundPercent(
      Math.abs(leftHandShare - rightHandShare) / Math.max(trackedCharacterCount, 1),
    ),
    coverageShare: roundPercent(trackedCharacterCount / Math.max(trackedCharacters.length, 1)),
    numpadReady: keyboardTrainingProfile.supportsNumpad,
    modifierCount: keyboardTrainingProfile.modifierKeyCodes.length,
    keyHeatmapValues: Object.fromEntries(
      Array.from(keyHeatmapValues.entries()).map(([code, value]) => [
        code,
        Number((value / Math.max(trackedCharacterCount, 1)).toFixed(4)),
      ]),
    ),
    rowUsage: Array.from(rowUsage.entries()).map(([label, value]) => ({
      label,
      value: roundPercent(value / Math.max(trackedCharacterCount, 1)),
    })),
    handUsage: Array.from(handUsage.entries()).map(([label, value]) => ({
      label,
      value: roundPercent(value / Math.max(trackedCharacterCount, 1)),
    })),
    fingerUsage: Array.from(fingerUsage.entries()).map(([label, value]) => ({
      label,
      value: roundPercent(value / Math.max(trackedCharacterCount, 1)),
    })),
  } satisfies LayoutAnalysisSummary;
}

export function buildLayoutAnalysisTable(languageId: string) {
  return keyboardLayouts
    .map((keyboardLayout) =>
      analyzeKeyboardLayout({
        layoutId: keyboardLayout.id,
        languageId,
      }),
    )
    .sort((left, right) => right.homeRowShare - left.homeRowShare);
}
