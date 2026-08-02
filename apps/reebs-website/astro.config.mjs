import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

const noIndexPaths = new Set([
  "/404",
  "/500",
  "/cart",
  "/checkout",
  "/customer-login",
  "/reset-password",
]);

export default defineConfig({
  site: "https://www.reebspartythemes.com",
  output: "static",
  trailingSlash: "never",
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/+$/, "") || "/";
        return !noIndexPaths.has(path);
      },
    }),
  ],
  vite: {
    resolve: {
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    server: {
      proxy: {
        "/api": {
          target:
            process.env.REEBS_API_PROXY_TARGET
            || process.env.VITE_API_PROXY_TARGET
            || process.env.VITE_API_BASE_URL
            || process.env.VITE_BACKEND_BASE_URL
            || "https://api.reebspartythemes.com",
          changeOrigin: true,
        },
      },
    },
  },
});
