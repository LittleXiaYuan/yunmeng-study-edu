import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

// Required for `output: "export"` (desktop packaging embeds static HTML).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;

  return [
    {
      url: baseUrl,
      lastModified: new Date("2026-07-01"),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
