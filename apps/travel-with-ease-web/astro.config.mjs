import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://travelwithease.example",
  output: "static",
  trailingSlash: "never",
  integrations: [react(), sitemap()],
  vite: {
    server: { proxy: { "/api": { target: process.env.TWE_API_PROXY_TARGET || "http://localhost:3090", changeOrigin: true } } },
  },
});
