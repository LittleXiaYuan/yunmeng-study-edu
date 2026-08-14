import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

// Required for `output: "export"` (desktop packaging embeds static HTML).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/private/"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
