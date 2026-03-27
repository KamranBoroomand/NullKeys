import {
  buildKeyboardTrainingProfile,
  buildKeyboardCompanionMap,
  findKeyMetadataForCharacter,
  inferKeyboardSelection,
  keyboardFamilies,
  keyboardLayouts,
} from "@/features/keyboard-visualizer/keyboard-layout-registry";
import { resolveLanguageKeyboardContext } from "@/features/keyboard-visualizer/language-keyboard-support";

describe("keyboard layout registry", () => {
  it("covers a broad practical family and layout set", () => {
    expect(keyboardFamilies.length).toBeGreaterThanOrEqual(10);
    expect(keyboardLayouts.length).toBeGreaterThanOrEqual(14);
  });

  it("builds companion mappings from layout adjacency", () => {
    const companionMap = buildKeyboardCompanionMap("ansi-us-tenkeyless");

    expect(companionMap.q).toContain("a");
    expect(companionMap.a).toContain("q");
  });

  it("infers touch and desktop defaults from platform hints", () => {
    expect(inferKeyboardSelection("MacIntel", false).familyId).toBe("apple-compact");
    expect(inferKeyboardSelection("Linux x86_64", false).familyId).toBe("linux-programmer");
    expect(inferKeyboardSelection("iPhone", true).familyId).toBe("touch-ios");
  });

  it("exposes training metadata for modifiers, home row, and numpad layouts", () => {
    const trainingProfile = buildKeyboardTrainingProfile("ansi-us-full");

    expect(trainingProfile.supportsNumpad).toBe(true);
    expect(trainingProfile.homeRowCharacters).toEqual(expect.arrayContaining(["a", "s", "d"]));
    expect(trainingProfile.modifierKeyCodes).toEqual(
      expect.arrayContaining(["ShiftLeft", "ControlLeft"]),
    );
    expect(trainingProfile.numpadCharacters).toEqual(expect.arrayContaining(["1", "2", "3"]));
  });

  it("maps Russian and Persian script characters onto the active keyboard profile", () => {
    const russianProfile = buildKeyboardTrainingProfile("ansi-us-tenkeyless", "russian");
    const persianProfile = buildKeyboardTrainingProfile("ansi-us-tenkeyless", "persian");
    const russianCompanionMap = buildKeyboardCompanionMap("ansi-us-tenkeyless", "russian");
    const persianCompanionMap = buildKeyboardCompanionMap("ansi-us-tenkeyless", "persian");

    expect(russianProfile.homeRowCharacters).toEqual(expect.arrayContaining(["ф", "ы", "в"]));
    expect(persianProfile.homeRowCharacters).toEqual(expect.arrayContaining(["ش", "س", "ی"]));
    expect(findKeyMetadataForCharacter("ansi-us-tenkeyless", "й", "russian")?.code).toBe("KeyQ");
    expect(findKeyMetadataForCharacter("ansi-us-tenkeyless", "ض", "persian")?.code).toBe("KeyQ");
    expect(russianCompanionMap["ф"]).toEqual(expect.arrayContaining(["ы", "й"]));
    expect(persianCompanionMap["ش"]).toEqual(expect.arrayContaining(["س", "ض"]));
  });

  it("describes overlay context for Russian and Persian keyboard legends", () => {
    expect(
      resolveLanguageKeyboardContext({ languageId: "russian", inputMode: "hardware" }).overlayLabel,
    ).toMatch(/JCUKEN/i);
    expect(
      resolveLanguageKeyboardContext({ languageId: "persian", inputMode: "touch" }).suggestedLabel,
    ).toMatch(/Persian legends/i);
    expect(
      resolveLanguageKeyboardContext({ languageId: "english", inputMode: "hardware" }).source,
    ).toBe("layout-native");
  });
});
