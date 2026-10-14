import { isIndexable, productionOrigin } from "../lib/indexability.js";

export function GET() {
  const indexable = isIndexable(import.meta.env.PUBLIC_SITE_URL || productionOrigin, import.meta.env.PUBLIC_SITE_INDEXABLE);
  const content = indexable
    ? `User-agent: *\nAllow: /\nSitemap: ${productionOrigin}/sitemap-index.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
