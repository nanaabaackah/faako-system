import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${process.env.PORT || 5173}`,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: {
    command: `ASTRO_DEV_BACKGROUND=0 pnpm exec astro dev --host 127.0.0.1 --port ${process.env.PORT || 5173}`,
    port: Number(process.env.PORT || 5173),
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
