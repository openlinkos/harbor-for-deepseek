import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const lan = process.argv.includes('--lan')
const source = new URL('../apps/web/dist/index.html', import.meta.url)
const copy = new URL('../apps/mobile/www/', import.meta.url)
const original = readFileSync(source, 'utf8')
if (original.includes('capacitor:') || / https:(?:\s|;)/.test(original)) {
  throw new Error('public dist CSP was already widened')
}
rmSync(copy, { recursive: true, force: true })
cpSync(new URL('../apps/web/dist/', import.meta.url), copy, { recursive: true })
const index = new URL('../apps/mobile/www/index.html', import.meta.url)
const extra = lan ? ' http://localhost http://127.0.0.1 http://10.0.2.2' : ''
const next = readFileSync(index, 'utf8').replace(
  "connect-src 'self' https://api.deepseek.com",
  `connect-src 'self' https://api.deepseek.com https: capacitor:${extra}`,
)
if (!next.includes('https: capacitor:')) {
  throw new Error('mobile CSP rewrite missed the connect-src directive')
}
writeFileSync(index, next)
const stillPublic = readFileSync(source, 'utf8')
if (stillPublic !== original) {
  throw new Error('prepare-mobile changed the public dist')
}
console.log(`prepared apps/mobile/www${lan ? ' (debug LAN http allowed in CSP)' : ''}`)
