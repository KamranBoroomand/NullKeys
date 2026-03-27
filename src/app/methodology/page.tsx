import { buildPageMetadata } from "@/app/metadata";
import { MethodologyScreen } from "@/features/product-shell/information-screens";

export const metadata = buildPageMetadata(
  "Methodology",
  "Read how NullKeys handles adaptive practice, scoring, layout analysis, and local persistence.",
  "/methodology",
);

export default function MethodologyPage() {
  return <MethodologyScreen />;
}
