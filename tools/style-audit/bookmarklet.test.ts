import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCaptureScripts } from './build.ts'

const root = join(import.meta.dirname, '../..')

const check = (name: string, source: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'style-audit-'))
  const file = join(dir, name)
  writeFileSync(file, source)
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  new Function(source)
}

test('bookmarklet and console capture scripts parse', () => {
  const built = buildCaptureScripts(root)
  const body = built.bookmarklet.slice('javascript:'.length)
  assert.equal(built.bookmarklet.startsWith('javascript:(()=>'), true)
  assert.equal(built.bookmarklet.includes('void('), false)
  assert.equal(body, built.program)
  const callAt = body.lastIndexOf('captureStyleAudit()')
  const closeAt = body.lastIndexOf('})()')
  assert.ok(callAt > 0 && callAt < closeAt)
  check('console.js', `${built.program}\n`)
  check('bookmarklet.js', `${built.bookmarklet}\n`)
  check('bookmarklet-body.js', body)
})
