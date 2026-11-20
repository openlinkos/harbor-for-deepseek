#!/usr/bin/env node
// Pull-request gate for shipped edits. The product version is not edited here:
// package.json only stores major.minor, and the patch is computed at build time.
//
// When the diff touches a file under apps/ or packages/ that ships in an
// artifact, the pull request must add a new changes/<short-name>.md with a
// line or two of Chinese. A maintainer folds those fragments into CHANGELOG.md
// when tagging. Parallel pull requests therefore do not edit package.json or
// CHANGELOG.md.
//
// Exemption (pure tests or pure docs — kept here, not in a separate note):
// a file under apps/ or packages/ does not count when
//   - it is markdown (*.md, *.mdx)
//   - it lives in e2e/, __tests__/, fixtures/, or __snapshots__/
//   - its name is *.test.* or *.spec.* (ts, tsx, js, mjs, cjs, jsx)
//   - it is a playwright config (playwright*.ts)
// If every apps/ and packages/ change is one of those, no fragment is required.
// Files outside apps/ and packages/ never require one on their own.
//
// Compare with: VERSION_BASE=origin/master node scripts/check-version.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseRef = process.env.VERSION_BASE || 'origin/master'
const NOTE = /^changes\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

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

export const isChangeNote = (file) => NOTE.test(norm(file))

export const evaluate = ({ files, notes, bodies }) => {
  const shipped = files.map(norm).filter(isShipped)
  if (shipped.length === 0) {
    return { ok: true, shipped, notes: [], message: '版本检查通过：没有改动会进入产物的文件（测试和文档豁免）。' }
  }
  const added = [...new Set(notes.map(norm).filter(isChangeNote))]
  if (added.length === 0) {
    return {
      ok: false,
      shipped,
      notes: added,
      message: `版本检查未通过：改了会进入产物的文件，但没有新增 changes/<短名>.md。请写一两行中文说明，不要改 package.json 的版本。\n${shipped.slice(0, 40).join('\n')}`,
    }
  }
  for (const note of added) {
    const body = bodies?.[note] ?? ''
    if (!body.trim()) {
      return { ok: false, shipped, notes: added, message: `版本检查未通过：${note} 是空的。请写一两行中文说明。` }
    }
    if (!/\p{Script=Han}/u.test(body)) {
      return { ok: false, shipped, notes: added, message: `版本检查未通过：${note} 需要一两行中文说明。` }
    }
  }
  return { ok: true, shipped, notes: added, message: `版本检查通过：${added.join(', ')}` }
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
  return [...new Set([...tracked, ...untracked].map(norm))]
}

export const main = () => {
  let files
  try {
    files = changedFiles()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(`版本检查未通过：读不到 ${baseRef}。\n${detail}`)
    return 1
  }
  const notes = []
  const status = git(['diff', '--name-status', '--find-renames', baseRef])
  for (const line of status.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    const kind = parts[0]
    if (kind.startsWith('A') && parts[1]) notes.push(norm(parts[1]))
    else if ((kind.startsWith('R') || kind.startsWith('C')) && parts[2]) notes.push(norm(parts[2]))
  }
  for (const file of git(['ls-files', '--others', '--exclude-standard']).split('\n')) {
    if (file.trim()) notes.push(norm(file.trim()))
  }
  const bodies = {}
  for (const note of notes.filter(isChangeNote)) {
    try {
      bodies[note] = readFileSync(join(root, note), 'utf8')
    } catch {
      bodies[note] = ''
    }
  }
  const result = evaluate({ files, notes, bodies })
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
