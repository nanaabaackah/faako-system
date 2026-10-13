import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import apiHeaders from "./scripts/api-headers.mjs";

const site = process.env.PUBLIC_SITE_URL || "https://thethrivingnetworkgh.org";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "never",
  integrations: [react(), sitemap({ filter: page => !new URL(page).pathname.match(/^\/cms\/?$/) }), apiHeaders()],
});
