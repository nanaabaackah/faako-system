import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://nanaabaackah.com',
  output: 'static',
  trailingSlash: 'never',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.endsWith('/404'),
    }),
  ],
  vite: {
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      proxy: {
        '/api/public/trust-stats': {
          target: 'https://api.dev.nanaabaackah.com',
          changeOrigin: true,
        },
      },
    },
  },
});
