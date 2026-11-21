import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-brand.mjs')

const run = (root) => spawnSync(process.execPath, [script, root], { encoding: 'utf8' })

const fixture = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'brand-'))
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, body)
  }
  return root
}

test('a user-visible DeepSeek string exits 1', () => {
  const root = fixture({
    'apps/web/src/ui.tsx': "export const label = '给 DeepSeek 发送消息'\n",
  })
  try {
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /apps\/web\/src\/ui\.tsx:1: 给 DeepSeek 发送消息/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('an allowlisted model id and API host exit 0', () => {
  const root = fixture({
    'apps/web/src/model.ts': [
      "export const model = 'deepseek-flash'",
      "export const tool = 'deepseek_web_search'",
      "export const url = 'https://api.deepseek.com/anthropic/v1/messages'",
      '',
    ].join('\n'),
  })
  try {
    const result = run(root)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /check-brand ok/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('comments are ignored and a prose name beside a host still fails', () => {
  const comment = fixture({
    'packages/i18n/src/index.ts': "// DeepSeek\nexport const name = 'DeepAPI'\n",
    'apps/web/src/note.css': '/* 深度求索 */\n.ok { color: black; }\n',
  })
  const prose = fixture({
    'apps/web/src/ui.tsx': "export const line = 'Open DeepSeek at https://api.deepseek.com'\n",
  })
  try {
    const ignored = run(comment)
    assert.equal(ignored.status, 0, ignored.stderr)
    const leaked = run(prose)
    assert.equal(leaked.status, 1)
    assert.match(leaked.stderr, /Open DeepSeek at https:\/\/api\.deepseek\.com/)
  } finally {
    rmSync(comment, { recursive: true, force: true })
    rmSync(prose, { recursive: true, force: true })
  }
})
