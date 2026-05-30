import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createManualChunks } from "../../scripts/vite/manualChunks.mjs";

export default defineConfig({
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
    rollupOptions: {
      output: {
        manualChunks: createManualChunks(),
      },
    },
  },
});
