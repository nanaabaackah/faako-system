import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@faako/config", replacement: fileURLToPath(new URL("../../packages/config/src", import.meta.url)) },
      { find: "@faako/core",   replacement: fileURLToPath(new URL("../../packages/core/src",   import.meta.url)) },
      { find: "@faako/theme",  replacement: fileURLToPath(new URL("../../packages/theme/src",  import.meta.url)) },
      { find: "@faako/types",  replacement: fileURLToPath(new URL("../../packages/types/src",  import.meta.url)) },
      { find: "@faako/ui",     replacement: fileURLToPath(new URL("../../packages/ui/src",     import.meta.url)) },
      { find: "@faako/utils",  replacement: fileURLToPath(new URL("../../packages/utils/src",  import.meta.url)) },
    ],
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  server: {
    port: 5176,
  },
  build: {
    outDir: "dist",
  },
});
