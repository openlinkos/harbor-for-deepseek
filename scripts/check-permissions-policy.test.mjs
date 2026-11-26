import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'check-permissions-policy.mjs')
const repo = join(here, '..')

const run = (root, ...flags) => spawnSync(process.execPath, [script, root, ...flags], { encoding: 'utf8' })

const fixture = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'ppolicy-'))
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, body)
  }
  return root
}

const withFixture = (files, fn) => {
  const root = fixture(files)
  try {
    fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const nginx = (value) => `add_header Permissions-Policy "${value}" always;\n`
const pages = (value) => `/*\n  Permissions-Policy: ${value}\n`
const recorder = "export const open = () => navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })\n"

// The expected production value: the voice input needs the microphone on our own
// origin; camera and geolocation are not used and stay off.
const EXPECTED = 'camera=(), microphone=(self), geolocation=()'

test('the repository passes the check', () => {
  const result = run(repo)
  assert.equal(result.status, 0, result.stderr)
})

test('every repository source ships the expected value, microphone on self, camera and geolocation off', () => {
  const result = run(repo, '--json')
  const report = JSON.parse(result.stdout)
  assert.deepEqual(report.values, [EXPECTED], JSON.stringify(report.sources, null, 2))
  const files = new Set(report.sources.map((source) => source.file))
  for (const required of [
    'deploy/web/nginx/security-headers.conf',
    'deploy/Caddyfile',
    'apps/web/public/_headers',
    'scripts/postbuild.mjs',
    'apps/server/src/app.ts',
    'docs/deploy.md',
    'deploy/web/smoke.sh',
  ]) {
    assert.ok(files.has(required), `${required} carries no Permissions-Policy value`)
  }
  assert.ok(report.usages.some((usage) => usage.feature === 'microphone' && usage.file === 'apps/web/src/speech/recorder.ts'), 'the recorder getUserMedia call was not detected')
})

test('getUserMedia({ audio }) with microphone=() exits 1', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx('camera=(), microphone=(), geolocation=()'),
    'apps/web/src/speech/recorder.ts': recorder,
  }, (root) => {
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /apps\/web\/src\/speech\/recorder\.ts:1: getUserMedia\(\{audio\}\) needs "microphone".*microphone=\(\)/)
  })
})

test('getUserMedia({ audio }) with microphone=(self) and camera=() exits 0', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx(EXPECTED),
    'apps/web/public/_headers': pages(EXPECTED),
    'apps/web/src/speech/recorder.ts': recorder,
  }, (root) => {
    const result = run(root)
    assert.equal(result.status, 0, result.stderr)
  })
})

test('a microphone allowlist without self exits 1', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx('microphone=("https://other.example")'),
    'apps/web/src/speech/recorder.ts': recorder,
  }, (root) => {
    assert.equal(run(root).status, 1)
  })
})

test('getUserMedia({ video }) with camera=() exits 1', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx(EXPECTED),
    'apps/web/src/scan.ts': 'export const scan = () => navigator.mediaDevices.getUserMedia({ video: true })\n',
  }, (root) => {
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /camera=\(\)/)
  })
})

test('navigator.geolocation with geolocation=() exits 1', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx(EXPECTED),
    'packages/maps/src/where.ts': 'export const where = () => navigator.geolocation.getCurrentPosition(() => {})\n',
  }, (root) => {
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /packages\/maps\/src\/where\.ts:1: navigator\.geolocation needs "geolocation"/)
  })
})

test('optional-chained clipboard writes are detected', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx('clipboard-write=()'),
    'apps/web/src/copy.ts': 'export const copy = (t: string) => navigator.clipboard?.writeText(t)\n',
  }, (root) => {
    assert.equal(run(root).status, 1)
  })
})

test('API calls in tests and the server are ignored', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx('camera=(), microphone=(), geolocation=()'),
    'apps/web/src/speech/recorder.test.ts': recorder,
    'apps/web/e2e/speech.spec.ts': recorder,
    'apps/server/src/app.ts': "c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')\n",
  }, (root) => {
    assert.equal(run(root).status, 0, run(root).stderr)
  })
})

test('sources that disagree exit 1 and name each file', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx(EXPECTED),
    'deploy/Caddyfile': `\theader {\n\t\tPermissions-Policy "camera=(), microphone=(), geolocation=()"\n\t}\n`,
  }, (root) => {
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /differs between sources/)
    assert.match(result.stderr, /deploy\/Caddyfile:2/)
    assert.match(result.stderr, /deploy\/web\/nginx\/security-headers\.conf:1/)
  })
})

test('a required source that loses its header exits 1', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx(EXPECTED),
    'apps/server/src/app.ts': "c.header('X-Frame-Options', 'DENY')\n",
  }, (root) => {
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /apps\/server\/src\/app\.ts: no Permissions-Policy value found/)
  })
})

test('getUserMedia without literal constraints anywhere exits 1', () => {
  withFixture({
    'deploy/web/nginx/security-headers.conf': nginx(EXPECTED),
    'apps/web/src/media.ts': 'export const open = (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c)\n',
  }, (root) => {
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /cannot be inferred/)
  })
})
