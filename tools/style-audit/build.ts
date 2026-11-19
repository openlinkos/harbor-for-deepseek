import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const esbuildBin = (root: string) => {
  const bins = readdirSync(join(root, 'node_modules/.pnpm')).filter((name) => name.startsWith('esbuild@')).sort()
  const latest = bins[bins.length - 1]
  if (!latest) throw new Error('esbuild is not installed')
  return join(root, 'node_modules/.pnpm', latest, 'node_modules/esbuild/bin/esbuild')
}

export const buildCaptureScripts = (root: string) => {
  const dir = join(root, 'tools/style-audit')
  const entry = join(dir, '.capture-entry.js')
  const tmp = join(dir, '.capture.min.js')
  const source = readFileSync(join(dir, 'capture.js'), 'utf8')
  writeFileSync(entry, `${source}\nglobalThis.captureStyleAudit();\n`)
  const result = spawnSync(esbuildBin(root), [
    entry,
    '--minify',
    '--format=iife',
    `--outfile=${tmp}`,
  ], { encoding: 'utf8' })
  unlinkSync(entry)
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'esbuild failed')
  const program = readFileSync(tmp, 'utf8').trim()
  unlinkSync(tmp)
  const callAt = program.lastIndexOf('captureStyleAudit()')
  const closeAt = program.lastIndexOf('})()')
  if (callAt < 0 || closeAt < 0 || callAt > closeAt) {
    throw new Error('capture call is outside the bookmarklet function')
  }
  const bookmarklet = `javascript:${program}`
  const bytes = Buffer.byteLength(bookmarklet)
  if (bytes >= 64 * 1024) throw new Error(`bookmarklet is ${bytes} bytes`)
  writeFileSync(join(dir, 'console.js'), `${program}\n`)
  writeFileSync(join(dir, 'bookmarklet.js'), `${bookmarklet}\n`)
  return { bytes, program, bookmarklet }
}
