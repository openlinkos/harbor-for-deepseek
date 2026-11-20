#!/usr/bin/env node
// fb1344: CSS well-formedness gate (goes to scripts/check-css.mjs; run in ci.yml before build).
// Fails on declarations outside any rule and on selectors the browser would drop — the class of bug that left
// `.avatar` without font-weight/color and dropped `.user-row small` (styles.css since #29).
// Usage: node check-css.mjs apps/web/src/*.css
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(process.cwd() + '/')
const postcss = require(process.env.POSTCSS || 'postcss')
let bad = 0
for (const f of process.argv.slice(2)) {
  const src = readFileSync(f, 'utf8')
  let root; try { root = postcss.parse(src, { from: f }) } catch (e) { console.error(`${f}: parse error ${e.message}`); bad++; continue }
  root.walk((n) => {
    if (n.type === 'decl' && (n.parent.type === 'root' || (n.parent.type === 'atrule' && /^(media|supports|layer|container)$/.test(n.parent.name)))) { console.error(`${f}:${n.source.start.line} declaration outside a rule: ${n.prop}: ${n.value}`); bad++ }
    if (n.type === 'rule' && /[;{}]|^\s*[a-z-]+\s*:\s*[^:]+;/i.test(n.selector)) { console.error(`${f}:${n.source.start.line} invalid selector (browser drops the rule): ${n.selector.slice(0, 80).replace(/\n/g, ' ')}`); bad++ }
  })
}
if (bad) { console.error(`check-css: ${bad} problem(s)`); process.exit(1) } else console.log('check-css ok')
