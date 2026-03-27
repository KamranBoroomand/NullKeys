import { buildPageMetadata } from "@/app/metadata";
import { PrivacyScreen } from "@/features/product-shell/information-screens";

export const metadata = buildPageMetadata(
  "Privacy",
  "Review NullKeys local-only storage model, reset controls, and privacy stance.",
  "/privacy",
);

export default function PrivacyPage() {
  return <PrivacyScreen />;
}
