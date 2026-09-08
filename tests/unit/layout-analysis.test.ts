import { analyzeKeyboardLayout } from "@/features/keyboard-visualizer/layout-analysis";

describe("layout analysis", () => {
  it("tracks Russian and Persian corpus coverage with language-aware keyboard mappings", () => {
    const russianAnalysis = analyzeKeyboardLayout({
      layoutId: "ansi-us-tenkeyless",
      languageId: "russian",
    });
    const persianAnalysis = analyzeKeyboardLayout({
      layoutId: "ansi-us-tenkeyless",
      languageId: "persian",
    });

    expect(russianAnalysis.coverageShare).toBeGreaterThan(45);
    expect(persianAnalysis.coverageShare).toBeGreaterThan(40);
    expect(Object.keys(russianAnalysis.keyHeatmapValues).length).toBeGreaterThan(8);
    expect(Object.keys(persianAnalysis.keyHeatmapValues).length).toBeGreaterThan(8);
  });
});
