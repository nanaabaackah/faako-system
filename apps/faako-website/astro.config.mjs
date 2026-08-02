import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { fileURLToPath, URL } from "node:url";

const noIndexPaths = new Set([
  "/404",
  "/500",
  "/client-setup",
  "/dashboard",
  "/forgot-password",
  "/login",
  "/signup",
]);

export default defineConfig({
  site: "https://faako.nanaabaackah.com",
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
      alias: [
        {
          find: "@fortawesome/react-fontawesome",
          replacement: fileURLToPath(
            new URL("./src/lib/icons/fontawesomeCompatReact.jsx", import.meta.url),
          ),
        },
        {
          find: "@fortawesome/free-solid-svg-icons",
          replacement: fileURLToPath(
            new URL("./src/lib/icons/fontawesomeCompatSolid.js", import.meta.url),
          ),
        },
        {
          find: "@fortawesome/free-brands-svg-icons",
          replacement: fileURLToPath(
            new URL("./src/lib/icons/fontawesomeCompatBrands.js", import.meta.url),
          ),
        },
      ],
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    server: {
      proxy: {
        "/api": {
          target:
            process.env.FAAKO_API_PROXY_TARGET ||
            "https://api.dev.nanaabaackah.com",
          changeOrigin: true,
        },
      },
    },
  },
});
