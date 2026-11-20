import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '')
const port = Number(process.argv[3] ?? 4174)
if (!process.argv[2] || !existsSync(root)) {
  console.error('usage: node scripts/serve-static.mjs <dir> <port>')
  process.exit(1)
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' }
const statSafe = (file) => {
  try {
    return statSync(file)
  } catch {
    return null
  }
}
createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
  let file = resolve(root, relative)
  if (!file.startsWith(root)) {
    response.writeHead(403)
    response.end('forbidden')
    return
  }
  if (statSafe(file)?.isDirectory()) {
    file = join(file, 'index.html')
  }
  if (!existsSync(file)) {
    response.writeHead(404)
    response.end('not found')
    return
  }
  const headers = { 'content-type': types[extname(file)] ?? 'application/octet-stream' }
  if (url.pathname === '/version.json') headers['cache-control'] = 'no-store'
  response.writeHead(200, headers)
  createReadStream(file).pipe(response)
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} on ${port}`)
})
