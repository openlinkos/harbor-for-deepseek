import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
const FULL_SHA = /^[0-9a-f]{40}$/i

const git = (root, args, allowFail = false) => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (allowFail) return ''
    const detail = error instanceof Error && 'stderr' in error ? String(error.stderr || error.message) : String(error)
    throw new Error(`git ${args.join(' ')} 失败：${detail.trim()}`)
  }
}

export const parseSemver = (value) => {
  const match = SEMVER.exec(value ?? '')
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export const majorMinor = (value) => {
  const parts = parseSemver(value)
  if (!parts) return null
  return `${parts[0]}.${parts[1]}`
}

const readDeclared = (root) => {
  let raw
  try {
    raw = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
  } catch (error) {
    throw new Error(`读不到 ${root}/package.json：${error instanceof Error ? error.message : error}`)
  }
  if (!parseSemver(raw)) {
    throw new Error(`根目录 package.json 的 version 必须是 major.minor.patch（patch 固定写 0），得到 ${JSON.stringify(raw)}`)
  }
  return raw
}

const versionAt = (root, rev) => {
  const raw = git(root, ['show', `${rev}:package.json`], true)
  if (!raw) return null
  try {
    return JSON.parse(raw).version
  } catch {
    return null
  }
}

const hasCommit = (root, sha) => {
  const out = git(root, ['cat-file', '-t', sha], true)
  return out === 'commit'
}

const firstParent = (root, rev) => {
  const text = git(root, ['cat-file', '-p', rev])
  const line = text.split('\n').find((item) => item.startsWith('parent '))
  return line ? line.slice('parent '.length).trim() : ''
}

const incompleteHistory = (detail, declared) =>
  `历史不完整（${detail}），算不出 ${declared} 的 patch。用 fetch-depth: 0 重新检出，或传入 DEEPAPI_VERSION=X.Y.Z。拒绝把 patch 当成 0。`

// Patch is the number of first-parent commits after the commit that introduced
// the current major.minor. The introducing commit itself is X.Y.0. Each later
// first-parent commit (a merge to master counts as one) adds one. A missing
// parent, or no .git at all, fails with the same message. The patch is never
// silently treated as 0.
export const patchSinceMinor = (root, declared) => {
  let rev
  try {
    rev = git(root, ['rev-parse', 'HEAD'])
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (/not a git repository|\.git/i.test(detail)) throw new Error(incompleteHistory('没有 .git', declared))
    throw error
  }
  let steps = 0
  for (let guard = 0; guard < 100000; guard += 1) {
    const here = majorMinor(versionAt(root, rev) ?? '')
    if (here !== declared) return Math.max(0, steps - 1)
    const parent = firstParent(root, rev)
    if (!parent) return steps
    if (!hasCommit(root, parent)) throw new Error(incompleteHistory(`浅克隆停在 ${rev.slice(0, 7)}`, declared))
    steps += 1
    rev = parent
  }
  throw new Error('first-parent 历史过长，停止计算版本')
}

export const productVersion = (root = repoRoot, env = process.env) => {
  const declared = readDeclared(root)
  const pair = majorMinor(declared)
  const override = env.DEEPAPI_VERSION?.trim()
  if (override) {
    if (!parseSemver(override) || majorMinor(override) !== pair) {
      throw new Error(`DEEPAPI_VERSION 必须是 ${pair}.Z，得到 ${JSON.stringify(override)}`)
    }
    return override
  }
  const patch = patchSinceMinor(root, pair)
  return `${pair}.${patch}`
}

export const readVersion = () => productVersion(repoRoot, process.env)

const fromEnvCommit = (env) => {
  for (const value of [env.SOURCE_COMMIT, env.DEEPAPI_COMMIT]) {
    if (value && FULL_SHA.test(value)) return value.toLowerCase()
  }
  return ''
}

const fromGitCommit = (root) => {
  const sha = git(root, ['rev-parse', 'HEAD'], true)
  return FULL_SHA.test(sha) ? sha.toLowerCase() : ''
}

export const readCommit = (root = repoRoot, env = process.env) =>
  fromEnvCommit(env) || fromGitCommit(root) || (env.GITHUB_SHA && FULL_SHA.test(env.GITHUB_SHA) ? env.GITHUB_SHA.toLowerCase() : '') || 'unknown'

export const shortCommit = (full = readCommit()) => (full === 'unknown' ? 'unknown' : full.slice(0, 7))

const invoked = process.argv[1] ? realpathSync(resolve(process.argv[1])) : ''
if (invoked && invoked === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    console.log(process.argv.includes('--commit') ? readCommit() : readVersion())
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
