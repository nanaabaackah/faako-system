import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const appNodeModules = new URL("./node_modules/", import.meta.url);

const resolveAppDependency = (path) =>
  fileURLToPath(new URL(path, appNodeModules));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@faako/config",
        replacement: fileURLToPath(new URL("../../packages/config/src", import.meta.url)),
      },
      {
        find: "@faako/core",
        replacement: fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
      },
      {
        find: "@faako/theme",
        replacement: fileURLToPath(new URL("../../packages/theme/src", import.meta.url)),
      },
      {
        find: "@faako/types",
        replacement: fileURLToPath(new URL("../../packages/types/src", import.meta.url)),
      },
      {
        find: "@faako/ui",
        replacement: fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
      },
      {
        find: "@faako/utils",
        replacement: fileURLToPath(new URL("../../packages/utils/src", import.meta.url)),
      },
      { find: /^react$/, replacement: resolveAppDependency("react/index.js") },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolveAppDependency("react/jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolveAppDependency("react/jsx-dev-runtime.js"),
      },
      { find: /^react-dom$/, replacement: resolveAppDependency("react-dom/index.js") },
      {
        find: /^react-dom\/client$/,
        replacement: resolveAppDependency("react-dom/client.js"),
      },
      {
        find: /^react-router-dom$/,
        replacement: resolveAppDependency("react-router-dom/dist/index.js"),
      },
    ],
  },
  server: {
    port: 5176
  },
  build: {
    outDir: "dist"
  }
});
