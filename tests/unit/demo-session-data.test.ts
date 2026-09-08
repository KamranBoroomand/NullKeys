import { seedDeveloperPreviewData } from "@/features/developer-tools/demo-session-data";
import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";
import {
  clearStoredHistory,
  listSessionRecords,
  readLearnerProgressProfile,
} from "@/lib/persistence/session-repository";

describe("developer preview seed data", () => {
  beforeEach(async () => {
    await clearStoredHistory();
  });

  it("creates demo sessions and a learner progression profile for local preview", async () => {
    const seedResult = await seedDeveloperPreviewData({
      ...defaultPracticePreferences,
      onboardingComplete: true,
    });
    const storedSessions = await listSessionRecords();
    const storedProfile = await readLearnerProgressProfile(seedResult.progressionId);

    expect(storedSessions).toHaveLength(seedResult.savedSessionCount);
    expect(seedResult.savedSessionCount).toBeGreaterThanOrEqual(8);
    expect(storedSessions.some((sessionRecord) => sessionRecord.sessionKind === "benchmark")).toBe(
      true,
    );
    expect(storedSessions.some((sessionRecord) => sessionRecord.languageId === "persian")).toBe(
      true,
    );
    expect(storedProfile).not.toBeNull();
    expect(storedProfile?.currentStageIndex).toBeGreaterThanOrEqual(0);
  });
});
