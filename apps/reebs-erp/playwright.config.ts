import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL:
      process.env.TEST_ENV === 'live'
        ? 'https://reebspartythemes.com'
        : `http://localhost:${process.env.PORT || 8888}`, // default Netlify/Vite dev
  },
  timeout: 60000, // optional: safer timeout for a11y scans
});
