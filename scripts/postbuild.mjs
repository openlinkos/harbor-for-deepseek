import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCommit, readVersion } from './release-meta.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'apps/web/dist')
const indexPath = join(dist, 'index.html')

const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('base64')

let html = readFileSync(indexPath, 'utf8')
html = html.replace(/<(script|link)\b([^>]*?)>/g, (full) => {
  const attr = /\b(?:src|href)="([^"]+)"/.exec(full)
  if (!attr || attr[1].startsWith('http') || attr[1].startsWith('data:') || full.includes('integrity=')) {
    return full
  }
  const file = join(dist, attr[1].replace(/^\//, '').split('?')[0])
  const integrity = `sha256-${hashFile(file)}`
  const selfClosing = /\/\s*>$/.test(full)
  const core = full.replace(/\s*\/?>$/, '')
  const cross = full.includes('crossorigin') ? '' : ' crossorigin="anonymous"'
  return `${core} integrity="${integrity}"${cross}${selfClosing ? ' />' : '>'}`
})

if (!html.includes('https://api.deepseek.com') || html.includes('unsafe-eval')) {
  throw new Error('dist/index.html is missing the Harbor CSP')
}
if (html.includes('__HARBOR_CSP__')) {
  throw new Error('CSP placeholder was not replaced')
}

writeFileSync(indexPath, html)
writeFileSync(join(dist, '404.html'), html)
copyFileSync(join(root, 'LICENSE'), join(dist, 'LICENSE'))
copyFileSync(join(root, 'NOTICE'), join(dist, 'NOTICE'))

const headersPath = join(dist, '_headers')
const headers = readFileSync(headersPath, 'utf8')
const publicHeaders = readFileSync(join(root, 'apps/web/public/_headers'), 'utf8')
if (headers !== publicHeaders) {
  throw new Error('dist/_headers does not match apps/web/public/_headers')
}
for (const line of [
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'X-Frame-Options: DENY',
  'Permissions-Policy: camera=(), microphone=(self), geolocation=()',
  "connect-src 'self' https://api.deepseek.com",
]) {
  if (!headers.includes(line)) {
    throw new Error(`dist/_headers is missing ${line}`)
  }
}
if (headers.includes('unsafe-eval')) {
  throw new Error('dist/_headers allows unsafe-eval')
}

const versionFile = {
  version: readVersion(),
  commit: readCommit(),
  builtAt: new Date().toISOString(),
}
if (!/^\d+\.\d+\.\d+$/.test(versionFile.version) || !/^(?:[0-9a-f]{40}|unknown)$/.test(versionFile.commit) || Number.isNaN(Date.parse(versionFile.builtAt))) {
  throw new Error(`refusing to write version.json: ${JSON.stringify(versionFile)}`)
}
writeFileSync(join(dist, 'version.json'), `${JSON.stringify(versionFile)}\n`)

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walk(path)
    } else if (name !== 'SHA256SUMS') {
      files.push(path)
    }
  }
}
walk(dist)
const sums = files
  .sort()
  .map((path) => `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${relative(dist, path)}`)
  .join('\n')
writeFileSync(join(dist, 'SHA256SUMS'), `${sums}\n`)
mkdirSync(join(dist, 'icons'), { recursive: true })
console.log(`static site ready: ${files.length} files, sha256 written`)
