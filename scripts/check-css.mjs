#!/usr/bin/env node
// fb1344: CSS well-formedness gate. ci.yml runs this before the build.
// Fails on declarations outside any rule and on selectors the browser would drop — the class of bug that left
// `.avatar` without font-weight/color and dropped `.user-row small` (styles.css since #29).
// Usage: node scripts/check-css.mjs apps/web/src/*.css
//
// A known exception is allowed only while it still fails. When that problem is gone, this script exits 1
// so the fix PR has to delete the exception (same rule as test.fail in the e2e gate).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const KNOWN_EXCEPTIONS = []

const require = createRequire(process.cwd() + '/')
const postcss = require(process.env.POSTCSS || 'postcss')
const norm = (p) => p.replaceAll('\\', '/')
const lineOfIndex = (src, index) => src.slice(0, index).split('\n').length

const parseProblems = (file, src) => {
  try {
    const root = postcss.parse(src, { from: file })
    const problems = []
    root.walk((n) => {
      if (n.type === 'decl' && (n.parent.type === 'root' || (n.parent.type === 'atrule' && /^(media|supports|layer|container)$/.test(n.parent.name)))) {
        problems.push({ line: n.source.start.line, message: `${file}:${n.source.start.line} declaration outside a rule: ${n.prop}: ${n.value}` })
      }
      if (n.type === 'rule' && /[;{}]|^\s*[a-z-]+\s*:\s*[^:]+;/i.test(n.selector)) {
        problems.push({ line: n.source.start.line, message: `${file}:${n.source.start.line} invalid selector (browser drops the rule): ${n.selector.slice(0, 80).replace(/\n/g, ' ')}` })
      }
    })
    return problems
  } catch (e) {
    const line = e.line || 0
    return [{ line, parse: true, message: `${file}:${line || '?'} parse error ${e.reason || e.message}` }]
  }
}

let bad = 0
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8')
  const located = []
  for (const ex of KNOWN_EXCEPTIONS.filter((ex) => norm(file).endsWith(ex.file))) {
    const at = src.indexOf(ex.snippet)
    if (at < 0) {
      console.error(`${ex.id}: 例外不再发生（${ex.file} 已没有 styles.css:587-591 那段游离声明）。删掉 scripts/check-css.mjs 里的 ${ex.id}。`)
      bad++
      continue
    }
    if (src.indexOf(ex.snippet, at + 1) >= 0) {
      console.error(`${ex.id}: 例外片段在 ${file} 里出现了多次，拒绝放行`)
      bad++
      continue
    }
    const start = lineOfIndex(src, at)
    located.push({ ex, at, start, end: start + ex.snippet.split('\n').length - 1 })
  }

  const problems = parseProblems(file, src)
  const covered = new Set()
  const uncovered = []
  for (const p of problems) {
    const hit = located.find((r) => p.line >= r.start && p.line <= r.end)
    if (hit) covered.add(hit.ex.id)
    else uncovered.push(p)
  }
  // The known `}` is a parse error, so postcss stops and would hide any other problem in this file.
  // Blank the exception and parse again. Line numbers stay put because the replacement is the same height.
  if (problems.some((p) => p.parse && located.some((r) => p.line >= r.start && p.line <= r.end))) {
    let excised = src
    for (const r of [...located].sort((a, b) => b.at - a.at)) {
      excised = excised.slice(0, r.at) + r.ex.snippet.split('\n').map(() => '').join('\n') + excised.slice(r.at + r.ex.snippet.length)
    }
    for (const p of parseProblems(file, excised)) {
      if (!located.some((r) => p.line >= r.start && p.line <= r.end)) uncovered.push(p)
    }
  }

  for (const r of located) {
    if (covered.has(r.ex.id)) console.log(`${r.ex.id}: 已知例外仍在 ${file}:${r.start}-${r.end}，放行。修好后删掉这条。`)
    else {
      console.error(`${r.ex.id}: 例外不再发生（${file}:${r.start}-${r.end} 已不再报游离声明或解析错误）。删掉 scripts/check-css.mjs 里的 ${r.ex.id}。`)
      bad++
    }
  }
  for (const p of uncovered) {
    console.error(p.message)
    bad++
  }
}
if (bad) {
  console.error(`check-css: ${bad} problem(s)`)
  process.exit(1)
}
console.log('check-css ok')
