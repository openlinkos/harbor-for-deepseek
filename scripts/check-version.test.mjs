import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { evaluate, isChangeNote, isShipped } from './check-version.mjs'
import { productVersion } from './release-meta.mjs'

test('shipped paths and change notes', () => {
  assert.equal(isShipped('apps/web/src/ui.tsx'), true)
  assert.equal(isShipped('apps/web/e2e/product-version.spec.ts'), false)
  assert.equal(isShipped('apps/web/src/csp.test.ts'), false)
  assert.equal(isShipped('scripts/release-meta.mjs'), false)
  assert.equal(isChangeNote('changes/product-version.md'), true)
  assert.equal(isChangeNote('changes/Product.md'), false)
  assert.equal(isChangeNote('docs/product-version.md'), false)
})

test('a shipped edit needs a new Chinese fragment', () => {
  const files = ['apps/web/src/ui.tsx', 'apps/web/e2e/product-version.spec.ts']
  const missing = evaluate({ files, notes: [], bodies: {} })
  assert.equal(missing.ok, false)
  const empty = evaluate({ files, notes: ['changes/product-version.md'], bodies: { 'changes/product-version.md': '   \n' } })
  assert.equal(empty.ok, false)
  const english = evaluate({ files, notes: ['changes/product-version.md'], bodies: { 'changes/product-version.md': 'Show the version.\n' } })
  assert.equal(english.ok, false)
  const ok = evaluate({
    files,
    notes: ['changes/product-version.md'],
    bodies: { 'changes/product-version.md': '设置页显示当前版本。\n' },
  })
  assert.equal(ok.ok, true)
})

test('pure tests do not require a fragment', () => {
  const onlyTests = evaluate({
    files: ['apps/web/e2e/product-version.spec.ts', 'CONTRIBUTING.md'],
    notes: [],
    bodies: {},
  })
  assert.equal(onlyTests.ok, true)
})

const git = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })

const initRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'deepapi-ver-'))
  git(dir, ['init', '-b', 'master'])
  git(dir, ['config', 'user.email', 'version@example.com'])
  git(dir, ['config', 'user.name', 'version'])
  writeFileSync(join(dir, 'package.json'), '{"version":"0.1.0"}\n')
  git(dir, ['add', 'package.json'])
  git(dir, ['commit', '-m', 'base'])
  return dir
}

test('two consecutive commits compute different versions', () => {
  const dir = initRepo()
  try {
    const first = productVersion(dir, {})
    writeFileSync(join(dir, 'note.txt'), 'one\n')
    git(dir, ['add', 'note.txt'])
    git(dir, ['commit', '-m', 'second'])
    const second = productVersion(dir, {})
    assert.equal(first, '0.1.0')
    assert.equal(second, '0.1.1')
    assert.notEqual(first, second)
    writeFileSync(join(dir, 'note.txt'), 'two\n')
    git(dir, ['add', 'note.txt'])
    git(dir, ['commit', '-m', 'third'])
    assert.equal(productVersion(dir, {}), '0.1.2')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a merge counts once on the first parent', () => {
  const dir = initRepo()
  try {
    git(dir, ['checkout', '-b', 'side'])
    writeFileSync(join(dir, 'side.txt'), 'side\n')
    git(dir, ['add', 'side.txt'])
    git(dir, ['commit', '-m', 'side'])
    git(dir, ['checkout', 'master'])
    git(dir, ['merge', '--no-ff', '-m', 'merge side', 'side'])
    assert.equal(productVersion(dir, {}), '0.1.1')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a shallow clone fails instead of reporting patch 0', () => {
  const dir = initRepo()
  const shallow = mkdtempSync(join(tmpdir(), 'deepapi-shallow-'))
  try {
    writeFileSync(join(dir, 'note.txt'), 'one\n')
    git(dir, ['add', 'note.txt'])
    git(dir, ['commit', '-m', 'second'])
    git(shallow, ['clone', '--depth', '1', `file://${dir}`, '.'])
    assert.throws(() => productVersion(shallow, {}), /浅克隆|DEEPAPI_VERSION/)
    assert.equal(productVersion(shallow, { DEEPAPI_VERSION: '0.1.4' }), '0.1.4')
    assert.throws(() => productVersion(shallow, { DEEPAPI_VERSION: '0' }), /DEEPAPI_VERSION/)
    assert.throws(() => productVersion(shallow, { DEEPAPI_VERSION: '0.2.1' }), /0\.1\.Z/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(shallow, { recursive: true, force: true })
  }
})
