import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  if ((command === "build" && (env.TWE_WORKSPACE_PREVIEW === "true" || env.VITE_TWE_LOCAL_WORKSPACE === "true")) ||
      (env.TWE_WORKSPACE_PREVIEW === "true" && (env.APP_ENV !== "development" || env.NODE_ENV === "production"))) {
    throw new Error("Workspace preview is only available through the local development server.");
  }
  if (command === "build" && ["staging", "production"].includes(env.APP_ENV) && env.VITE_API_BASE_URL?.trim()) {
    throw new Error("Hosted staff portal builds require an empty VITE_API_BASE_URL for same-origin Access sessions.");
  }
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      strictPort: true,
      proxy: {
        "/api": "http://127.0.0.1:3090",
        ...(env.TWE_WORKSPACE_PREVIEW === "true" ? { "/__workspace": "http://127.0.0.1:3090" } : {}),
      },
    },
  };
});
