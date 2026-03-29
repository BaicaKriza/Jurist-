import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // In Codespaces/cloud, set VITE_BACKEND_PROXY_TARGET to the backend URL
  // e.g. https://your-codespace-8000.githubpreview.dev
  const backendTarget = env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: false,
      // Allow GitHub Codespaces and any cloud dev environment hosts
      allowedHosts: 'all',
      hmr: process.env.CODESPACES
        ? {
            // In Codespaces, HMR WebSocket must go through the forwarded port
            clientPort: 443,
            protocol: 'wss',
          }
        : true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
    build: {
      chunkSizeWarningLimit: 600,
    },
  }
})
