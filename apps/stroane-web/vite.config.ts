import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createGoogleAnalyticsHtmlPlugin } from "../../scripts/vite/googleAnalyticsHtml.mjs";
import { createManualChunks } from "../../scripts/vite/manualChunks.mjs";

export default defineConfig(({ mode }) => {
  const appRoot = fileURLToPath(new URL(".", import.meta.url));
  const env = loadEnv(mode, appRoot, "");
  const buildSurface = String(process.env.STROANE_BUILD_SURFACE || "")
    .trim()
    .toLowerCase();
  const surfaceEntry =
    buildSurface === "storefront"
      ? fileURLToPath(new URL("./src/frontend/main.tsx", import.meta.url))
      : buildSurface === "portal"
        ? fileURLToPath(new URL("./src/portal/main.tsx", import.meta.url))
        : fileURLToPath(new URL("./src/main.tsx", import.meta.url));
  const plugins = [react()];
  if (buildSurface !== "portal") {
    plugins.push(
      createGoogleAnalyticsHtmlPlugin({
        measurementId: env.VITE_GA_MEASUREMENT_ID,
        fallbackMeasurementId: env.VITE_GA_ID,
        enableInDevelopment: env.VITE_ENABLE_GA_IN_DEV,
        mode,
      }),
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        "/src/main.tsx": surfaceEntry,
        "@faako/config": fileURLToPath(new URL("../../packages/config/src", import.meta.url)),
        "@faako/core": fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
        "@faako/offline-sync": fileURLToPath(new URL("../../packages/offline-sync/src", import.meta.url)),
        "@faako/theme": fileURLToPath(new URL("../../packages/theme/src", import.meta.url)),
        "@faako/types": fileURLToPath(new URL("../../packages/types/src", import.meta.url)),
        "@faako/ui": fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
        "@faako/utils": fileURLToPath(new URL("../../packages/utils/src", import.meta.url)),
      },
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    server: {
      hmr: {
        protocol: "ws",
        host: "localhost",
      },
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.removeHeader("origin");
            });
          },
        },
      },
    },
    build: {
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: createManualChunks(),
        },
      },
    },
  };
});
