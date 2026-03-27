import { inferSuggestedLanguageId } from "@/features/onboarding-flow/setup-inference";

describe("onboarding inference", () => {
  it("maps browser locales to expanded supported languages", () => {
    expect(inferSuggestedLanguageId("fa-IR")).toBe("persian");
    expect(inferSuggestedLanguageId("ja-JP")).toBe("japanese");
    expect(inferSuggestedLanguageId("nb-NO")).toBe("norwegian-bokmal");
    expect(inferSuggestedLanguageId("th-TH")).toBe("thai");
  });
});

