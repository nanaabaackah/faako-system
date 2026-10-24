import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { fileURLToPath, URL } from "node:url";
import { publishedPage } from "./src/lib/published.js";

const site = process.env.PUBLIC_SITE_URL || "https://travelwithease.example";
if (process.env.PUBLIC_APP_ENV === "production" && site !== "https://travelwitheasegh.com") throw new Error("Production requires the approved canonical origin https://travelwitheasegh.com.");
if (["production", "staging"].includes(process.env.PUBLIC_APP_ENV) && !process.env.TWE_CONTENT_SNAPSHOT) {
  throw new Error("Hosted builds require an approved publication snapshot; local placeholders cannot be deployed.");
}
const indexable = process.env.PUBLIC_APP_ENV === "production" && process.env.PUBLIC_SITE_INDEXABLE === "true" && !site.endsWith(".example");

export default defineConfig({
  site,
  output: "static",
  ...(process.env.TWE_BUILD_PUBLIC_DIR ? { publicDir: process.env.TWE_BUILD_PUBLIC_DIR } : {}),
  ...(process.env.TWE_BUILD_OUT_DIR ? { outDir: process.env.TWE_BUILD_OUT_DIR } : {}),
  trailingSlash: "never",
  integrations: [react(), sitemap({ filter: (url) => indexable && Boolean(publishedPage(new URL(url).pathname.replace(/^\/|\/$/g, "") || "home")) })],
  vite: {
    resolve: {
      alias: {
        "@faako/utils": fileURLToPath(new URL("../../packages/utils/src", import.meta.url)),
      },
    },
    server: { proxy: { "/api": { target: process.env.TWE_API_PROXY_TARGET || "http://localhost:3090", changeOrigin: true } } },
  },
});
