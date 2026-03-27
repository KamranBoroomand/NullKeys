import {
  getThemeDefinition,
  hexToHslTriplet,
  themeReferencePalettes,
} from "@/features/user-preferences/theme-registry";

describe("theme registry anchor palettes", () => {
  it("keeps Dracula anchored to the official family colors", () => {
    const dracula = getThemeDefinition("dracula");

    expect(dracula.cssVariables["--canvas"]).toBe(hexToHslTriplet(themeReferencePalettes.dracula.background));
    expect(dracula.cssVariables["--accent"]).toBe(hexToHslTriplet(themeReferencePalettes.dracula.pink));
    expect(dracula.cssVariables["--text"]).toBe(hexToHslTriplet(themeReferencePalettes.dracula.foreground));
    expect(dracula.cssVariables["--focus-ring"]).toBe(hexToHslTriplet(themeReferencePalettes.dracula.cyan));
  });

  it("keeps Nord, Solarized, and Gruvbox tied to their canonical anchor tones", () => {
    expect(getThemeDefinition("nord").cssVariables["--canvas"]).toBe(
      hexToHslTriplet(themeReferencePalettes.nord.nord0),
    );
    expect(getThemeDefinition("nord").cssVariables["--accent"]).toBe(
      hexToHslTriplet(themeReferencePalettes.nord.frost4),
    );

    expect(getThemeDefinition("solarized-dark").cssVariables["--canvas"]).toBe(
      hexToHslTriplet(themeReferencePalettes.solarized.base03),
    );
    expect(getThemeDefinition("solarized-light").cssVariables["--canvas"]).toBe(
      hexToHslTriplet(themeReferencePalettes.solarized.base3),
    );
    expect(getThemeDefinition("solarized-dark").cssVariables["--success"]).toBe(
      hexToHslTriplet(themeReferencePalettes.solarized.green),
    );

    expect(getThemeDefinition("gruvbox-dark").cssVariables["--canvas"]).toBe(
      hexToHslTriplet(themeReferencePalettes.gruvboxDark.bg0),
    );
    expect(getThemeDefinition("gruvbox-light").cssVariables["--accent"]).toBe(
      hexToHslTriplet(themeReferencePalettes.gruvboxLight.orange),
    );
  });

  it("keeps each Catppuccin variant mapped to its own official base and accent family", () => {
    expect(getThemeDefinition("catppuccin-mocha").cssVariables["--canvas"]).toBe(
      hexToHslTriplet(themeReferencePalettes.catppuccinMocha.base),
    );
    expect(getThemeDefinition("catppuccin-latte").cssVariables["--canvas"]).toBe(
      hexToHslTriplet(themeReferencePalettes.catppuccinLatte.base),
    );
    expect(getThemeDefinition("catppuccin-frappe").cssVariables["--canvas"]).toBe(
      hexToHslTriplet(themeReferencePalettes.catppuccinFrappe.base),
    );
    expect(getThemeDefinition("catppuccin-macchiato").cssVariables["--canvas"]).toBe(
      hexToHslTriplet(themeReferencePalettes.catppuccinMacchiato.base),
    );

    expect(getThemeDefinition("catppuccin-mocha").cssVariables["--surface-strong"]).toBe(
      hexToHslTriplet(themeReferencePalettes.catppuccinMocha.mauve),
    );
    expect(getThemeDefinition("catppuccin-latte").cssVariables["--surface-strong"]).toBe(
      hexToHslTriplet(themeReferencePalettes.catppuccinLatte.mauve),
    );
    expect(getThemeDefinition("catppuccin-frappe").cssVariables["--surface-strong"]).toBe(
      hexToHslTriplet(themeReferencePalettes.catppuccinFrappe.mauve),
    );
    expect(getThemeDefinition("catppuccin-macchiato").cssVariables["--surface-strong"]).toBe(
      hexToHslTriplet(themeReferencePalettes.catppuccinMacchiato.mauve),
    );
  });
});
