import { classNames } from "@/lib/utils/class-names";
import { getLanguageKeyboardLegendOverrides } from "@/features/keyboard-visualizer/language-keyboard-support";
import {
  buildKeyboardTrainingProfile,
  getKeyboardLayout,
  type KeyboardKeyDefinition,
  type KeyboardTrainingKeyMetadata,
} from "@/features/keyboard-visualizer/keyboard-layout-registry";

interface KeyboardSurfaceProps {
  layoutId: string;
  languageId?: string;
  highlightedCharacters: readonly string[];
  depressedKeyCodes: string[];
  includeNumpad?: boolean;
  className?: string;
  heatmapValues?: Record<string, number>;
  appearance?: "default" | "classic";
}

interface KeyboardSectionLayout {
  width: number;
  height: number;
  rows: Array<{
    keys: Array<{
      keyDefinition: KeyboardKeyDefinition;
      metadata: KeyboardTrainingKeyMetadata | undefined;
      x: number;
      y: number;
      width: number;
      height: number;
      isSpacer: boolean;
    }>;
  }>;
}

type SectionKind = "function" | "main" | "numpad";

const standardKeyUnit = 46;
const touchKeyUnit = 42;
const standardGap = 5;
const touchGap = 4;

function isFunctionRow(row: KeyboardKeyDefinition[]) {
  return row.every(
    (keyDefinition) => keyDefinition.code === "Escape" || /^F\d+$/.test(keyDefinition.code),
  );
}

function isNumpadRow(row: KeyboardKeyDefinition[]) {
  return row.every((keyDefinition) => keyDefinition.code.startsWith("Numpad"));
}

function isSpacerKey(keyDefinition: KeyboardKeyDefinition) {
  return (
    keyDefinition.code.startsWith("SplitGap") ||
    keyDefinition.code === "ThumbGap" ||
    keyDefinition.primary === "·"
  );
}

function getGapAfterKey(
  previousKeyDefinition: KeyboardKeyDefinition | undefined,
  gap: number,
  sectionKind: SectionKind,
) {
  if (!previousKeyDefinition) {
    return 0;
  }

  if (
    sectionKind === "function" &&
    ["Escape", "F4", "F8"].includes(previousKeyDefinition.code)
  ) {
    return gap * 2.4;
  }

  return gap;
}

function measureRow(
  row: KeyboardKeyDefinition[],
  keyUnit: number,
  gap: number,
  sectionKind: SectionKind,
) {
  return row.reduce((width, keyDefinition, index) => {
    const previousKeyDefinition = index > 0 ? row[index - 1] : undefined;
    return (
      width +
      (keyDefinition.width ?? 1) * keyUnit +
      getGapAfterKey(previousKeyDefinition, gap, sectionKind)
    );
  }, 0);
}

function getMainRowOffsets(geometryKind: string, rowCount: number) {
  const offsets =
    geometryKind === "touch"
      ? [0, 0.22, 0.44, 0.86, 0.26]
      : geometryKind === "apple"
        ? [0, 0.16, 0.34, 0.58, 0.24]
        : geometryKind === "iso"
          ? [0, 0.24, 0.42, 0.72, 0.3]
          : geometryKind === "ortholinear"
            ? [0, 0, 0, 0, 0]
            : geometryKind === "split"
              ? [0, 0.08, 0.18, 0.36, 0.18]
              : [0, 0.2, 0.38, 0.7, 0.28];

  return offsets.slice(0, rowCount);
}

function buildSectionLayout({
  rows,
  keyUnit,
  keyHeight,
  gap,
  metadataMap,
  align,
  sectionKind,
  rowOffsets,
}: {
  rows: KeyboardKeyDefinition[][];
  keyUnit: number;
  keyHeight: number;
  gap: number;
  metadataMap: Record<string, KeyboardTrainingKeyMetadata>;
  align: "left" | "center";
  sectionKind: SectionKind;
  rowOffsets: number[];
}): KeyboardSectionLayout {
  const rawRowWidths = rows.map((row) => measureRow(row, keyUnit, gap, sectionKind));
  const offsetRowWidths = rawRowWidths.map(
    (rowWidth, rowIndex) => rowWidth + (rowOffsets[rowIndex] ?? 0) * keyUnit,
  );
  const width = offsetRowWidths.length === 0 ? 0 : Math.max(...offsetRowWidths);

  return {
    width,
    height: rows.length === 0 ? 0 : rows.length * keyHeight + (rows.length - 1) * gap,
    rows: rows.map((row, rowIndex) => {
      const rowWidth = rawRowWidths[rowIndex] ?? 0;
      const rowOffset = (rowOffsets[rowIndex] ?? 0) * keyUnit;
      const xOffset = align === "center" ? (width - rowWidth) / 2 + rowOffset : rowOffset;
      let cursor = xOffset;

      return {
        keys: row.map((keyDefinition, keyIndex) => {
          const previousKeyDefinition = keyIndex > 0 ? row[keyIndex - 1] : undefined;
          if (keyIndex > 0) {
            cursor += getGapAfterKey(previousKeyDefinition, gap, sectionKind);
          }

          const width = (keyDefinition.width ?? 1) * keyUnit;
          const shape = {
            keyDefinition,
            metadata: metadataMap[keyDefinition.code],
            x: cursor,
            y: rowIndex * (keyHeight + gap),
            width,
            height: keyHeight,
            isSpacer: isSpacerKey(keyDefinition),
          };

          cursor += width;
          return shape;
        }),
      };
    }),
  };
}

function toDisplayLabel(keyDefinition: KeyboardKeyDefinition, legendFamily: string) {
  switch (keyDefinition.code) {
    case "Backspace":
      return legendFamily === "apple" ? "Delete" : "Backspace";
    case "CapsLock":
      return "Caps Lock";
    case "ShiftLeft":
    case "ShiftRight":
      return "Shift";
    case "ControlLeft":
    case "ControlRight":
      return legendFamily === "apple" ? "Control" : "Ctrl";
    case "MetaLeft":
    case "MetaRight":
      return legendFamily === "apple" ? "⌘" : legendFamily === "linux" ? "Super" : "Win";
    case "AltLeft":
    case "AltRight":
      return legendFamily === "apple"
        ? "⌥"
        : keyDefinition.primary === "alt gr"
          ? "Alt Gr"
          : "Alt";
    case "Enter":
      return legendFamily === "apple" ? "Return" : "Enter";
    case "NumpadEnter":
      return "Enter";
    case "Space":
      return "space";
    case "Tab":
      return "Tab";
    case "Escape":
      return "Esc";
    case "SymbolMode":
      return keyDefinition.primary;
    case "LanguageMode":
      return "Lang";
    default:
      break;
  }

  if (keyDefinition.primary.length === 1) {
    return keyDefinition.primary.toUpperCase();
  }

  if (/^f\d+$/i.test(keyDefinition.primary)) {
    return keyDefinition.primary.toUpperCase();
  }

  return keyDefinition.primary
    .split(" ")
    .map((part) =>
      part.length <= 2 ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`,
    )
    .join(" ");
}

function getHeatValue(
  keyDefinition: KeyboardKeyDefinition,
  metadata: KeyboardTrainingKeyMetadata | undefined,
  heatmapValues: Record<string, number> | undefined,
) {
  if (!heatmapValues) {
    return 0;
  }

  const byCode = heatmapValues[keyDefinition.code] ?? 0;
  const byPrimary = heatmapValues[keyDefinition.primary.toLowerCase()] ?? 0;
  const bySecondary = heatmapValues[(keyDefinition.secondary ?? "").toLowerCase()] ?? 0;
  const byMetadata = Math.max(
    0,
    ...(metadata?.characters.map((character) => heatmapValues[character.toLowerCase()] ?? 0) ?? [0]),
  );

  return Math.max(byCode, byPrimary, bySecondary, byMetadata);
}

function getKeyPalette({
  metadata,
  highlighted,
  depressed,
  geometryKind,
  heat,
  appearance,
}: {
  metadata: KeyboardTrainingKeyMetadata | undefined;
  highlighted: boolean;
  depressed: boolean;
  geometryKind: string;
  heat: number;
  appearance: "default" | "classic";
}) {
  if (appearance === "classic") {
    if (depressed) {
      return {
        fill: "hsl(var(--accent) / 0.09)",
        stroke: "hsl(var(--accent) / 0.32)",
        text: "hsl(var(--text) / 0.84)",
        secondaryText: "hsl(var(--text-muted) / 0.68)",
      };
    }

    if (highlighted || heat > 0) {
      return {
        fill: "hsl(var(--accent) / 0.06)",
        stroke: "hsl(var(--accent) / 0.22)",
        text: "hsl(var(--text) / 0.82)",
        secondaryText: "hsl(var(--text-muted) / 0.74)",
      };
    }

    return {
      fill: metadata?.trainingTags.includes("modifier")
        ? "hsl(var(--panel-muted) / 0.13)"
        : "hsl(var(--panel) / 0.11)",
      stroke: "hsl(var(--border-tone) / 0.18)",
      text: "hsl(var(--text) / 0.74)",
      secondaryText: "hsl(var(--text-muted) / 0.62)",
    };
  }

  if (depressed) {
    return {
      fill: "hsl(var(--accent) / 0.34)",
      stroke: "hsl(var(--accent) / 0.95)",
      text: "hsl(var(--text))",
      secondaryText: "hsl(var(--text) / 0.8)",
    };
  }

  if (highlighted) {
    return {
      fill: "hsl(var(--accent) / 0.2)",
      stroke: "hsl(var(--accent) / 0.72)",
      text: "hsl(var(--text))",
      secondaryText: "hsl(var(--text-muted) / 0.96)",
    };
  }

  if (heat > 0) {
    return {
      fill: `hsl(var(--accent) / ${Math.min(0.48, 0.08 + heat * 0.45)})`,
      stroke: `hsl(var(--accent) / ${Math.min(0.82, 0.24 + heat * 0.54)})`,
      text: "hsl(var(--text))",
      secondaryText: "hsl(var(--text-muted) / 0.95)",
    };
  }

  if (geometryKind === "touch") {
    return {
      fill: "hsl(var(--panel) / 0.94)",
      stroke: "hsl(var(--border-tone) / 0.4)",
      text: "hsl(var(--text) / 0.92)",
      secondaryText: "hsl(var(--text-muted) / 0.86)",
    };
  }

  if (metadata?.trainingTags.includes("modifier")) {
    return {
      fill: "hsl(var(--panel-muted) / 0.68)",
      stroke: "hsl(var(--border-tone) / 0.5)",
      text: "hsl(var(--text-muted) / 0.92)",
      secondaryText: "hsl(var(--text-muted) / 0.8)",
    };
  }

  if (metadata?.trainingTags.includes("numpad")) {
    return {
      fill: "hsl(var(--panel) / 0.9)",
      stroke: "hsl(var(--warn) / 0.32)",
      text: "hsl(var(--text) / 0.92)",
      secondaryText: "hsl(var(--text-muted) / 0.82)",
    };
  }

  return {
    fill: "hsl(var(--panel) / 0.88)",
    stroke: "hsl(var(--border-tone) / 0.52)",
    text: "hsl(var(--text) / 0.9)",
    secondaryText: "hsl(var(--text-muted) / 0.85)",
  };
}

function splitLongLabel(primaryLabel: string) {
  if (!primaryLabel.includes(" ") || primaryLabel.length <= 8) {
    return [primaryLabel];
  }

  const parts = primaryLabel.split(" ");
  return parts.length > 2
    ? [`${parts[0]} ${parts[1]}`, parts.slice(2).join(" ")]
    : parts;
}

function renderPrimaryAndSecondaryText({
  primaryLabel,
  secondaryLabel,
  palette,
  x,
  y,
  width,
  height,
  functionRow,
}: {
  primaryLabel: string;
  secondaryLabel?: string;
  palette: ReturnType<typeof getKeyPalette>;
  x: number;
  y: number;
  width: number;
  height: number;
  functionRow: boolean;
}) {
  const paddingX = Math.max(5, width * 0.11);
  const bottomY = y + height - Math.max(7, height * 0.17);
  const topY = y + Math.max(9, height * 0.21);
  const labelLength = Array.from(primaryLabel).length;
  const canSplitLegends =
    Boolean(secondaryLabel) &&
    primaryLabel.length <= 2 &&
    width <= 72 &&
    !functionRow;

  if (canSplitLegends) {
    return (
      <>
        <text
          x={x + paddingX}
          y={topY}
          fontSize={Math.max(8, height * 0.22)}
          fontWeight={500}
          fill={palette.secondaryText}
        >
          {secondaryLabel}
        </text>
        <text
          x={x + paddingX}
          y={bottomY}
          fontSize={Math.max(11, height * 0.28)}
          fontWeight={600}
          fill={palette.text}
        >
          {primaryLabel}
        </text>
      </>
    );
  }

  const longLabelLines = splitLongLabel(primaryLabel);
  if (longLabelLines.length > 1 && width >= 66) {
    return (
      <text
        x={x + width / 2}
        y={y + height / 2 - 6}
        fontSize={Math.max(8, Math.min(height * 0.22, width * 0.14))}
        fontWeight={500}
        textAnchor="middle"
        fill={palette.text}
      >
        <tspan x={x + width / 2} dy="0">
          {longLabelLines[0]}
        </tspan>
        <tspan x={x + width / 2} dy={Math.max(10, height * 0.22)}>
          {longLabelLines[1]}
        </tspan>
      </text>
    );
  }

  if (labelLength > 5) {
    return (
      <text
        x={x + paddingX}
        y={y + height / 2}
        fontSize={Math.max(functionRow ? 8 : 9, Math.min(height * 0.22, width * 0.14))}
        fontWeight={500}
        dominantBaseline="middle"
        fill={palette.text}
        textLength={Math.max(24, width - paddingX * 2)}
        lengthAdjust="spacingAndGlyphs"
      >
        {primaryLabel}
      </text>
    );
  }

  const fontSize =
    labelLength <= 1
      ? Math.min(height * 0.48, width * 0.42)
      : labelLength <= 3
        ? Math.min(height * 0.34, width * 0.24)
        : Math.min(height * 0.24, width * 0.16);

  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + (labelLength <= 1 ? 1 : 0)}
      fontSize={Math.max(functionRow ? 8 : 9, fontSize)}
      fontWeight={labelLength <= 3 ? 600 : 500}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={palette.text}
    >
      {primaryLabel}
    </text>
  );
}

function getGeometryProfile(
  layoutId: string,
  geometryKind: string,
  supportsNumpad: boolean,
  appearance: "default" | "classic",
) {
  const compactBoard = layoutId.includes("compact");
  const fullBoard = layoutId.includes("full") || supportsNumpad;
  const appleBoard = geometryKind === "apple";
  const linuxBoard = geometryKind === "linux";
  const touchBoard = geometryKind === "touch";
  const classicAppearance = appearance === "classic";

  return {
    keyUnit: classicAppearance
      ? touchBoard
        ? touchKeyUnit - 2
        : compactBoard && !appleBoard
          ? standardKeyUnit - 6
          : standardKeyUnit - 4
      : touchBoard
        ? touchKeyUnit
        : compactBoard && !appleBoard
          ? standardKeyUnit - 2
          : standardKeyUnit,
    alphaKeyHeight: classicAppearance ? (touchBoard ? 33 : compactBoard ? 35 : 37) : touchBoard ? 38 : compactBoard ? 40 : 42,
    functionKeyHeight: classicAppearance ? (touchBoard ? 24 : compactBoard ? 26 : 28) : touchBoard ? 30 : compactBoard ? 31 : 34,
    gap: classicAppearance ? Math.max(3, (touchBoard ? touchGap : standardGap) - 1) : touchBoard ? touchGap : standardGap,
    boardPadding:
      classicAppearance
        ? touchBoard
          ? 6
          : appleBoard
            ? 8
            : compactBoard
              ? 9
              : 10
        : touchBoard
          ? 10
          : appleBoard
            ? 14
            : compactBoard
              ? 13
              : 16,
    clusterGap: classicAppearance ? (touchBoard ? 8 : fullBoard ? 18 : 14) : touchBoard ? 10 : fullBoard ? 24 : 18,
    sectionGap: classicAppearance ? (touchBoard ? 8 : compactBoard ? 10 : 12) : touchBoard ? 10 : compactBoard ? 14 : 18,
    boardRadius:
      classicAppearance
        ? touchBoard
          ? 14
          : appleBoard
            ? 11
            : linuxBoard
              ? 8
              : 9
        : touchBoard
          ? 22
          : appleBoard
            ? 20
            : linuxBoard
              ? 12
              : 16,
    keyRadius:
      classicAppearance
        ? touchBoard
          ? 6
          : appleBoard
            ? 3.25
            : linuxBoard
              ? 2
              : 2.25
        : touchBoard
          ? 10
          : appleBoard
            ? 9
            : linuxBoard
              ? 4
              : 6,
    keyInset:
      classicAppearance
        ? touchBoard
          ? 0.65
          : appleBoard
            ? 0.4
            : linuxBoard
              ? 0.25
              : 0.3
        : touchBoard
          ? 1.1
          : appleBoard
            ? 1.2
            : linuxBoard
              ? 1.5
              : 1.35,
    topLipHeight: classicAppearance ? 0 : touchBoard ? 0 : appleBoard ? 6 : compactBoard ? 4 : 5,
    boardAccentStroke: touchBoard
      ? classicAppearance
        ? "hsl(var(--text) / 0.05)"
        : "hsl(var(--text) / 0.07)"
      : appleBoard
        ? "hsl(var(--text) / 0.14)"
        : linuxBoard
          ? "hsl(var(--accent) / 0.22)"
          : "hsl(var(--text) / 0.1)",
    boardShellFill:
      classicAppearance
        ? "hsl(var(--panel-muted) / 0.08)"
        : touchBoard
          ? "hsl(var(--panel-muted) / 0.1)"
          : appleBoard
            ? "hsl(var(--panel-muted) / 0.78)"
            : linuxBoard
              ? "hsl(223 16% 9% / 0.95)"
              : "hsl(var(--panel-muted) / 0.58)",
    boardWellFill:
      classicAppearance
        ? "hsl(var(--panel) / 0.02)"
        : touchBoard
          ? "hsl(var(--panel-muted) / 0.06)"
          : appleBoard
            ? "hsl(var(--panel) / 0.28)"
            : "hsl(var(--panel) / 0.22)",
  };
}

export function KeyboardSurface({
  layoutId,
  languageId,
  highlightedCharacters,
  depressedKeyCodes,
  includeNumpad = true,
  className,
  heatmapValues,
  appearance = "default",
}: KeyboardSurfaceProps) {
  const layout = getKeyboardLayout(layoutId);
  const keyboardTrainingProfile = buildKeyboardTrainingProfile(layoutId, languageId);
  const languageLegendOverrides = getLanguageKeyboardLegendOverrides(languageId);
  const visibleRows = includeNumpad ? layout.rows : layout.rows.filter((row) => !isNumpadRow(row));
  const functionRows = visibleRows.filter(isFunctionRow);
  const numpadRows = visibleRows.filter(isNumpadRow);
  const mainRows = visibleRows.filter((row) => !isFunctionRow(row) && !isNumpadRow(row));
  const geometryKind = keyboardTrainingProfile.geometryKind;
  const profile = getGeometryProfile(layoutId, geometryKind, layout.supportsNumpad, appearance);
  const normalizedHighlights = highlightedCharacters.map((character) => character.toLowerCase());
  const maxHeatValue = Math.max(...Object.values(heatmapValues ?? {}), 1);
  const mainLayout = buildSectionLayout({
    rows: mainRows,
    keyUnit: profile.keyUnit,
    keyHeight: profile.alphaKeyHeight,
    gap: profile.gap,
    metadataMap: keyboardTrainingProfile.keyMetadataMap,
    align: geometryKind === "touch" ? "center" : "left",
    sectionKind: "main",
    rowOffsets: getMainRowOffsets(geometryKind, mainRows.length),
  });
  const functionLayout = buildSectionLayout({
    rows: functionRows,
    keyUnit: profile.keyUnit,
    keyHeight: profile.functionKeyHeight,
    gap: profile.gap,
    metadataMap: keyboardTrainingProfile.keyMetadataMap,
    align: "center",
    sectionKind: "function",
    rowOffsets: Array.from({ length: functionRows.length }, () => 0),
  });
  const numpadLayout = buildSectionLayout({
    rows: numpadRows,
    keyUnit: profile.keyUnit,
    keyHeight: profile.alphaKeyHeight,
    gap: profile.gap,
    metadataMap: keyboardTrainingProfile.keyMetadataMap,
    align: "left",
    sectionKind: "numpad",
    rowOffsets: Array.from({ length: numpadRows.length }, () => 0),
  });

  const lowerClusterTop = functionLayout.height > 0 ? functionLayout.height + profile.sectionGap : 0;
  const totalWidth =
    profile.boardPadding * 2 +
    Math.max(
      functionLayout.width,
      mainLayout.width + (numpadLayout.width > 0 ? profile.clusterGap + numpadLayout.width : 0),
      mainLayout.width,
    );
  const totalHeight =
    profile.boardPadding * 2 +
    lowerClusterTop +
    Math.max(mainLayout.height, numpadLayout.height || 0);
  const mainX = profile.boardPadding;
  const functionX =
    profile.boardPadding + Math.max(0, (totalWidth - profile.boardPadding * 2 - functionLayout.width) / 2);
  const functionY = profile.boardPadding;
  const mainY = profile.boardPadding + lowerClusterTop;
  const numpadX = mainX + mainLayout.width + (numpadLayout.width > 0 ? profile.clusterGap : 0);
  const numpadY = mainY;

  return (
    <div className={classNames("overflow-x-auto", className)}>
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="h-auto min-w-[18rem] w-full"
        aria-label={`${layout.label} keyboard`}
        role="img"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <rect
          x={1}
          y={1}
          width={totalWidth - 2}
          height={totalHeight - 2}
          rx={profile.boardRadius}
          fill={profile.boardShellFill}
          stroke={
            appearance === "classic"
              ? "hsl(var(--border-tone) / 0.12)"
              : "hsl(var(--border-tone) / 0.38)"
          }
        />
        <rect
          x={profile.boardPadding * 0.4}
          y={profile.boardPadding * 0.4}
          width={totalWidth - profile.boardPadding * 0.8}
          height={totalHeight - profile.boardPadding * 0.8}
          rx={Math.max(10, profile.boardRadius - 3)}
          fill={profile.boardWellFill}
          stroke={
            appearance === "classic"
              ? "hsl(var(--border-tone) / 0.05)"
              : "hsl(var(--border-tone) / 0.18)"
          }
        />
        {profile.topLipHeight > 0 ? (
          <path
            d={`M ${profile.boardPadding} ${profile.boardPadding + profile.topLipHeight} H ${totalWidth - profile.boardPadding}`}
            stroke={profile.boardAccentStroke}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        ) : null}

        {[
          { layout: functionLayout, x: functionX, y: functionY, functionRow: true },
          { layout: mainLayout, x: mainX, y: mainY, functionRow: false },
          { layout: numpadLayout, x: numpadX, y: numpadY, functionRow: false },
        ].map(({ layout: section, x: sectionX, y: sectionY, functionRow }, sectionIndex) =>
          section.rows.map((row, rowIndex) =>
            row.keys.map(({ keyDefinition, metadata, x, y, width, height, isSpacer }) => {
              if (isSpacer) {
                return null;
              }

              const highlighted =
                normalizedHighlights.includes(keyDefinition.primary.toLowerCase()) ||
                normalizedHighlights.includes((keyDefinition.secondary ?? "").toLowerCase());
              const depressed = depressedKeyCodes.includes(keyDefinition.code);
              const heat =
                getHeatValue(keyDefinition, metadata, heatmapValues) / Math.max(1, maxHeatValue);
              const palette = getKeyPalette({
                metadata,
                highlighted,
                depressed,
                geometryKind,
                heat,
                appearance,
              });
              const legendOverride = languageLegendOverrides[keyDefinition.code];
              const primaryLabel = toDisplayLabel(
                legendOverride?.primary
                  ? { ...keyDefinition, primary: legendOverride.primary }
                  : keyDefinition,
                keyboardTrainingProfile.modifierLegendFamily,
              );
              const secondaryLabel =
                legendOverride?.secondary ??
                (legendOverride?.primary &&
                keyDefinition.primary.length === 1 &&
                !/^\d$/u.test(keyDefinition.primary)
                  ? keyDefinition.primary.toUpperCase()
                  : keyDefinition.secondary);
              const absoluteX = sectionX + x;
              const absoluteY = sectionY + y;

              return (
                <g key={`${sectionIndex}-${rowIndex}-${keyDefinition.code}`}>
                  <rect
                    x={absoluteX}
                    y={absoluteY}
                    width={width}
                    height={height}
                    rx={profile.keyRadius}
                    fill={palette.fill}
                    stroke={palette.stroke}
                  />
                  <rect
                    x={absoluteX + profile.keyInset}
                    y={absoluteY + profile.keyInset}
                    width={Math.max(0, width - profile.keyInset * 2)}
                    height={Math.max(0, height - profile.keyInset * 2)}
                    rx={Math.max(2, profile.keyRadius - 1.8)}
                    fill={
                      depressed
                        ? "hsl(var(--accent) / 0.06)"
                        : appearance === "classic"
                          ? "hsl(var(--text) / 0.006)"
                          : geometryKind === "apple"
                            ? "hsl(var(--text) / 0.028)"
                            : geometryKind === "linux"
                              ? "hsl(var(--text) / 0.02)"
                              : "hsl(var(--text) / 0.024)"
                    }
                    stroke={
                      appearance === "classic"
                        ? "hsl(var(--text) / 0.008)"
                        : "hsl(var(--text) / 0.035)"
                    }
                  />
                  {renderPrimaryAndSecondaryText({
                    primaryLabel,
                    secondaryLabel,
                    palette,
                    x: absoluteX,
                    y: absoluteY,
                    width,
                    height,
                    functionRow,
                  })}
                  {keyDefinition.code === "KeyF" || keyDefinition.code === "KeyJ" ? (
                    <rect
                      x={absoluteX + width / 2 - Math.min(8, width * 0.14)}
                      y={absoluteY + height - (appearance === "classic" ? 6 : 8)}
                      width={Math.min(16, width * 0.28)}
                      height={appearance === "classic" ? 2 : 3}
                      rx={2}
                      fill={appearance === "classic" ? "hsl(var(--text) / 0.54)" : "hsl(var(--text) / 0.72)"}
                    />
                  ) : null}
                </g>
              );
            }),
          ),
        )}
      </svg>
    </div>
  );
}
