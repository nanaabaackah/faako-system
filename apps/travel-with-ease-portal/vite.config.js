import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  if (command === "build" && ["staging", "production"].includes(env.APP_ENV) && env.VITE_API_BASE_URL?.trim()) {
    throw new Error("Hosted staff portal builds require an empty VITE_API_BASE_URL for same-origin Access sessions.");
  }
  return { plugins: [react()], server: { proxy: { "/api": "http://localhost:3090" } } };
});
