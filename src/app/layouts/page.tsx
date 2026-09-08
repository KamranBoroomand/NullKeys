import { buildPageMetadata } from "@/app/metadata";
import { LayoutExplorerScreen } from "@/features/keyboard-visualizer/layout-explorer-screen";

export const metadata = buildPageMetadata(
  "Layouts",
  "Compare keyboard layouts with language-aware analysis, row usage, and finger-travel tradeoffs.",
  "/layouts",
);

export default function LayoutsPage() {
  return <LayoutExplorerScreen />;
}
