#!/usr/bin/env node
// r19 (筑衡 07:56): product source must not carry measurement specimens.
// 21c8905 mounted ~1000 hidden, off-screen nodes from main.tsx, each painted with a spec value via !important,
// so a probe "measured" spec values on fake nodes. This gate fails the build on that pattern:
//   1. any data-sp attribute / dataset.sp in app source;
//   2. any id, class, file or import whose purpose is a spec-role / specimen / gallery node;
//   3. CSS rules scoped under a container the product hides (off-screen translate/offset >= 1000px,
//      opacity:0 + pointer-events:none, visibility:hidden, clip rect(0…)). A hidden container may carry its own
//      rule (e.g. the .sr visually-hidden helper), but no more than MAX_SCOPED other rules may style its subtree.
// There is no exception list and no comment that turns this off.
// Usage: node scripts/check-specimen.mjs [root ...]   (default: apps/web/src packages)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, basename } from 'node:path'

export const MAX_SCOPED = 2
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.turbo', 'e2e', 'test', 'tests', '__tests__'])
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f)
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?|mjs|css|html)$/.test(name) && !isTest(name)) out.push(p)
  }
  return out
}
const lineOf = (src, i) => src.slice(0, i).split('\n').length

const SOURCE_RULES = [
  [/data-sp\b|dataset\.sp\b|\[\s*['"]data-sp['"]/g, 'data-sp attribute'],
  [/spec[-_ ]?role|specrole/gi, 'spec-role specimen'],
  [/specimen/gi, 'specimen node'],
  [/gallery/gi, 'gallery specimen'],
]

const px = (v) => {
  const m = String(v).match(/-?\d+(?:\.\d+)?(?=px)/g)
  return m ? Math.max(...m.map((n) => Math.abs(Number(n)))) : 0
}
const hides = (decls) => {
  const get = (k) => decls.get(k) ?? ''
  if (/translate/i.test(get('transform')) && px(get('transform')) >= 1000) return 'translated off-screen'
  if (px(get('translate')) >= 1000) return 'translated off-screen'
  for (const k of ['left', 'top', 'right', 'bottom', 'inset', 'margin-left', 'margin-top']) if (/-/.test(get(k)) && px(get(k)) >= 1000) return `${k} off-screen`
  if (/^0(\.0+)?$/.test(get('opacity').trim()) && /none/.test(get('pointer-events'))) return 'opacity:0 + pointer-events:none'
  if (/hidden/.test(get('visibility'))) return 'visibility:hidden'
  if (/rect\(\s*0/.test(get('clip'))) return 'clip rect(0)'
  return ''
}

export const problemsFor = (file, src, postcss) => {
  const out = []
  for (const [re, what] of SOURCE_RULES) {
    re.lastIndex = 0
    const hitName = re.test(basename(file))
    re.lastIndex = 0
    if (hitName) out.push({ file, line: 1, message: `${file}: file name looks like a ${what}` })
    let m
    while ((m = re.exec(src))) out.push({ file, line: lineOf(src, m.index), message: `${file}:${lineOf(src, m.index)}: ${what} in product source ("${m[0]}")` })
  }
  if (file.endsWith('.css') && postcss) {
    const root = postcss.parse(src, { from: file })
    const rules = []
    root.walkRules((r) => {
      const decls = new Map()
      r.each((n) => { if (n.type === 'decl') decls.set(n.prop.toLowerCase(), String(n.value)) })
      for (const s of r.selectors) rules.push({ sel: s.trim(), decls, line: r.source?.start?.line ?? 0 })
    })
    const hidden = new Map()
    for (const r of rules) { const why = hides(r.decls); if (why && !hidden.has(r.sel)) hidden.set(r.sel, { why, line: r.line }) }
    for (const [sel, info] of hidden) {
      const scoped = rules.filter((r) => r.sel !== sel && (r.sel.startsWith(sel + ' ') || r.sel.startsWith(sel + '>') || r.sel.startsWith(sel + ' >')) && r.decls.size)
      if (scoped.length > MAX_SCOPED) out.push({ file, line: info.line, message: `${file}:${info.line}: ${scoped.length} rules are scoped under ${sel}, which the product hides (${info.why}); specimen styles are not allowed` })
    }
  }
  return out
}

const main = () => {
  const require = createRequire(process.cwd() + '/')
  let postcss = null
  try { postcss = require(process.env.POSTCSS || 'postcss') } catch { postcss = null }
  if (!postcss) { console.error('check-specimen: postcss not found'); process.exit(2) }
  const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['apps/web/src', 'packages']
  let bad = 0
  for (const r of roots) for (const f of walk(r)) for (const p of problemsFor(f, readFileSync(f, 'utf8'), postcss)) { console.error(p.message); bad++ }
  if (bad) { console.error(`check-specimen: ${bad} problem(s)`); process.exit(1) }
  console.log('check-specimen ok')
}
if (import.meta.url === `file://${process.argv[1]}`) main()
