import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const apiProxyTarget = env.FAAKO_API_PROXY_TARGET || "http://127.0.0.1:8888";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@fortawesome/react-fontawesome": fileURLToPath(
          new URL("./src/lib/icons/fontawesomeCompatReact.jsx", import.meta.url),
        ),
        "@fortawesome/free-solid-svg-icons": fileURLToPath(
          new URL("./src/lib/icons/fontawesomeCompatSolid.js", import.meta.url),
        ),
        "@fortawesome/free-brands-svg-icons": fileURLToPath(
          new URL("./src/lib/icons/fontawesomeCompatBrands.js", import.meta.url),
        ),
      },
    },
    server: {
      port: 5173,
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
      outDir: "dist"
    }
  };
});
