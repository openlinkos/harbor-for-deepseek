#!/usr/bin/env node
// fb1344 version gate (goes to scripts/check-version.mjs in the app repo; run in ci.yml).
// 1) root package.json "version" is strict semver X.Y.Z; apps/web/package.json carries the same value.
// 2) On a PR (BASE_REF set): if shipped paths changed vs origin/<base>, version must be strictly greater than base's,
//    and CHANGELOG.md must have a "## X.Y.Z — YYYY-MM-DD" heading for it.
// 3) After build (--dist apps/web/dist): dist/version.json and <meta name="app-version"/"commit-id"> match package.json and GIT_SHA.
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const SHIPPED = /^(apps\/web\/|packages\/|scripts\/|deploy\/web\/|package\.json$|pnpm-lock\.yaml$)/
const fail = (m) => { console.error('version gate: ' + m); process.exitCode = 1 }
const pkg = JSON.parse(readFileSync('package.json', 'utf8')); const web = JSON.parse(readFileSync('apps/web/package.json', 'utf8'))
if (!SEMVER.test(pkg.version)) fail(`package.json version "${pkg.version}" is not X.Y.Z`)
if (web.version !== pkg.version) fail(`apps/web/package.json ${web.version} ≠ package.json ${pkg.version}`)
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0 }
const base = process.env.BASE_REF
if (base) {
  const changed = execSync(`git diff --name-only origin/${base}...HEAD`, { encoding: 'utf8' }).split('\n').filter(Boolean)
  if (changed.some((f) => SHIPPED.test(f))) {
    const prev = JSON.parse(execSync(`git show origin/${base}:package.json`, { encoding: 'utf8' })).version
    if (!(cmp(pkg.version, prev) > 0)) fail(`shipped files changed but version ${pkg.version} is not greater than ${base} ${prev} (bump patch for fixes, minor for features)`)
    if (!new RegExp(`^## ${pkg.version.replace(/\./g, '\\.')} — \\d{4}-\\d{2}-\\d{2}$`, 'm').test(readFileSync('CHANGELOG.md', 'utf8'))) fail(`CHANGELOG.md has no "## ${pkg.version} — YYYY-MM-DD" heading`)
  }
}
const di = process.argv.indexOf('--dist')
if (di > 0) {
  const dist = process.argv[di + 1]; const sha = (process.env.GIT_SHA || '').slice(0, 7)
  if (!existsSync(`${dist}/version.json`)) fail('dist/version.json missing')
  else { const v = JSON.parse(readFileSync(`${dist}/version.json`, 'utf8'))
    if (v.version !== pkg.version) fail(`version.json ${v.version} ≠ ${pkg.version}`)
    if (sha && v.commit !== sha) fail(`version.json commit ${v.commit} ≠ ${sha}`) }
  const html = readFileSync(`${dist}/index.html`, 'utf8')
  if (!html.includes(`<meta name="app-version" content="${pkg.version}"`)) fail('index.html lacks <meta name="app-version">')
  if (sha && !html.includes(`<meta name="commit-id" content="${sha}"`)) fail('index.html lacks <meta name="commit-id">')
}
if (!process.exitCode) console.log(`version gate ok: v${pkg.version}`)
