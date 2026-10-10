import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT || 5179);
if (process.env.TEST_ENV === "live") {
  throw new Error("Water browser tests use mocked local data only; live environments are not supported.");
}

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    serviceWorkers: "block",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    env: { REEBS_SKIP_ENV_FILES: "true", VITE_API_BASE_URL: `http://127.0.0.1:${port}`, VITE_API_PROXY_TARGET: "http://127.0.0.1:1" },
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  timeout: 60_000,
});
