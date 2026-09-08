import type { Metadata } from "next";
import { getBuildMetadata } from "@/lib/product/build-metadata";

const buildMetadata = getBuildMetadata();

function normalizeCanonicalPath(pathname: string) {
  if (pathname === "/") {
    return "/";
  }

  const trimmedPathname = pathname.trim().replace(/\/+$/u, "");

  return trimmedPathname.startsWith("/") ? trimmedPathname : `/${trimmedPathname}`;
}

function buildSocialTitle(title: string) {
  return title === buildMetadata.name ? title : `${title} · ${buildMetadata.name}`;
}

export function buildPageMetadata(
  title: string,
  description?: string,
  canonicalPathname = "/",
): Metadata {
  const resolvedDescription = description ?? buildMetadata.description;
  const canonicalPath = normalizeCanonicalPath(canonicalPathname);
  const socialTitle = buildSocialTitle(title);

  return {
    title,
    description: resolvedDescription,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: socialTitle,
      description: resolvedDescription,
      url: canonicalPath,
      siteName: buildMetadata.name,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: socialTitle,
      description: resolvedDescription,
    },
  };
}
