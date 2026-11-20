import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseProblems } from './check-css.mjs'

const file = 'apps/web/src/styles.css'
const base = readFileSync(file, 'utf8')

test('current stylesheet has no broad-button or cite-group offset', () => {
  const problems = parseProblems(file, base)
  assert.equal(problems.length, 0, problems.map((p) => p.message).join('\n'))
})

test('broad descendant variants and group offsets are rejected', () => {
  const extra = `
.thinking button > svg { color: red; }
[data-testid=thinking] button { color: red; }
.thinking :is(button) { color: red; }
.thinking > * { color: red; }
[data-citation-group] { position: relative; top: 1px; }
.favicons { left: 2px; }
`
  const messages = parseProblems(file, `${base}\n${extra}`).map((p) => p.message).join('\n')
  for (const snippet of ['.thinking button > svg', '[data-testid=thinking] button', ':is(button)', '.thinking > *', 'data-citation-group', '.favicons']) {
    assert.match(messages, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
