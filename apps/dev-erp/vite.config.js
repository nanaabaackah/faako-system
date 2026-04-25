import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { createManualChunks } from '../../scripts/vite/manualChunks.mjs'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const appRoot = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, appRoot, '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@faako/config': fileURLToPath(new URL('../../packages/config/src', import.meta.url)),
        '@faako/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
        '@faako/theme': fileURLToPath(new URL('../../packages/theme/src', import.meta.url)),
        '@faako/types': fileURLToPath(new URL('../../packages/types/src', import.meta.url)),
        '@faako/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
        '@faako/utils': fileURLToPath(new URL('../../packages/utils/src', import.meta.url)),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: createManualChunks(),
        },
      },
    },
  }
})
