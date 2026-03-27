import { buildPageMetadata } from "@/app/metadata";
import { SetupScreen } from "@/features/onboarding-flow/setup-screen";

export const metadata = buildPageMetadata(
  "Onboarding",
  "Set up language, layout, and device defaults before starting local-only practice in NullKeys.",
  "/onboarding",
);

export default function OnboardingPage() {
  return <SetupScreen />;
}
