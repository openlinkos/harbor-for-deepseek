import { readFileSync } from 'node:fs'
import type { MatchResult, Pair, StyleNode } from './match.ts'

export type Exception = {
  id: string
  property?: string
  brand?: string
  text?: string
  unmatched?: 'ours' | 'official'
  region?: string
  reason: string
}

export type Mismatch = {
  key: string
  property: string
  official: string
  ours: string
  status: 'fail' | 'allowed' | 'known'
  reason?: string
  id?: string
}

export type DiffReport = {
  state: string
  viewport: string
  matched: number
  unmatchedOfficial: number
  unmatchedOurs: number
  mismatches: Mismatch[]
  unexplained: number
  pass: boolean
}

const COLOR_PROPS = new Set([
  'background-color', 'color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline', 'fill', 'stroke', 'scrollbar-color', 'box-shadow', 'background-image',
])

const GEOMETRY = new Set(['x', 'y', 'w', 'h'])

export const loadAllowlist = (text: string): Exception[] => {
  const items: Exception[] = []
  let current: Exception | null = null
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trimEnd()
    if (!line.trim()) continue
    const item = line.match(/^\s*-\s+id:\s*(.+)$/)
    if (item?.[1]) {
      if (current) items.push(current)
      current = { id: item[1].trim(), reason: '' }
      continue
    }
    if (!current) continue
    const field = line.match(/^\s+(property|brand|text|unmatched|region|reason):\s*(.*)$/)
    if (!field?.[1]) continue
    const key = field[1] as 'property' | 'brand' | 'text' | 'unmatched' | 'region' | 'reason'
    current[key] = field[2].trim().replace(/^["']|["']$/g, '')
  }
  if (current) items.push(current)
  return items.filter((item) => item.reason)
}

export const loadAllowlistFile = (path: string) => loadAllowlist(readFileSync(path, 'utf8'))

const channel = (value: string) => {
  const number = Number.parseFloat(value)
  if (value.includes('%')) return (number / 100) * 255
  return number
}

export const normalizeColor = (input: string): string | null => {
  const value = input.trim().toLowerCase()
  if (!value) return null
  if (value === 'transparent') return 'rgba(0, 0, 0, 0)'
  const hex = value.match(/^#([0-9a-f]{3,8})$/)
  if (hex?.[1]) {
    let body = hex[1]
    if (body.length === 3 || body.length === 4) body = body.split('').map((part) => part + part).join('')
    const red = Number.parseInt(body.slice(0, 2), 16)
    const green = Number.parseInt(body.slice(2, 4), 16)
    const blue = Number.parseInt(body.slice(4, 6), 16)
    const alpha = body.length >= 8 ? Number.parseInt(body.slice(6, 8), 16) / 255 : 1
    return rgba(red, green, blue, alpha)
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/)
  if (!rgb?.[1]) return null
  const parts = rgb[1].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const red = channel(parts[0] || '0')
  const green = channel(parts[1] || '0')
  const blue = channel(parts[2] || '0')
  let alpha = 1
  if (parts[3]) alpha = parts[3].includes('%') ? Number.parseFloat(parts[3]) / 100 : Number.parseFloat(parts[3])
  return rgba(red, green, blue, alpha)
}

const rgba = (red: number, green: number, blue: number, alpha: number) => {
  const a = Math.round(alpha * 1000) / 1000
  return `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${a})`
}

const normalizeValue = (property: string, value: string) => {
  const text = value.trim()
  if (COLOR_PROPS.has(property) || property.includes('color')) {
    return text.replace(/rgba?\([^)]+\)|#(?:[0-9a-f]{3,8})\b/gi, (token) => normalizeColor(token) || token)
  }
  return text
}

const pxDelta = (official: string, ours: string) => {
  const left = official.trim().match(/^(-?[\d.]+)px$/)
  const right = ours.trim().match(/^(-?[\d.]+)px$/)
  if (!left?.[1] || !right?.[1]) return null
  return Math.abs(Number.parseFloat(left[1]) - Number.parseFloat(right[1]))
}

const same = (property: string, official: string, ours: string) => {
  if (GEOMETRY.has(property)) {
    return Math.abs(Number.parseFloat(official) - Number.parseFloat(ours)) <= 0.5
  }
  const delta = pxDelta(official, ours)
  if (delta != null && (property.endsWith('width') || property.endsWith('height') || property.includes('radius') || property.startsWith('margin') || property.startsWith('padding') || property === 'gap' || property === 'row-gap' || property === 'column-gap' || property === 'font-size' || property === 'line-height' || property === 'letter-spacing' || property === 'top' || property === 'left' || property === 'stroke-width')) {
    return delta <= 0.5
  }
  return normalizeValue(property, official) === normalizeValue(property, ours)
}

const matchesField = (pattern: string | undefined, value: string) => {
  if (!pattern) return true
  return pattern.split('|').some((part) => value.includes(part))
}

const nodeText = (node: StyleNode) => `${node.name} ${node.text} ${node.testId || ''} ${node.key}`

const explain = (exceptions: Exception[], pair: Pair | null, property: string, official: StyleNode | null, ours: StyleNode | null, unmatched?: 'ours' | 'official') => {
  for (const exception of exceptions) {
    if (exception.unmatched && exception.unmatched !== unmatched) continue
    if (!exception.unmatched && unmatched) continue
    if (exception.brand && pair?.brand !== exception.brand) continue
    if (exception.property && !exception.property.split('|').includes(property) && property !== 'unmatched') continue
    if (exception.property && property === 'unmatched' && !exception.unmatched) continue
    const blob = `${official ? nodeText(official) : ''} ${ours ? nodeText(ours) : ''}`
    if (exception.text && !matchesField(exception.text, blob)) continue
    if (exception.region === 'footer') {
      const node = (unmatched === 'ours' ? ours : official) || official || ours
      if (!node || node.rect.y < 600 || node.rect.x > 340) continue
    }
    if (!exception.property && !exception.brand && !exception.text && !exception.unmatched) continue
    return exception
  }
  return undefined
}

export const diffMatch = (state: string, viewport: string, result: MatchResult, exceptions: Exception[]): DiffReport => {
  const mismatches: Mismatch[] = []
  for (const pair of result.pairs) {
    const officialStyle = { ...pair.official.style, x: String(pair.official.rect.x), y: String(pair.official.rect.y), w: String(pair.official.rect.w), h: String(pair.official.rect.h) }
    const oursStyle = { ...pair.ours.style, x: String(pair.ours.rect.x), y: String(pair.ours.rect.y), w: String(pair.ours.rect.w), h: String(pair.ours.rect.h) }
    const props = new Set([...Object.keys(officialStyle), ...Object.keys(oursStyle)])
    for (const property of props) {
      const official = officialStyle[property] ?? ''
      const ours = oursStyle[property] ?? ''
      if (same(property, official, ours)) continue
      const exception = explain(exceptions, pair, property, pair.official, pair.ours)
      const known = exception?.id === 'font-family' || property === 'font-family' && exception
      mismatches.push({
        key: pair.key,
        property,
        official,
        ours,
        status: exception ? (known ? 'known' : 'allowed') : 'fail',
        reason: exception?.reason,
        id: exception?.id,
      })
    }
  }
  for (const node of result.unmatchedOfficial) {
    const exception = explain(exceptions, null, 'unmatched', node, null, 'official')
    mismatches.push({
      key: node.key,
      property: 'unmatched',
      official: node.text || node.name || node.tag,
      ours: '',
      status: exception ? 'allowed' : 'fail',
      reason: exception?.reason,
      id: exception?.id,
    })
  }
  for (const node of result.unmatchedOurs) {
    const exception = explain(exceptions, null, 'unmatched', null, node, 'ours')
    mismatches.push({
      key: node.key,
      property: 'unmatched',
      official: '',
      ours: node.text || node.name || node.tag,
      status: exception ? 'allowed' : 'fail',
      reason: exception?.reason,
      id: exception?.id,
    })
  }
  const unexplained = mismatches.filter((item) => item.status === 'fail').length
  return {
    state,
    viewport,
    matched: result.pairs.length,
    unmatchedOfficial: result.unmatchedOfficial.length,
    unmatchedOurs: result.unmatchedOurs.length,
    mismatches,
    unexplained,
    pass: unexplained === 0,
  }
}

export const renderReport = (report: DiffReport) => {
  const lines = [
    `# ${report.state} ${report.viewport}`,
    '',
    `Result: ${report.pass ? 'PASS' : 'FAIL'} (${report.unexplained} unexplained)`,
    '',
    `- Matched elements: ${report.matched}`,
    `- Unmatched official: ${report.unmatchedOfficial}`,
    `- Unmatched ours: ${report.unmatchedOurs}`,
    '',
    '| Status | Key | Property | Official | Ours | Reason |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  const shown = report.mismatches.filter((item) => item.status !== 'allowed' || item.property !== 'unmatched')
  if (shown.length === 0) lines.push('| | | | | | none |')
  for (const item of shown) {
    lines.push(`| ${item.status} | ${cell(item.key)} | ${cell(item.property)} | ${cell(item.official)} | ${cell(item.ours)} | ${cell(item.reason || '')} |`)
  }
  lines.push('')
  return lines.join('\n')
}

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 180)
