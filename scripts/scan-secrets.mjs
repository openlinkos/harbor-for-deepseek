import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const skip = new Set(['node_modules', 'dist', '.git', 'coverage', 'playwright-report', 'test-results'])
const pattern = /sk-[A-Za-z0-9]{20,}|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|DEEPSEEK_API_KEY\s*=\s*\S+/
const hits = []

const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) {
      continue
    }
    const path = join(dir, name)
    const info = statSync(path)
    if (info.isDirectory()) {
      walk(path)
      continue
    }
    if (info.size > 1_000_000) {
      continue
    }
    const text = readFileSync(path, 'utf8')
    if (pattern.test(text)) {
      hits.push(path)
    }
  }
}

walk(rootDir)
if (hits.length) {
  console.error(hits.join('\n'))
  process.exit(1)
}
console.log('no secrets matched')
