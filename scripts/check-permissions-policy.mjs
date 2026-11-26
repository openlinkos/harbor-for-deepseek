#!/usr/bin/env node
// Cross-checks the Permissions-Policy header against the browser APIs the app calls.
//
// 1. Every place in the repo that ships a Permissions-Policy value (nginx, Caddy,
//    Cloudflare Pages _headers, postbuild, the Node server, docs, tests) must carry
//    the same value. The files in REQUIRED_SOURCES must each carry one.
// 2. Every policy-controlled feature the app source uses (getUserMedia audio ->
//    microphone, navigator.geolocation -> geolocation, ...) must not be `()` or
//    otherwise exclude `self` in that value. A `()` makes the browser reject the call
//    without showing a permission prompt.
//
// Usage: node scripts/check-permissions-policy.mjs [root] [--json]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const json = args.includes('--json')
const root = resolve(args.find((arg) => !arg.startsWith('--')) ?? join(dirname(fileURLToPath(import.meta.url)), '..'))

/** Files that must keep shipping the header. Losing one silently drops it in production. */
export const REQUIRED_SOURCES = [
  'deploy/web/nginx/security-headers.conf',
  'deploy/Caddyfile',
  'apps/web/public/_headers',
  'scripts/postbuild.mjs',
  'apps/server/src/app.ts',
]

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'out', 'target', '.turbo', '.next', '.cache', 'test-results', 'playwright-report', 'Pods', 'DerivedData', '.gradle'])
const SKIP_PATHS = ['docs/parity/', 'scripts/check-permissions-policy.mjs', 'scripts/check-permissions-policy.test.mjs']
const TEXT = /\.(?:conf|mjs|cjs|js|jsx|ts|tsx|md|ya?ml|json|toml|sh|html|txt)$|(?:^|\/)(?:Caddyfile[^/]*|_headers|Dockerfile[^/]*|nginx[^/]*)$/

const walk = (dir, out) => {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue
    const abs = join(dir, name)
    const rel = relative(root, abs).split(sep).join('/')
    if (SKIP_PATHS.some((p) => rel === p || rel.startsWith(p))) continue
    let info
    try {
      info = statSync(abs)
    } catch {
      continue
    }
    if (info.isDirectory()) walk(abs, out)
    else if (info.size < 2_000_000 && TEXT.test(rel)) out.push(rel)
  }
  return out
}

const DIRECTIVE = String.raw`[a-z][a-z0-9-]*=\([^)\n]*\)`
const VALUE = new RegExp(String.raw`permissions-policy['"]?\s*[:,]?\s*['"]?\s*(${DIRECTIVE}(?:\s*,\s*${DIRECTIVE})*)`, 'i')

const normalize = (value) => value.split(',').map((part) => part.trim().replace(/\s+/g, ' ')).join(', ')

export const parsePolicy = (value) => {
  const map = new Map()
  for (const part of value.split(',')) {
    const match = /^\s*([a-z][a-z0-9-]*)=\(([^)]*)\)\s*$/.exec(part)
    if (match) map.set(match[1], match[2].trim().split(/\s+/).filter(Boolean))
  }
  return map
}

/** API pattern -> feature. Literal getUserMedia constraints are handled separately. */
const API_RULES = [
  [/\bnavigator\s*\??\.\s*geolocation\b/, 'geolocation'],
  [/\bclipboard\s*\??\.\s*(?:writeText|write)\s*\(/, 'clipboard-write'],
  [/\bclipboard\s*\??\.\s*(?:readText|read)\s*\(/, 'clipboard-read'],
  [/\bgetDisplayMedia\s*\(/, 'display-capture'],
  [/\brequestFullscreen\s*\(/, 'fullscreen'],
  [/\bnew\s+PaymentRequest\s*\(/, 'payment'],
  [/\bnavigator\s*\??\.\s*usb\b/, 'usb'],
  [/\bnavigator\s*\??\.\s*serial\b/, 'serial'],
  [/\bnavigator\s*\??\.\s*hid\b/, 'hid'],
  [/\bnavigator\s*\??\.\s*bluetooth\b/, 'bluetooth'],
  [/\bwakeLock\s*\??\.\s*request\s*\(/, 'screen-wake-lock'],
  [/\bnavigator\s*\??\.\s*share\s*\(/, 'web-share'],
  [/\bnavigator\s*\??\.\s*xr\b/, 'xr-spatial-tracking'],
  [/\brequestMIDIAccess\s*\(/, 'midi'],
  [/\bnew\s+Accelerometer\s*\(/, 'accelerometer'],
  [/\bnew\s+Gyroscope\s*\(/, 'gyroscope'],
  [/\bnew\s+Magnetometer\s*\(/, 'magnetometer'],
]

const isAppSource = (rel) =>
  /^(?:apps|packages)\/[^/]+\/src\//.test(rel) &&
  /\.(?:[cm]?[jt]sx?)$/.test(rel) &&
  !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel) &&
  !/\/(?:e2e|__tests__|test)\//.test(rel) &&
  // The server sets headers; it does not run in a browser.
  !rel.startsWith('apps/server/')

const lineOf = (text, index) => text.slice(0, index).split('\n').length

export const scan = () => {
  const files = walk(root, [])
  const sources = []
  const usages = []
  let getUserMediaCalls = 0
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8')
    if (/permissions-policy/i.test(text)) {
      text.split('\n').forEach((line, index) => {
        const match = VALUE.exec(line)
        if (match) sources.push({ file: rel, line: index + 1, value: normalize(match[1]) })
      })
    }
    if (!isAppSource(rel)) continue
    for (const [pattern, feature] of API_RULES) {
      const re = new RegExp(pattern.source, 'g')
      for (let m = re.exec(text); m; m = re.exec(text)) usages.push({ file: rel, line: lineOf(text, m.index), api: m[0].replace(/\s+/g, ''), feature })
    }
    const gum = /\bgetUserMedia\s*\(/g
    for (let m = gum.exec(text); m; m = gum.exec(text)) {
      getUserMediaCalls += 1
      const window = text.slice(m.index, m.index + 400)
      const literal = /^getUserMedia\s*\(\s*\{([\s\S]*?)\}\s*\)/.exec(window) || /^getUserMedia\s*\(\s*\{([\s\S]*)/.exec(window)
      if (!literal) continue
      if (/\baudio\s*:/.test(literal[1])) usages.push({ file: rel, line: lineOf(text, m.index), api: 'getUserMedia({audio})', feature: 'microphone' })
      if (/\bvideo\s*:/.test(literal[1])) usages.push({ file: rel, line: lineOf(text, m.index), api: 'getUserMedia({video})', feature: 'camera' })
    }
  }
  return { files, sources, usages, getUserMediaCalls }
}

export const check = () => {
  const { sources, usages, getUserMediaCalls } = scan()
  const errors = []
  for (const required of REQUIRED_SOURCES) {
    let exists = true
    try {
      statSync(join(root, required))
    } catch {
      exists = false
    }
    if (exists && !sources.some((source) => source.file === required)) errors.push(`${required}: no Permissions-Policy value found (this file must ship the header)`)
  }
  const values = [...new Set(sources.map((source) => source.value))]
  if (values.length > 1) {
    errors.push(`Permissions-Policy differs between sources:\n${sources.map((s) => `    ${s.file}:${s.line}: ${s.value}`).join('\n')}`)
  }
  if (getUserMediaCalls > 0 && !usages.some((u) => u.feature === 'microphone' || u.feature === 'camera')) {
    errors.push('getUserMedia is called but no call passes literal { audio } / { video } constraints, so the needed feature cannot be inferred')
  }
  for (const value of values) {
    const policy = parsePolicy(value)
    for (const usage of usages) {
      const allow = policy.get(usage.feature)
      if (!allow) continue
      if (allow.length === 0) {
        errors.push(`${usage.file}:${usage.line}: ${usage.api} needs "${usage.feature}", but Permissions-Policy sets ${usage.feature}=() — the browser rejects it without a prompt`)
      } else if (!allow.includes('self') && !allow.includes('*')) {
        errors.push(`${usage.file}:${usage.line}: ${usage.api} needs "${usage.feature}", but Permissions-Policy sets ${usage.feature}=(${allow.join(' ')}) without self`)
      }
    }
  }
  return { sources, usages, values, errors }
}

const result = check()
if (json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else {
  for (const source of result.sources) console.log(`policy  ${source.file}:${source.line}  ${source.value}`)
  for (const usage of result.usages) console.log(`uses    ${usage.file}:${usage.line}  ${usage.api} -> ${usage.feature}`)
}
if (result.errors.length > 0) {
  for (const error of result.errors) console.error(`check-permissions-policy: ${error}`)
  process.exit(1)
}
if (!json) console.log(`check-permissions-policy: OK (${result.sources.length} sources, ${result.usages.length} API uses)`)
