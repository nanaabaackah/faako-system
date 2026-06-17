import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createGoogleAnalyticsHtmlPlugin } from "../../scripts/vite/googleAnalyticsHtml.mjs";
import { createManualChunks } from "../../scripts/vite/manualChunks.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = String(
    env.VITE_API_PROXY_TARGET
      || env.VITE_API_BASE_URL
      || env.VITE_BACKEND_BASE_URL
      || "http://localhost:8888"
  ).trim();

  return {
    plugins: [
      react(),
      createGoogleAnalyticsHtmlPlugin({
        measurementId: env.VITE_GA_MEASUREMENT_ID,
        fallbackMeasurementId: env.VITE_GA_ID,
        enableInDevelopment: env.VITE_ENABLE_GA_IN_DEV,
        mode,
      }),
    ],
    resolve: {
      alias: {
        "@faako/config": fileURLToPath(new URL("../../packages/config/src", import.meta.url)),
        "@faako/core": fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
        "@faako/theme": fileURLToPath(new URL("../../packages/theme/src", import.meta.url)),
        "@faako/types": fileURLToPath(new URL("../../packages/types/src", import.meta.url)),
        "@faako/ui": fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
        "@faako/utils": fileURLToPath(new URL("../../packages/utils/src", import.meta.url)),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: createManualChunks(),
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
    },
  };
});
