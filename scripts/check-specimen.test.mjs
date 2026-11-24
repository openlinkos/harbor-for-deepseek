import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { problemsFor } from './check-specimen.mjs'

const postcss = createRequire(process.cwd() + '/')(process.env.POSTCSS || 'postcss')
const file = 'apps/web/src/styles.css'
const base = readFileSync(file, 'utf8')

test('current product sources carry no specimen nodes', () => {
  assert.deepEqual(problemsFor(file, base, postcss).map((p) => p.message), [])
  const main = 'apps/web/src/main.tsx'
  assert.deepEqual(problemsFor(main, readFileSync(main, 'utf8'), postcss).map((p) => p.message), [])
})

test('data-sp, spec-role and gallery specimens are rejected', () => {
  const ts = `const n = document.createElement('div'); n.setAttribute('data-sp', 'SP-1'); n.dataset.sp = 'x'; n.id = 'ds-spec-role-gallery'; import './specimens'`
  const messages = problemsFor('apps/web/src/main.tsx', ts, postcss).map((p) => p.message).join('\n')
  for (const what of ['data-sp attribute', 'spec-role specimen', 'gallery specimen', 'specimen node']) assert.match(messages, new RegExp(what))
  assert.match(problemsFor('apps/web/src/role-gallery.ts', '', postcss).map((p) => p.message).join('\n'), /file name/)
})

test('rules scoped under a hidden container are rejected even without telltale names', () => {
  const css = `${base}
#x-host { position: fixed; transform: translateX(-20000px); opacity: 0; pointer-events: none; }
#x-host [data-k="1"] { margin-left: 2px !important; }
#x-host [data-k="2"] { margin-right: 0 !important; }
#x-host .b { color: red !important; }
.parked { position: absolute; left: -9999px; }
.parked > i { color: red; } .parked .a { color: red; } .parked .c { color: blue; }
`
  const messages = problemsFor(file, css, postcss).map((p) => p.message).join('\n')
  assert.match(messages, /scoped under #x-host/)
  assert.match(messages, /scoped under \.parked/)
})

test('a visually-hidden helper on its own is allowed', () => {
  const css = `.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }`
  assert.deepEqual(problemsFor(file, css, postcss), [])
})
