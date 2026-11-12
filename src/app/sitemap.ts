import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/legal/copy";
import { PUBLIC_INDEXABLE_PATHS } from "@/lib/legal/paths";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_INDEXABLE_PATHS.map((pathname) => ({
    url: new URL(pathname, SITE_URL).toString(),
  }));
}
