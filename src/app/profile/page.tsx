import { buildPageMetadata } from "@/app/metadata";
import { ProgressScreen } from "@/features/progress-analytics/progress-screen";

export const metadata = buildPageMetadata(
  "Profile",
  "Review local speed, accuracy, key heatmaps, and trend charts without accounts or sync.",
  "/profile",
);

export default function ProfilePage() {
  return <ProgressScreen />;
}
