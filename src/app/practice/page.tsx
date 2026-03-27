import { buildPageMetadata } from "@/app/metadata";
import { AdaptivePracticeScreen } from "@/features/adaptive-practice/adaptive-practice-screen";

export const metadata = buildPageMetadata(
  "Practice",
  "Adaptive typing lessons with local-only progress, language-aware prompts, and privacy-friendly practice on your device.",
  "/",
);

export default function PracticePage() {
  return <AdaptivePracticeScreen />;
}
