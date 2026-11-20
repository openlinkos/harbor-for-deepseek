#!/usr/bin/env node
// PR version gate. One source of truth: the "version" field in the root package.json.
//
// A pull request must raise that semver (patch, minor, or major — at least one
// component, and not a downgrade) above origin/master, and CHANGELOG.md must have
// a heading for the new version, when the diff touches a file under apps/ or
// packages/ that ships in an artifact.
//
// Exemption (pure tests or pure docs — kept here, not in a separate note):
// a file under apps/ or packages/ does not count when
//   - it is markdown (*.md, *.mdx)
//   - it lives in e2e/, __tests__/, fixtures/, or __snapshots__/
//   - its name is *.test.* or *.spec.* (ts, tsx, js, mjs, cjs, jsx)
//   - it is a playwright config (playwright*.ts)
// If every apps/ and packages/ change is one of those, the version may stay put.
// Files outside apps/ and packages/ (scripts, deploy, workflows, the root
// package.json itself) never require a bump on their own.
//
// Compare with: VERSION_BASE=origin/master node scripts/check-version.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseRef = process.env.VERSION_BASE || 'origin/master'

export const parseSemver = (value) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value ?? '')
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export const versionGreater = (head, base) => {
  const left = parseSemver(head)
  const right = parseSemver(base)
  if (!left || !right) return false
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index]
  }
  return false
}

// A heading whose version token is exactly `version`, not a longer semver.
export const changelogHasVersion = (changelog, version) => {
  const escaped = version.replace(/\./g, '\\.')
  const heading = new RegExp(`^#{1,3}\\s+\\[?${escaped}\\]?(?:\\s|\\(|—|-|$)`)
  return changelog.split('\n').some((line) => heading.test(line.trim()))
}

const norm = (file) => file.replaceAll('\\', '/')

export const isExempt = (file) => {
  const path = norm(file)
  if (path.endsWith('.md') || path.endsWith('.mdx')) return true
  if (path.includes('/e2e/') || path.includes('/__tests__/') || path.includes('/fixtures/') || path.includes('/__snapshots__/')) return true
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return true
  if (/\/playwright[^/]*\.ts$/.test(path)) return true
  return false
}

export const isShipped = (file) => {
  const path = norm(file)
  if (!path.startsWith('apps/') && !path.startsWith('packages/')) return false
  return !isExempt(path)
}

const git = (args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const changedFiles = () => {
  const tracked = git(['diff', '--name-only', baseRef]).split('\n').map((line) => line.trim()).filter(Boolean)
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').map((line) => line.trim()).filter(Boolean)
  return [...new Set([...tracked, ...untracked])]
}

export const evaluate = ({ files, headVersion, baseVersion, changelog }) => {
  const shipped = files.filter(isShipped)
  if (!parseSemver(headVersion)) {
    return { ok: false, shipped, message: `版本检查未通过：根目录 package.json 的 version 必须是 X.Y.Z，当前是 ${headVersion}` }
  }
  if (shipped.length === 0) {
    return { ok: true, shipped, message: '版本检查通过：没有改动会进入产物的文件（测试和文档豁免）。' }
  }
  if (!parseSemver(baseVersion)) {
    return { ok: false, shipped, message: `版本检查未通过：无法解析 ${baseRef} 的 version（${baseVersion}）。` }
  }
  if (!versionGreater(headVersion, baseVersion)) {
    return {
      ok: false,
      shipped,
      message: `版本检查未通过：改了会进入产物的文件，但版本 ${headVersion} 没有高于 ${baseRef} 的 ${baseVersion}。请提升根目录 package.json 的 version（patch、minor 或 major 至少涨一个），并在 CHANGELOG.md 写下该版本。\n${shipped.slice(0, 40).join('\n')}`,
    }
  }
  if (!changelogHasVersion(changelog, headVersion)) {
    return {
      ok: false,
      shipped,
      message: `版本检查未通过：版本已升到 ${headVersion}，但 CHANGELOG.md 没有对应标题（例如 ## ${headVersion}）。`,
    }
  }
  return { ok: true, shipped, message: `版本检查通过：${baseVersion} → ${headVersion}` }
}

export const main = () => {
  let headRaw
  let baseRaw
  let files
  let changelog
  try {
    headRaw = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
    baseRaw = JSON.parse(git(['show', `${baseRef}:package.json`])).version
    files = changedFiles()
    changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(`版本检查未通过：读不到 ${baseRef} 或仓库文件。\n${detail}`)
    return 1
  }
  const result = evaluate({ files, headVersion: headRaw, baseVersion: baseRaw, changelog })
  if (result.ok) {
    console.log(result.message)
    return 0
  }
  console.error(result.message)
  return 1
}

const invoked = process.argv[1] ? realpathSync(resolve(process.argv[1])) : ''
if (invoked && invoked === realpathSync(fileURLToPath(import.meta.url))) {
  process.exit(main())
}
