import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL:
      process.env.TEST_ENV === 'live'
        ? 'https://reebspartythemes.com'
        : `http://localhost:${process.env.PORT || 8888}`,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  timeout: 60000, // optional: safer timeout for a11y scans
});
