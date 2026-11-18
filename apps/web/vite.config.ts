import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { CONTENT_SECURITY_POLICY } from './src/csp.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'harbor-csp',
      transformIndexHtml(html) {
        return html.replaceAll('__HARBOR_CSP__', CONTENT_SECURITY_POLICY)
      },
    },
  ],
  build: {
    sourcemap: false,
    modulePreload: { polyfill: false },
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
  },
})
