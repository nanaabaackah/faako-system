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
  },
});
