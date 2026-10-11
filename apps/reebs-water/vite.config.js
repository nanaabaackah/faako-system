import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  // Local verification must never load real credentials from environment files.
  const skipEnvFiles = process.env.REEBS_SKIP_ENV_FILES === "true";
  const env = skipEnvFiles ? {} : loadEnv(mode, process.cwd(), "VITE_");
  const apiProxyTarget = String(
    process.env.VITE_API_PROXY_TARGET || env.VITE_API_PROXY_TARGET
      || process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || "http://localhost:8888"
  ).trim();

  return {
    envDir: skipEnvFiles ? false : undefined,
    plugins: [react()],
    resolve: {
      alias: {
        "@faako/core": fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
        "@faako/theme": fileURLToPath(new URL("../../packages/theme/src", import.meta.url)),
        "@faako/ui": fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
        "@faako/utils": fileURLToPath(new URL("../../packages/utils/src", import.meta.url)),
      },
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
