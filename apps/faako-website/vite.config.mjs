import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createManualChunks } from "../../scripts/vite/manualChunks.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const apiProxyTarget = env.FAAKO_API_PROXY_TARGET || "http://127.0.0.1:8889";

  return {
    plugins: [react()],
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
          rewrite: (path) =>
            path.replace(/^\/api(?=\/|$)/, "/.netlify/functions") || "/.netlify/functions",
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
