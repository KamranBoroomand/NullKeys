import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "@/app/globals.css";
import { getBuildMetadata } from "@/lib/product/build-metadata";

const buildMetadata = getBuildMetadata();

export const metadata: Metadata = {
  metadataBase: new URL(buildMetadata.siteUrl),
  title: {
    default: `${buildMetadata.name} · ${buildMetadata.tagline}`,
    template: `%s · ${buildMetadata.name}`,
  },
  description: buildMetadata.description,
  applicationName: buildMetadata.name,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: buildMetadata.name,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: buildMetadata.name,
    description: `${buildMetadata.tagline} ${buildMetadata.description}`,
    url: "/",
    siteName: buildMetadata.name,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: buildMetadata.name,
    description: `${buildMetadata.tagline} ${buildMetadata.description}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
