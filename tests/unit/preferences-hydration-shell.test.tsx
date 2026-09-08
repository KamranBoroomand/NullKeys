import { render, screen } from "@testing-library/react";
import { PreferencesHydrationShell } from "@/components/shared/preferences-hydration-shell";

describe("preferences hydration shell", () => {
  it("renders navigation context, heading, reserved content, and a polite loading status", () => {
    render(
      <PreferencesHydrationShell
        eyebrow="Progress"
        title="Profile"
        description="Eligible local history is loading."
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading local preferences…")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Primary navigation, compact" })).toBeVisible();
  });
});
