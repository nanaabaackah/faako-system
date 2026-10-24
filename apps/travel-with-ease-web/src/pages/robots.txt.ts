import { buildRobotsText } from "@faako/discovery";
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const origin = site || new URL("https://travelwithease.example");
  const indexable = import.meta.env.PUBLIC_APP_ENV === "production" && import.meta.env.PUBLIC_SITE_INDEXABLE === "true"
    && origin.hostname !== "travelwithease.example";
  const content = buildRobotsText({
    indexable,
    sitemapUrl: new URL("/sitemap-index.xml", origin).toString(),
  });

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
