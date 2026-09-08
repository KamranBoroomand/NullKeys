import { buildPageMetadata } from "@/app/metadata";
import { HighScoresScreen } from "@/features/product-shell/high-scores-screen";

export const metadata = buildPageMetadata(
  "High Scores",
  "See the best local benchmark and practice runs ranked without cloud leaderboards or accounts.",
  "/high-scores",
);

export default function HighScoresPage() {
  return <HighScoresScreen />;
}
