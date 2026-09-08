const standardKeyUnit = 46;
const touchKeyUnit = 42;
const standardGap = 5;
const touchGap = 4;

export function getKeyboardGeometryProfile(
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
      ? touchBoard ? touchKeyUnit - 2 : compactBoard && !appleBoard ? standardKeyUnit - 6 : standardKeyUnit - 4
      : touchBoard ? touchKeyUnit : compactBoard && !appleBoard ? standardKeyUnit - 2 : standardKeyUnit,
    alphaKeyHeight: classicAppearance
      ? touchBoard ? 33 : compactBoard ? 35 : 37
      : touchBoard ? 38 : compactBoard ? 40 : 42,
    functionKeyHeight: classicAppearance
      ? touchBoard ? 24 : compactBoard ? 26 : 28
      : touchBoard ? 30 : compactBoard ? 31 : 34,
    gap: classicAppearance
      ? Math.max(3, (touchBoard ? touchGap : standardGap) - 1)
      : touchBoard ? touchGap : standardGap,
    boardPadding: classicAppearance
      ? touchBoard ? 6 : appleBoard ? 8 : compactBoard ? 9 : 10
      : touchBoard ? 10 : appleBoard ? 14 : compactBoard ? 13 : 16,
    clusterGap: classicAppearance ? (touchBoard ? 8 : fullBoard ? 18 : 14) : touchBoard ? 10 : fullBoard ? 24 : 18,
    sectionGap: classicAppearance ? (touchBoard ? 8 : compactBoard ? 10 : 12) : touchBoard ? 10 : compactBoard ? 14 : 18,
    boardRadius: classicAppearance
      ? touchBoard ? 14 : appleBoard ? 11 : linuxBoard ? 8 : 9
      : touchBoard ? 22 : appleBoard ? 20 : linuxBoard ? 12 : 16,
    keyRadius: classicAppearance
      ? touchBoard ? 6 : appleBoard ? 3.25 : linuxBoard ? 2 : 2.25
      : touchBoard ? 10 : appleBoard ? 9 : linuxBoard ? 4 : 6,
    keyInset: classicAppearance
      ? touchBoard ? 0.65 : appleBoard ? 0.4 : linuxBoard ? 0.25 : 0.3
      : touchBoard ? 1.1 : appleBoard ? 1.2 : linuxBoard ? 1.5 : 1.35,
    topLipHeight: classicAppearance ? 0 : touchBoard ? 0 : appleBoard ? 6 : compactBoard ? 4 : 5,
    boardAccentStroke: touchBoard
      ? classicAppearance ? "hsl(var(--text) / 0.05)" : "hsl(var(--text) / 0.07)"
      : appleBoard ? "hsl(var(--text) / 0.14)"
        : linuxBoard ? "hsl(var(--accent) / 0.22)" : "hsl(var(--text) / 0.1)",
    boardShellFill: classicAppearance
      ? "hsl(var(--panel-muted) / 0.08)"
      : touchBoard ? "hsl(var(--panel-muted) / 0.1)"
        : appleBoard ? "hsl(var(--panel-muted) / 0.78)"
          : linuxBoard ? "hsl(223 16% 9% / 0.95)" : "hsl(var(--panel-muted) / 0.58)",
    boardWellFill: classicAppearance
      ? "hsl(var(--panel) / 0.02)"
      : touchBoard ? "hsl(var(--panel-muted) / 0.06)"
        : appleBoard ? "hsl(var(--panel) / 0.28)" : "hsl(var(--panel) / 0.22)",
  };
}
