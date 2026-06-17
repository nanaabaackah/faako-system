import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createGoogleAnalyticsHtmlPlugin } from "../../scripts/vite/googleAnalyticsHtml.mjs";
import { createManualChunks } from "../../scripts/vite/manualChunks.mjs";

export default defineConfig(({ mode }) => {
  const appRoot = fileURLToPath(new URL(".", import.meta.url));
  const env = loadEnv(mode, appRoot, "");
  const apiProxyTarget = env.FAAKO_API_PROXY_TARGET || "http://127.0.0.1:8889";

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
      alias: [
        {
          find: "@fortawesome/react-fontawesome",
          replacement: fileURLToPath(new URL("./src/lib/icons/fontawesomeCompatReact.jsx", import.meta.url)),
        },
        {
          find: "@fortawesome/free-solid-svg-icons",
          replacement: fileURLToPath(new URL("./src/lib/icons/fontawesomeCompatSolid.js", import.meta.url)),
        },
        {
          find: "@fortawesome/free-brands-svg-icons",
          replacement: fileURLToPath(new URL("./src/lib/icons/fontawesomeCompatBrands.js", import.meta.url)),
        },
      ],
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    server: {
      port: 5175,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      rollupOptions: {
        output: {
          manualChunks: createManualChunks(),
        },
      },
    },
  };
});
