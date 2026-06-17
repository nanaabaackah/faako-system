import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createGoogleAnalyticsHtmlPlugin } from "../../scripts/vite/googleAnalyticsHtml.mjs";

export default defineConfig(({ mode }) => {
  const appRoot = fileURLToPath(new URL(".", import.meta.url));
  const env = loadEnv(mode, appRoot, "");

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
  };
});
