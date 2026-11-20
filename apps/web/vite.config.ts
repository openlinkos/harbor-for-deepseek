import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readCommit, readVersion, repoRoot, shortCommit } from '../../scripts/release-meta.mjs'
import { CONTENT_SECURITY_POLICY } from './src/csp.js'

const version = readVersion()
const commit = readCommit()
const versionBody = () => `${JSON.stringify({ version, commit, builtAt: new Date().toISOString() })}\n`

const serveVersion = (rootDir) => (req, res, next) => {
  const path = req.url?.split('?')[0]
  if (path !== '/version.json') {
    next()
    return
  }
  let body = versionBody()
  if (rootDir) {
    try {
      body = readFileSync(join(rootDir, 'version.json'), 'utf8')
      if (!body.endsWith('\n')) body += '\n'
    } catch {
      body = versionBody()
    }
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

export default defineConfig({
  define: {
    __DEEPAPI_VERSION__: JSON.stringify(version),
    __DEEPAPI_COMMIT__: JSON.stringify(shortCommit(commit)),
  },
  plugins: [
    react(),
    {
      name: 'harbor-csp',
      transformIndexHtml(html) {
        return html.replaceAll('__HARBOR_CSP__', CONTENT_SECURITY_POLICY)
      },
    },
    {
      name: 'deepapi-version',
      configureServer(server) {
        server.middlewares.use(serveVersion(''))
      },
      configurePreviewServer(server) {
        server.middlewares.stack.unshift({ route: '', handle: serveVersion(join(repoRoot, 'apps/web/dist')) })
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
