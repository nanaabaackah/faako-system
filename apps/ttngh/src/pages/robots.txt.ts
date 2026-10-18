import { isIndexable, productionOrigin } from "../lib/indexability.js";
import { buildRobotsText } from "@faako/discovery";
import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const indexable = isIndexable(import.meta.env.PUBLIC_SITE_URL || productionOrigin, import.meta.env.PUBLIC_SITE_INDEXABLE);
  const content = buildRobotsText({
    indexable,
    sitemapUrl: `${productionOrigin}/sitemap-index.xml`,
    disallow: ["/cms"],
  });
  return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
