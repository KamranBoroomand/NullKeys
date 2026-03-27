import path from "node:path";
import { existsSync } from "node:fs";
import manifest from "@/app/manifest";
import { buildPageMetadata } from "@/app/metadata";
import {
  NULLKEYS_SITE_URL,
  NULLKEYS_TAGLINE,
  getBuildMetadata,
} from "@/lib/product/build-metadata";

describe("product metadata", () => {
  it("builds a visible version string from public build metadata", () => {
    const previousBuildId = process.env.NEXT_PUBLIC_NULLKEYS_BUILD_ID;
    const previousVersion = process.env.NEXT_PUBLIC_NULLKEYS_VERSION;
    const previousPackVersion = process.env.NEXT_PUBLIC_NULLKEYS_CONTENT_PACK_VERSION;

    process.env.NEXT_PUBLIC_NULLKEYS_BUILD_ID = "abc123def4";
    process.env.NEXT_PUBLIC_NULLKEYS_VERSION = "0.1.0+abc123def4";
    process.env.NEXT_PUBLIC_NULLKEYS_CONTENT_PACK_VERSION = "packs-vtest";

    try {
      const buildMetadata = getBuildMetadata();

      expect(buildMetadata.version).toBe("0.1.0+abc123def4");
      expect(buildMetadata.buildString).toContain("0.1.0+abc123def4");
      expect(buildMetadata.buildString).toContain("packs-vtest");
      expect(buildMetadata.tagline).toBe(NULLKEYS_TAGLINE);
    } finally {
      if (previousBuildId === undefined) {
        delete process.env.NEXT_PUBLIC_NULLKEYS_BUILD_ID;
      } else {
        process.env.NEXT_PUBLIC_NULLKEYS_BUILD_ID = previousBuildId;
      }

      if (previousVersion === undefined) {
        delete process.env.NEXT_PUBLIC_NULLKEYS_VERSION;
      } else {
        process.env.NEXT_PUBLIC_NULLKEYS_VERSION = previousVersion;
      }

      if (previousPackVersion === undefined) {
        delete process.env.NEXT_PUBLIC_NULLKEYS_CONTENT_PACK_VERSION;
      } else {
        process.env.NEXT_PUBLIC_NULLKEYS_CONTENT_PACK_VERSION = previousPackVersion;
      }
    }
  });

  it("wires icon assets into the app manifest and keeps the files present", () => {
    const appManifest = manifest();

    expect(appManifest.id).toBe("/");
    expect(appManifest.short_name).toBe("NullKeys");
    expect(appManifest.icons?.some((icon) => icon.src === "/icon.svg")).toBe(true);
    expect(appManifest.icons?.some((icon) => icon.src === "/apple-icon")).toBe(true);
    expect(existsSync(path.join(process.cwd(), "src/app/icon.svg"))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "src/app/apple-icon.tsx"))).toBe(true);
  });

  it("provides page titles and canonical metadata that fit the NullKeys public site", () => {
    const pageMetadata = buildPageMetadata("Settings", undefined, "/settings");

    expect(pageMetadata.title).toBe("Settings");
    expect(pageMetadata.description).toContain("Local-first typing practice");
    expect(pageMetadata.alternates?.canonical).toBe("/settings");
    expect(pageMetadata.openGraph?.url).toBe("/settings");
    expect(pageMetadata.openGraph?.siteName).toBe("NullKeys");
    expect(pageMetadata.twitter).toEqual(expect.objectContaining({ card: "summary" }));
  });

  it("exposes the planned public site URL through build metadata", () => {
    const buildMetadata = getBuildMetadata();

    expect(buildMetadata.siteUrl).toBe(NULLKEYS_SITE_URL);
    expect(buildMetadata.siteUrl).toBe("https://nullkeys.kamranboroomand.ir");
  });
});
