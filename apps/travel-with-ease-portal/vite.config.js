import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  if (command === "build" && ["staging", "production"].includes(env.APP_ENV) && env.VITE_API_BASE_URL?.trim()) {
    throw new Error("Hosted staff portal builds require an empty VITE_API_BASE_URL for same-origin Access sessions.");
  }
  // Build-time permission is deliberately separate from the local demo flag.
  // Production builds cannot include a staging portal demo even if a flag is copied.
  const stagingPortalDemo = command === "build" && env.APP_ENV === "staging" && env.TWE_STAGING_PORTAL_DEMO_ENABLED === "true";
  return {
    define: {
      "import.meta.env.TWE_LOCAL_DEMO_ALLOWED": JSON.stringify(command === "serve" && mode === "development" && env.NODE_ENV !== "production" && !["staging", "production"].includes(env.APP_ENV)),
      "import.meta.env.TWE_STAGING_PORTAL_DEMO_ALLOWED": JSON.stringify(stagingPortalDemo),
    },
    plugins: [react()],
    server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:3090" } },
  };
});
