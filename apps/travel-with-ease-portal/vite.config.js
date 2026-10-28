import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  if (command === "build" && ["staging", "production"].includes(env.APP_ENV) && env.VITE_API_BASE_URL?.trim()) {
    throw new Error("Hosted staff portal builds require an empty VITE_API_BASE_URL for same-origin Access sessions.");
  }
  return {
    define: { "import.meta.env.TWE_LOCAL_DEMO_ALLOWED": JSON.stringify(command === "serve" && mode === "development" && env.NODE_ENV !== "production" && !["staging", "production"].includes(env.APP_ENV)) },
    plugins: [react()],
    server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:3090" } },
  };
});
