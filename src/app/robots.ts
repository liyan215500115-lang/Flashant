import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/legal/copy";
import { PUBLIC_INDEXABLE_PATHS } from "@/lib/legal/paths";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...PUBLIC_INDEXABLE_PATHS],
    },
    host: SITE_URL,
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
