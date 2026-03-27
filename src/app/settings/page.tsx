import { buildPageMetadata } from "@/app/metadata";
import { SettingsScreen } from "@/features/user-preferences/settings-screen";

export const metadata = buildPageMetadata(
  "Settings",
  "Tune themes, languages, layouts, fonts, and local data behavior for this NullKeys browser profile.",
  "/settings",
);

export default function SettingsPage() {
  return <SettingsScreen />;
}
