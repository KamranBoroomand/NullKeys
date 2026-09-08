import type { MetadataRoute } from "next";
import { getBuildMetadata } from "@/lib/product/build-metadata";

const buildMetadata = getBuildMetadata();

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${buildMetadata.name} · ${buildMetadata.tagline}`,
    short_name: buildMetadata.name,
    description: buildMetadata.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#f7f5f0",
    theme_color: "#617341",
    categories: ["education", "productivity", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Adaptive practice",
        short_name: "Practice",
        url: "/practice",
      },
      {
        name: "Benchmark mode",
        short_name: "Benchmark",
        url: "/benchmark",
      },
      {
        name: "Progress",
        short_name: "Progress",
        url: "/progress",
      },
    ],
  };
}
