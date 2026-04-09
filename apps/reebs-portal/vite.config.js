import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createManualChunks } from "../../scripts/vite/manualChunks.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendBaseUrl = String(env.VITE_BACKEND_BASE_URL || "http://localhost:8888").trim();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@faako/config": fileURLToPath(new URL("../../packages/config/src", import.meta.url)),
        "@faako/core": fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
        "@faako/theme": fileURLToPath(new URL("../../packages/theme/src", import.meta.url)),
        "@faako/types": fileURLToPath(new URL("../../packages/types/src", import.meta.url)),
        "@faako/ui": fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
        "@faako/utils": fileURLToPath(new URL("../../packages/utils/src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/.netlify/functions": {
          target: backendBaseUrl,
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
