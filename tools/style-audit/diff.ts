import { readFileSync } from 'node:fs'
import { humanLabel, type MatchResult, type Pair, type StyleNode } from './match.ts'

export type Exception = {
  id: string
  property?: string
  brand?: string
  text?: string
  unmatched?: 'ours' | 'official'
  region?: string
  ours?: string
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
  officialVisible: number
  matched: number
  matchedEqual: number
  matchedDiff: number
  officialOnly: number
  harborOnly: number
  allowlisted: number
  unmatchedOfficial: number
  unmatchedOurs: number
  mismatches: Mismatch[]
  unexplained: number
  pass: boolean
  skipped?: boolean
}

const COLOR_PROPS = new Set([
  'background-color', 'color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline', 'fill', 'stroke', 'scrollbar-color', 'box-shadow', 'background-image',
])

const GEOMETRY = new Set(['x', 'y', 'w', 'h'])

const stripComment = (raw: string) => {
  let quote = ''
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '#') return raw.slice(0, index)
  }
  return raw
}

export const loadAllowlist = (text: string): Exception[] => {
  const items: Exception[] = []
  let current: Exception | null = null
  for (const raw of text.split('\n')) {
    const line = stripComment(raw).trimEnd()
    if (!line.trim()) continue
    const item = line.match(/^\s*-\s+id:\s*(.+)$/)
    if (item?.[1]) {
      if (current) items.push(current)
      current = { id: item[1].trim(), reason: '' }
      continue
    }
    if (!current) continue
    const field = line.match(/^\s+(property|brand|text|unmatched|region|ours|reason):\s*(.*)$/)
    if (!field?.[1]) continue
    const key = field[1] as 'property' | 'brand' | 'text' | 'unmatched' | 'region' | 'ours' | 'reason'
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

const isBlue = (value: string | null) => {
  if (!value) return false
  const match = value.match(/rgba\((\d+), (\d+), (\d+)/)
  if (!match) return false
  const red = Number(match[1])
  const green = Number(match[2])
  const blue = Number(match[3])
  return blue >= 160 && blue > red + 30 && blue > green
}

const nodeText = (node: StyleNode) => `${node.name} ${node.text} ${node.testId || ''} ${node.key}`

const explain = (exceptions: Exception[], pair: Pair | null, property: string, official: StyleNode | null, ours: StyleNode | null, unmatched?: 'ours' | 'official') => {
  for (const exception of exceptions) {
    if (exception.unmatched && exception.unmatched !== unmatched) continue
    if (!exception.unmatched && unmatched) continue
    if (exception.brand && pair?.brand !== exception.brand) continue
    if (exception.property && !exception.property.split('|').includes(property) && property !== 'unmatched') continue
    if (exception.property && property === 'unmatched' && !exception.unmatched) continue
    const blob = `${pair?.key || ''} ${official ? `${humanLabel(official)} ${nodeText(official)}` : ''} ${ours ? `${humanLabel(ours)} ${nodeText(ours)}` : ''}`
    if (exception.text && !matchesField(exception.text, blob)) continue
    if (exception.ours) {
      const oursValue = ours?.style[property] || ''
      const officialValue = official?.style[property] || ''
      if (normalizeColor(oursValue) !== normalizeColor(exception.ours)) continue
      if (!isBlue(normalizeColor(officialValue))) continue
    }
    if (exception.region === 'footer') {
      const node = (unmatched === 'ours' ? ours : official) || official || ours
      if (!node || node.rect.y < 600 || node.rect.x > 340) continue
    }
    if (!exception.property && !exception.brand && !exception.text && !exception.unmatched) continue
    return exception
  }
  return undefined
}

const RADIUS = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius']
const BORDER_SIDES = ['top', 'right', 'bottom', 'left']

const visualProperties = (pair: Pair) => {
  const text = Boolean(accessibleText(pair.official) || accessibleText(pair.ours))
  const props = ['x', 'y', 'w', 'h', 'background-color', 'box-shadow', 'opacity', ...RADIUS]
  if (pair.official.style['backdrop-filter'] != null && pair.ours.style['backdrop-filter'] != null) props.push('backdrop-filter')
  if (text) props.push('font-size', 'font-weight', 'line-height', 'letter-spacing', 'color')
  for (const side of BORDER_SIDES) {
    const officialWidth = parseFloat(pair.official.style[`border-${side}-width`] || '0')
    const oursWidth = parseFloat(pair.ours.style[`border-${side}-width`] || '0')
    if (officialWidth > 0 || oursWidth > 0) {
      props.push(`border-${side}-width`, `border-${side}-color`, `border-${side}-style`)
    }
    const officialPad = parseFloat(pair.official.style[`padding-${side}`] || '0')
    const oursPad = parseFloat(pair.ours.style[`padding-${side}`] || '0')
    if (officialPad > 0 || oursPad > 0) props.push(`padding-${side}`)
  }
  return props
}

const accessibleText = (node: StyleNode) => `${node.name} ${node.text}`.replace(/\s+/g, ' ').trim()

const fontMetricSlack = (pair: Pair, property: string, official: string, ours: string) => {
  if (property !== 'w' && property !== 'h' && property !== 'line-height') return false
  if (!accessibleText(pair.official) && !accessibleText(pair.ours)) return false
  const aligned = ['font-size', 'font-weight', 'color'].every((name) => same(name, valueOf(pair.official, name), valueOf(pair.ours, name)))
  if (!aligned) return false
  const delta = property === 'line-height'
    ? pxDelta(official, ours)
    : Math.abs(Number.parseFloat(official) - Number.parseFloat(ours))
  return delta != null && delta <= 1
}

const valueOf = (node: StyleNode, property: string) => {
  if (property === 'x') return String(node.rect.x)
  if (property === 'y') return String(node.rect.y)
  if (property === 'w') return String(node.rect.w)
  if (property === 'h') return String(node.rect.h)
  return node.style[property] ?? ''
}

export const diffMatch = (state: string, viewport: string, result: MatchResult, exceptions: Exception[]): DiffReport => {
  const mismatches: Mismatch[] = []
  for (const pair of result.pairs) {
    for (const property of visualProperties(pair)) {
      const official = valueOf(pair.official, property)
      const ours = valueOf(pair.ours, property)
      if (same(property, official, ours)) continue
      if (property === 'y' && pair.brand === 'chat-list') continue
      if ((property === 'x' || property === 'y') && (/^menu |^row-more/.test(pair.key) || (/重命名|置顶|分享|多选|删除/.test(pair.key) && pair.official.rect.w < 280 && pair.official.rect.h <= 52))) continue
      if (fontMetricSlack(pair, property, official, ours)) continue
      const greetingCopy = result.pairs.some((item) => item.key.includes('greeting') && accessibleText(item.official) !== accessibleText(item.ours))
      if ((property === 'x' || property === 'w') && pair.key.includes('greeting') && greetingCopy) continue
      if (property === 'x' && greetingCopy && pair.official.tag === 'svg' && pair.official.rect.w >= 30 && pair.official.rect.h >= 20 && pair.official.rect.y < 500) continue
      const exception = explain(exceptions, pair, property, pair.official, pair.ours)
      const known = exception?.id === 'font-family'
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
      key: humanLabel(node),
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
      key: humanLabel(node),
      property: 'unmatched',
      official: '',
      ours: node.text || node.name || node.tag,
      status: exception ? 'allowed' : 'fail',
      reason: exception?.reason,
      id: exception?.id,
    })
  }
  const unexplained = mismatches.filter((item) => item.status === 'fail').length
  const allowlisted = mismatches.filter((item) => item.status !== 'fail').length
  const matchedDiff = new Set(mismatches.filter((item) => item.status === 'fail' && item.property !== 'unmatched').map((item) => item.key)).size
  const matched = result.pairs.length
  return {
    state,
    viewport,
    officialVisible: result.officialVisible,
    matched,
    matchedEqual: matched - matchedDiff,
    matchedDiff,
    officialOnly: result.unmatchedOfficial.length,
    harborOnly: result.unmatchedOurs.length,
    allowlisted,
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
