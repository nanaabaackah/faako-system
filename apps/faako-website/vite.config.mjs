import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createManualChunks } from "../../scripts/vite/manualChunks.mjs";

const appNodeModules = new URL("./node_modules/", import.meta.url);

const resolveAppDependency = (path) =>
  fileURLToPath(new URL(path, appNodeModules));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const apiProxyTarget = env.FAAKO_API_PROXY_TARGET || "http://127.0.0.1:8889";

  return {
    plugins: [react()],
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
      port: 5175,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/api(?=\/|$)/, "/.netlify/functions") || "/.netlify/functions"
        }
      }
    },
    build: {
      outDir: "dist",
      rollupOptions: {
        output: {
          manualChunks: createManualChunks(),
        },
      },
    }
  };
});
