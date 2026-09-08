import {
  contentFamilies,
  getAdaptiveContentFamilies,
  getBenchmarkContentFamilies,
  getVisibleContentFamilies,
  normalizeVisibleContentFamilyId,
} from "@/features/content-families/content-family-registry";

describe("content family registry", () => {
  it("keeps quote drills internal while removing books from visible pickers", () => {
    expect(contentFamilies.map((contentFamily) => contentFamily.id)).toContain("quote-drills");
    expect(getVisibleContentFamilies().map((contentFamily) => contentFamily.id)).not.toContain(
      "quote-drills",
    );
    expect(getAdaptiveContentFamilies().map((contentFamily) => contentFamily.id)).not.toContain(
      "quote-drills",
    );
    expect(getBenchmarkContentFamilies().map((contentFamily) => contentFamily.id)).not.toContain(
      "quote-drills",
    );
    expect(getBenchmarkContentFamilies().map((contentFamily) => contentFamily.id)).not.toContain(
      "adaptive-blend",
    );
  });

  it("routes hidden books selections to phrase drills", () => {
    expect(normalizeVisibleContentFamilyId("quote-drills")).toBe("phrase-drills");
  });

  it("assigns explicit purity profiles to each content family", () => {
    expect(contentFamilies.find((contentFamily) => contentFamily.id === "adaptive-blend")?.purityProfile).toBe(
      "natural-language",
    );
    expect(contentFamilies.find((contentFamily) => contentFamily.id === "quote-drills")?.purityProfile).toBe(
      "natural-language",
    );
    expect(contentFamilies.find((contentFamily) => contentFamily.id === "symbol-drills")?.purityProfile).toBe(
      "symbols",
    );
    expect(contentFamilies.find((contentFamily) => contentFamily.id === "number-drills")?.purityProfile).toBe(
      "numbers",
    );
    expect(contentFamilies.find((contentFamily) => contentFamily.id === "code-drills")?.purityProfile).toBe(
      "code",
    );
    expect(contentFamilies.find((contentFamily) => contentFamily.id === "shell-drills")?.purityProfile).toBe(
      "shell",
    );
  });
});
