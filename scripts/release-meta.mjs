import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
const FULL_SHA = /^[0-9a-f]{40}$/i

export const readVersion = () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  const version = pkg.version
  if (typeof version !== 'string' || !SEMVER.test(version)) {
    throw new Error(`root package.json version must be X.Y.Z, got ${JSON.stringify(version)}`)
  }
  return version
}

const fromEnv = () => {
  for (const value of [process.env.SOURCE_COMMIT, process.env.DEEPAPI_COMMIT]) {
    if (value && FULL_SHA.test(value)) return value.toLowerCase()
  }
  return ''
}

const fromGit = () => {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return FULL_SHA.test(sha) ? sha.toLowerCase() : ''
  } catch {
    return ''
  }
}

// Full commit for /version.json. Docker builds have no .git; pass SOURCE_COMMIT.
// GITHUB_SHA is only a fallback: on pull_request it is the merge commit, while
// git HEAD is the commit that was actually checked out.
export const readCommit = () => fromEnv() || fromGit() || (process.env.GITHUB_SHA && FULL_SHA.test(process.env.GITHUB_SHA) ? process.env.GITHUB_SHA.toLowerCase() : '') || 'unknown'

export const shortCommit = (full = readCommit()) => (full === 'unknown' ? 'unknown' : full.slice(0, 7))
