import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changelogHasVersion, evaluate, isExempt, isShipped, parseSemver, versionGreater } from './check-version.mjs'

test('semver compare only counts a real increase', () => {
  assert.deepEqual(parseSemver('0.1.1'), [0, 1, 1])
  assert.equal(parseSemver('0.1'), null)
  assert.equal(parseSemver('0.1.1-beta'), null)
  assert.equal(versionGreater('0.1.1', '0.1.0'), true)
  assert.equal(versionGreater('0.2.0', '0.1.9'), true)
  assert.equal(versionGreater('1.0.0', '0.9.9'), true)
  assert.equal(versionGreater('0.1.0', '0.1.0'), false)
  assert.equal(versionGreater('0.0.1', '0.1.0'), false)
})

test('changelog heading must be the exact version', () => {
  const body = '## Unreleased\n\n## 0.1.1 — 2026-11-20\n\nnote\n\n## 0.1.10 — 2026-11-01\n'
  assert.equal(changelogHasVersion(body, '0.1.1'), true)
  assert.equal(changelogHasVersion(body, '0.1.10'), true)
  assert.equal(changelogHasVersion(body, '0.1.2'), false)
  assert.equal(changelogHasVersion('## [0.2.0]\n', '0.2.0'), true)
})

test('tests and docs under apps or packages are exempt', () => {
  assert.equal(isShipped('apps/web/src/ui.tsx'), true)
  assert.equal(isShipped('packages/i18n/src/index.ts'), true)
  assert.equal(isShipped('apps/web/src/styles.css'), true)
  assert.equal(isShipped('apps/web/public/sw.js'), true)
  assert.equal(isExempt('apps/web/e2e/product-version.spec.ts'), true)
  assert.equal(isShipped('apps/web/e2e/product-version.spec.ts'), false)
  assert.equal(isShipped('apps/web/src/csp.test.ts'), false)
  assert.equal(isShipped('packages/types/src/index.test.ts'), false)
  assert.equal(isShipped('apps/web/README.md'), false)
  assert.equal(isShipped('apps/web/playwright.config.ts'), false)
  assert.equal(isShipped('scripts/check-version.mjs'), false)
  assert.equal(isShipped('CHANGELOG.md'), false)
  assert.equal(isShipped('deploy/web/nginx/nginx.conf'), false)
})

test('shipped edits fail until the version rises and the changelog names it', () => {
  const files = ['apps/web/src/ui.tsx', 'apps/web/e2e/product-version.spec.ts']
  const same = evaluate({ files, headVersion: '0.1.0', baseVersion: '0.1.0', changelog: '## 0.1.0\n' })
  assert.equal(same.ok, false)
  const downgrade = evaluate({ files, headVersion: '0.0.1', baseVersion: '0.1.0', changelog: '## 0.0.1\n' })
  assert.equal(downgrade.ok, false)
  const missingLog = evaluate({ files, headVersion: '0.1.1', baseVersion: '0.1.0', changelog: '## 0.1.0\n' })
  assert.equal(missingLog.ok, false)
  const ok = evaluate({ files, headVersion: '0.1.1', baseVersion: '0.1.0', changelog: '## 0.1.1 — 2026-11-20\n' })
  assert.equal(ok.ok, true)
  assert.match(ok.message, /0\.1\.0 → 0\.1\.1/)
})

test('pure tests or docs do not require a bump', () => {
  const onlyTests = evaluate({
    files: ['apps/web/e2e/product-version.spec.ts', 'apps/server/src/server.test.ts', 'CONTRIBUTING.md'],
    headVersion: '0.1.0',
    baseVersion: '0.1.0',
    changelog: '',
  })
  assert.equal(onlyTests.ok, true)
})
