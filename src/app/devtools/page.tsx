import type { Metadata } from "next";
import { buildPageMetadata } from "@/app/metadata";
import { notFound } from "next/navigation";
import { DeveloperToolsScreen } from "@/features/developer-tools/devtools-screen";

export function generateMetadata(): Metadata {
  if (process.env.NODE_ENV !== "development") {
    return {};
  }

  return buildPageMetadata(
    "Developer Tools",
    "Seed local demo data and inspect development-only utilities while iterating on NullKeys.",
  );
}

export default function DeveloperToolsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <DeveloperToolsScreen />;
}
