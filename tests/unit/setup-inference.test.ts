import { inferSuggestedLanguageId } from "@/features/onboarding-flow/setup-inference";

describe("onboarding inference", () => {
  it("maps browser locales only to first-class languages", () => {
    expect(inferSuggestedLanguageId("fa-IR")).toBe("persian");
    expect(inferSuggestedLanguageId("ru-RU")).toBe("russian");
    expect(inferSuggestedLanguageId("ja-JP")).toBe("english");
    expect(inferSuggestedLanguageId("nb-NO")).toBe("english");
    expect(inferSuggestedLanguageId("th-TH")).toBe("english");
  });
});
