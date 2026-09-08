import { buildPageMetadata } from "@/app/metadata";
import { GuideScreen } from "@/features/product-shell/information-screens";

export const metadata = buildPageMetadata(
  "Help",
  "Learn how NullKeys practice, typing test, layouts, and profile tools fit together.",
  "/help",
);

export default function HelpPage() {
  return <GuideScreen />;
}
