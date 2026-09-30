import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL:
      process.env.TEST_ENV === 'live'
        ? 'https://reebspartythemes.com'
        : `http://127.0.0.1:${process.env.PORT || 5174}`,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  timeout: 60000, // optional: safer timeout for a11y scans
  webServer: process.env.TEST_ENV === 'live'
    ? undefined
    : {
        command: `pnpm exec vite --host 127.0.0.1 --port ${process.env.PORT || 5174}`,
        port: Number(process.env.PORT || 5174),
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
