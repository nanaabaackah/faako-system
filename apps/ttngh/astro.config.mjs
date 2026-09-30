import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

const site = process.env.PUBLIC_SITE_URL || "https://ttngh.example";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "never",
  integrations: [react(), sitemap()],
});
