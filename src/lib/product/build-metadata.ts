import packageJson from "../../../package.json";

export const NULLKEYS_NAME = "NullKeys";
export const NULLKEYS_TAGLINE = "Local practice, honest rhythm.";
export const NULLKEYS_DESCRIPTION =
  "Local-first typing practice for adaptive drills, multilingual layouts, honest benchmarks, and local-only progress.";
export const NULLKEYS_SITE_URL = "https://nullkeys.kamranboroomand.ir";

export interface ProductBuildMetadata {
  name: string;
  tagline: string;
  description: string;
  siteUrl: string;
  packageVersion: string;
  buildId: string;
  version: string;
  contentPackVersion: string;
  buildString: string;
}

export function getBuildMetadata(): ProductBuildMetadata {
  const packageVersion = process.env.NEXT_PUBLIC_NULLKEYS_PACKAGE_VERSION ?? packageJson.version;
  const buildId = process.env.NEXT_PUBLIC_NULLKEYS_BUILD_ID ?? "dev";
  const version = process.env.NEXT_PUBLIC_NULLKEYS_VERSION ?? `${packageVersion}+${buildId}`;
  const contentPackVersion =
    process.env.NEXT_PUBLIC_NULLKEYS_CONTENT_PACK_VERSION ?? "content-packs-unavailable";
  const tagline = process.env.NEXT_PUBLIC_NULLKEYS_TAGLINE ?? NULLKEYS_TAGLINE;

  return {
    name: NULLKEYS_NAME,
    tagline,
    description: NULLKEYS_DESCRIPTION,
    siteUrl: NULLKEYS_SITE_URL,
    packageVersion,
    buildId,
    version,
    contentPackVersion,
    buildString: `${NULLKEYS_NAME} ${version} · packs ${contentPackVersion}`,
  };
}
