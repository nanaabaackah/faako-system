import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { fileURLToPath, URL } from "node:url";

const site = process.env.PUBLIC_SITE_URL || "https://travelwithease.example";
const indexable = process.env.PUBLIC_APP_ENV === "production" && process.env.PUBLIC_SITE_INDEXABLE === "true" && !site.endsWith(".example");

export default defineConfig({
  site,
  output: "static",
  ...(process.env.TWE_BUILD_PUBLIC_DIR ? { publicDir: process.env.TWE_BUILD_PUBLIC_DIR } : {}),
  ...(process.env.TWE_BUILD_OUT_DIR ? { outDir: process.env.TWE_BUILD_OUT_DIR } : {}),
  trailingSlash: "never",
  integrations: [react(), sitemap({ filter: () => indexable })],
  vite: {
    resolve: {
      alias: {
        "@faako/utils": fileURLToPath(new URL("../../packages/utils/src", import.meta.url)),
      },
    },
    server: { proxy: { "/api": { target: process.env.TWE_API_PROXY_TARGET || "http://localhost:3090", changeOrigin: true } } },
  },
});
