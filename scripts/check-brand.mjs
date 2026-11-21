#!/usr/bin/env node
// User-visible brand gate. `pnpm lint` runs this.
// Scans string literals and JSX text (not comments, not NOTICE) for DeepSeek / 深度求索.
// Usage: node scripts/check-brand.mjs [root]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const here = dirname(fileURLToPath(import.meta.url))
export const repoRoot = join(here, '..')

const BRAND = /deepseek|深度求索/gi

/** API hosts. A hit is allowed only when the matched token sits inside one of these. */
export const HOSTS = [
  'api.deepseek.com',
  'cdn.deepseek.com',
  'platform.deepseek.com',
  'api-docs.deepseek.com',
]

/**
 * Model ids, tool names, and the same identifier shape
 * (deepseek-flash, deepseek-v4-pro, deepseek_web_search, deepseek_read_url, deepseek_web_fetch).
 * A bare "DeepSeek" does not match.
 */
export const IDENTIFIER = /\bdeepseek[-_][a-z0-9]+(?:[-_][a-z0-9]+)*\b/gi

/**
 * Whole string must match. These name the upstream API, the trademark, or non-affiliation.
 * Do not add product chrome such as the composer placeholder.
 */
export const FACTUAL = [
  {
    text: 'DeepAPI 网页版，请求直接发往 DeepSeek API。',
    reason: 'Says the page sends the request to the DeepSeek API.',
  },
  {
    text: 'DeepAPI for the web. Requests go to the DeepSeek API.',
    reason: 'Says requests go to the DeepSeek API.',
  },
  {
    text: '填入 DeepSeek API Key',
    reason: 'The key the user pastes is a DeepSeek API key.',
  },
  {
    text: 'Enter your DeepSeek API key',
    reason: 'The key the user pastes is a DeepSeek API key.',
  },
  {
    text: '思考、搜索和文件直接走 DeepSeek API。',
    reason: 'Names the upstream API that serves thinking, search, and files.',
  },
  {
    text: 'Thinking, search, and files go straight to the DeepSeek API.',
    reason: 'Names the upstream API that serves thinking, search, and files.',
  },
  {
    text: '对话会发送到 DeepSeek 并由其生成。DeepAPI 不运营对话后端，也不代替你完成备案或内容标识。',
    reason: 'States that DeepSeek generates the reply and DeepAPI does not run the backend.',
  },
  {
    text: 'Messages are sent to DeepSeek, which generates the reply. DeepAPI does not run a chat backend and does not file or label on your behalf.',
    reason: 'States that DeepSeek generates the reply and DeepAPI does not run the backend.',
  },
  {
    text: 'DeepSeek 是其所有者的商标。DeepAPI 与深度求索没有隶属关系。',
    reason: 'Trademark notice and the non-affiliation statement.',
  },
  {
    text: 'DeepSeek is a trademark of its owner. DeepAPI is not affiliated with DeepSeek.',
    reason: 'Trademark notice and the non-affiliation statement.',
  },
  {
    text: 'DeepAPI is a chat client for the DeepSeek API. Your key stays on this device.',
    reason: 'Document description names the upstream API.',
  },
  {
    text: 'DeepAPI 是一个独立的聊天客户端。你在本机保存 API Key，消息直接发往 api.deepseek.com。DeepAPI 不代替深度求索提供账号、计费或客服。',
    reason: 'States that DeepAPI does not provide accounts, billing, or support for 深度求索.',
  },
  {
    text: '使用 DeepSeek API 产生的费用由 Key 的持有者承担。请只在你信任的设备上保存 Key。',
    reason: 'States that charges come from using the DeepSeek API.',
  },
]

const factual = new Set(FACTUAL.map((item) => item.text))
const norm = (p) => p.split(sep).join('/')
const isTestFile = (rel) => /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel)

const walk = (dir, acc) => {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) walk(abs, acc)
    else acc.push(abs)
  }
}

export const sourceFiles = (root) => {
  const files = []
  const add = (abs, exts) => {
    const rel = norm(relative(root, abs))
    if (isTestFile(rel) || !exts.test(rel)) return
    files.push({ abs, rel })
  }
  const i18n = []
  walk(join(root, 'packages/i18n/src'), i18n)
  for (const abs of i18n) add(abs, /\.(?:[cm]?[jt]sx?|html|css)$/)
  const web = []
  walk(join(root, 'apps/web/src'), web)
  for (const abs of web) add(abs, /\.(?:tsx?|html|css)$/)
  const index = join(root, 'apps/web/index.html')
  if (existsSync(index)) files.push({ abs: index, rel: 'apps/web/index.html' })
  return files
}

const coveredSpans = (text) => {
  const spans = []
  const lower = text.toLowerCase()
  for (const host of HOSTS) {
    const needle = host.toLowerCase()
    let from = 0
    while (from < lower.length) {
      const at = lower.indexOf(needle, from)
      if (at < 0) break
      spans.push([at, at + needle.length])
      from = at + needle.length
    }
  }
  for (const match of text.matchAll(IDENTIFIER)) {
    spans.push([match.index, match.index + match[0].length])
  }
  return spans
}

const uncovered = (text) => {
  if (factual.has(text) || factual.has(text.trim())) return []
  const spans = coveredSpans(text)
  const hits = []
  for (const match of text.matchAll(BRAND)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (!spans.some(([from, to]) => from <= start && end <= to)) hits.push({ start, token: match[0] })
  }
  return hits
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

const excerpt = (text) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 160 ? `${flat.slice(0, 157)}...` : flat
}

const contentStart = (source, node) => {
  const start = node.getStart(source)
  const raw = source.text[start]
  return raw === '"' || raw === "'" || raw === '`' ? start + 1 : start
}

const pushLiteral = (hits, rel, source, node, value) => {
  const origin = contentStart(source, node)
  for (const hit of uncovered(value)) {
    const index = origin + hit.start
    hits.push({ file: rel, line: lineOf(source.text, index), excerpt: excerpt(value) })
  }
}

const scanProgram = (rel, text) => {
  const kind = rel.endsWith('.tsx') || rel.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
  const hits = []
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      pushLiteral(hits, rel, source, node, node.text)
    } else if (ts.isTemplateExpression(node)) {
      pushLiteral(hits, rel, source, node.head, node.head.text)
      for (const span of node.templateSpans) pushLiteral(hits, rel, source, span.literal, span.literal.text)
    } else if (ts.isJsxText(node)) {
      pushLiteral(hits, rel, source, node, node.getText(source))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

const scanCss = (rel, text) => {
  const hits = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end < 0 ? text.length : end + 2
      continue
    }
    const quote = text[i]
    if (quote === '"' || quote === "'") {
      let j = i + 1
      let body = ''
      while (j < text.length && text[j] !== quote && text[j] !== '\n') {
        if (text[j] === '\\' && j + 1 < text.length) {
          body += text[j + 1]
          j += 2
          continue
        }
        body += text[j]
        j += 1
      }
      for (const hit of uncovered(body)) {
        hits.push({ file: rel, line: lineOf(text, i + 1 + hit.start), excerpt: excerpt(body) })
      }
      i = j + 1
      continue
    }
    i += 1
  }
  return hits
}

const scanHtml = (rel, text) => {
  const hits = []
  let i = 0
  const report = (body, index) => {
    for (const hit of uncovered(body)) {
      hits.push({ file: rel, line: lineOf(text, index + hit.start), excerpt: excerpt(body) })
    }
  }
  while (i < text.length) {
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4)
      i = end < 0 ? text.length : end + 3
      continue
    }
    if (text[i] === '<') {
      const end = text.indexOf('>', i + 1)
      const tagEnd = end < 0 ? text.length : end
      const tag = text.slice(i, tagEnd)
      const attrs = /[:\w-]+\s*=\s*(["'])([\s\S]*?)\1/g
      let match
      while ((match = attrs.exec(tag))) {
        const valueAt = match.index + match[0].indexOf(match[1] + match[2]) + 1
        report(match[2], i + valueAt)
      }
      i = end < 0 ? text.length : end + 1
      continue
    }
    const end = text.indexOf('<', i)
    const raw = text.slice(i, end < 0 ? text.length : end)
    if (raw.trim()) report(raw, i)
    i = end < 0 ? text.length : end
  }
  return hits
}

export const scan = (root) => {
  const hits = []
  for (const file of sourceFiles(root)) {
    const text = readFileSync(file.abs, 'utf8')
    if (file.rel.endsWith('.css')) hits.push(...scanCss(file.rel, text))
    else if (file.rel.endsWith('.html')) hits.push(...scanHtml(file.rel, text))
    else hits.push(...scanProgram(file.rel, text))
  }
  const seen = new Set()
  return hits.filter((hit) => {
    const key = `${hit.file}:${hit.line}:${hit.excerpt}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const root = process.argv[2] ? resolve(process.argv[2]) : repoRoot
  const hits = scan(root)
  if (hits.length) {
    for (const hit of hits) console.error(`${hit.file}:${hit.line}: ${hit.excerpt}`)
    process.exit(1)
  }
  console.log('check-brand ok')
}
