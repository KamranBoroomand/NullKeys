import { buildPageMetadata } from "@/app/metadata";
import { BoundaryPlaceholderScreen } from "@/features/product-shell/boundary-placeholder-screen";

export const metadata = buildPageMetadata(
  "Multiplayer",
  "NullKeys explains its offline-first multiplayer stance without requiring accounts or hosted services.",
  "/multiplayer",
);

export default function MultiplayerPage() {
  return (
    <BoundaryPlaceholderScreen
      eyebrow="Multiplayer"
      title="Multiplayer is intentionally offline"
      description="NullKeys focuses on private practice on your device, so this route does not add accounts, matchmaking, or cloud-backed races."
      body="NullKeys keeps multiplayer visible to explain the product boundary clearly: no remote identities, no room sync, and no backend requirement. The app stays centered on local practice rather than quietly implying a hosted feature that does not exist."
      links={[
        {
          href: "/",
          label: "Return to practice",
          description: "Continue adaptive lessons in the main training screen.",
        },
        {
          href: "/typing-test",
          label: "Run a solo typing test",
          description: "Use benchmark mode for direct, repeatable local comparisons.",
        },
      ]}
      footer={
        <p>
          If collaborative or versus play is explored later, it should remain optional,
          local-network oriented, and compatible with the no-account baseline rather than
          replacing it.
        </p>
      }
    />
  );
}
