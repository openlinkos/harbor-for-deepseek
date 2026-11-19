export type Rect = { x: number; y: number; w: number; h: number }

export type StyleNode = {
  key: string
  role: string
  name: string
  text: string
  tag: string
  testId?: string
  pseudo?: string
  rect: Rect
  style: Record<string, string>
}

export type Capture = {
  label: string
  state: string
  viewport: { width: number; height: number }
  devicePixelRatio: number
  ua: string
  fonts: unknown[]
  customProperties: { root: Record<string, string>; body: Record<string, string> }
  elements: StyleNode[]
}

export type Pair = {
  key: string
  official: StyleNode
  ours: StyleNode
  brand?: 'wordmark' | 'logo' | 'account-footer' | 'chat-list'
  how: 'brand' | 'key' | 'role-text' | 'iou'
}

export type MatchResult = {
  pairs: Pair[]
  unmatchedOfficial: StyleNode[]
  unmatchedOurs: StyleNode[]
}

const byPos = (a: StyleNode, b: StyleNode) => a.rect.y - b.rect.y || a.rect.x - b.rect.x

const area = (rect: Rect) => Math.max(0, rect.w) * Math.max(0, rect.h)

export const iou = (a: Rect, b: Rect) => {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const union = area(a) + area(b) - inter
  return union <= 0 ? 0 : inter / union
}

const textOf = (node: StyleNode) => `${node.name} ${node.text}`.replace(/\s+/g, ' ').trim()

const isWordmark = (node: StyleNode, side: 'official' | 'ours') => {
  if (node.rect.y > 140 || node.rect.x > 280) return false
  const text = textOf(node)
  if (side === 'official') return /deepseek/i.test(text)
  return /harbor/i.test(text) || /for deepseek/i.test(text)
}

const isLogo = (node: StyleNode) =>
  (node.tag === 'svg' || node.tag === 'img') && node.rect.y < 80 && node.rect.x < 56 && node.rect.w <= 40 && node.rect.h <= 40

const isFooter = (node: StyleNode, side: 'official' | 'ours', height: number) => {
  if (node.rect.x > 320) return false
  const text = textOf(node)
  if (side === 'ours') return /本地模式|密钥与对话/.test(text)
  return node.rect.y > height - 180 && /@/.test(text)
}

const inSidebar = (node: StyleNode) => node.rect.x < 48 && node.rect.x + node.rect.w < 340

const isChatRow = (node: StyleNode) => {
  if (node.pseudo || node.rect.y < 120) return false
  if (!inSidebar(node)) return false
  if (node.rect.w < 180 || node.rect.h < 36 || node.rect.h > 48) return false
  if (node.tag !== 'a' && node.tag !== 'div' && node.tag !== 'button') return false
  if (node.style.display === 'grid' || node.style.color === 'rgb(128, 0, 128)') return false
  const text = textOf(node)
  if (/开启新对话|new chat|深度思考|智能搜索/i.test(text)) return false
  return true
}

const isGroupLabel = (node: StyleNode) => {
  if (node.pseudo || !inSidebar(node)) return false
  if (node.rect.h < 14 || node.rect.h > 28 || node.rect.w < 160) return false
  const text = node.text.trim()
  return text.length > 0 && text.length <= 16 && /置顶|今天|昨天|天内|^\d{4}-\d{2}$/.test(text)
}

const contained = (parent: StyleNode, node: StyleNode) => {
  const outer = parent.rect
  const inner = node.rect
  return inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.w <= outer.x + outer.w + 2 && inner.y + inner.h <= outer.y + outer.h + 2
}

const distinctRows = (nodes: StyleNode[]) => {
  const sorted = [...nodes].sort(byPos)
  const kept: StyleNode[] = []
  for (const node of sorted) {
    if (kept.some((row) => contained(row, node))) continue
    kept.push(node)
  }
  return kept
}

const withoutRows = (pool: StyleNode[], rows: StyleNode[]) => {
  if (!rows.length) return pool
  return pool.filter((node) => !rows.some((row) => node === row || contained(row, node) || node.key.startsWith(`${row.key} > `) || node.key.startsWith(`${row.key}::`)))
}

const take = (pool: StyleNode[], chosen: StyleNode[]) => {
  const drop = new Set(chosen)
  return pool.filter((node) => !drop.has(node))
}

const zipBrand = (
  official: StyleNode[],
  ours: StyleNode[],
  brand: Pair['brand'],
): { pairs: Pair[]; official: StyleNode[]; ours: StyleNode[] } => {
  const left = [...official].sort(byPos)
  const right = [...ours].sort(byPos)
  const count = Math.min(left.length, right.length)
  const pairs: Pair[] = []
  for (let index = 0; index < count; index += 1) {
    const a = left[index]
    const b = right[index]
    if (!a || !b) continue
    pairs.push({ key: `brand:${brand}:${index}`, official: a, ours: b, brand, how: 'brand' })
  }
  return {
    pairs,
    official: take(official, left.slice(0, count)),
    ours: take(ours, right.slice(0, count)),
  }
}

const looseKey = (node: StyleNode) => {
  const text = (node.name || node.text || '').replace(/\s+/g, ' ').trim().slice(0, 24)
  if (!text) return ''
  return `${node.role}|${text}|${node.tag}`
}

export const matchCaptures = (official: Capture, ours: Capture): MatchResult => {
  const height = official.viewport?.height || 900
  let officialPool = official.elements.slice()
  let oursPool = ours.elements.slice()
  const pairs: Pair[] = []

  const word = zipBrand(
    officialPool.filter((node) => isWordmark(node, 'official')),
    oursPool.filter((node) => isWordmark(node, 'ours')),
    'wordmark',
  )
  pairs.push(...word.pairs)
  officialPool = take(officialPool, word.pairs.map((pair) => pair.official))
  oursPool = take(oursPool, word.pairs.map((pair) => pair.ours))

  const logo = zipBrand(officialPool.filter(isLogo), oursPool.filter(isLogo), 'logo')
  pairs.push(...logo.pairs)
  officialPool = take(officialPool, logo.pairs.map((pair) => pair.official))
  oursPool = take(oursPool, logo.pairs.map((pair) => pair.ours))

  const footer = zipBrand(
    officialPool.filter((node) => isFooter(node, 'official', height)),
    oursPool.filter((node) => isFooter(node, 'ours', height)),
    'account-footer',
  )
  pairs.push(...footer.pairs)
  officialPool = take(officialPool, footer.pairs.map((pair) => pair.official))
  oursPool = take(oursPool, footer.pairs.map((pair) => pair.ours))

  const officialRows = distinctRows(officialPool.filter(isChatRow))
  const oursRows = distinctRows(oursPool.filter(isChatRow))
  const chat = zipBrand(officialRows, oursRows, 'chat-list')
  pairs.push(...chat.pairs)
  officialPool = withoutRows(officialPool, officialRows)
  oursPool = withoutRows(oursPool, oursRows)

  const officialGroups = distinctRows(officialPool.filter(isGroupLabel))
  const oursGroups = distinctRows(oursPool.filter(isGroupLabel))
  const groups = zipBrand(officialGroups, oursGroups, 'chat-list')
  pairs.push(...groups.pairs)
  officialPool = take(officialPool, officialGroups)
  oursPool = take(oursPool, oursGroups)

  const oursByKey = new Map<string, StyleNode[]>()
  for (const node of oursPool) {
    const list = oursByKey.get(node.key) || []
    list.push(node)
    oursByKey.set(node.key, list)
  }
  const usedOurs = new Set<StyleNode>()
  const usedOfficial = new Set<StyleNode>()
  for (const node of officialPool) {
    const list = oursByKey.get(node.key)
    const found = list?.find((item) => !usedOurs.has(item))
    if (!found) continue
    usedOurs.add(found)
    usedOfficial.add(node)
    pairs.push({ key: node.key, official: node, ours: found, how: 'key' })
  }
  officialPool = officialPool.filter((node) => !usedOfficial.has(node))
  oursPool = oursPool.filter((node) => !usedOurs.has(node))

  const oursByLoose = new Map<string, StyleNode[]>()
  for (const node of oursPool) {
    const key = looseKey(node)
    if (!key) continue
    const list = oursByLoose.get(key) || []
    list.push(node)
    oursByLoose.set(key, list)
  }
  usedOurs.clear()
  usedOfficial.clear()
  for (const node of officialPool) {
    const key = looseKey(node)
    if (!key) continue
    const found = oursByLoose.get(key)?.find((item) => !usedOurs.has(item))
    if (!found) continue
    usedOurs.add(found)
    usedOfficial.add(node)
    pairs.push({ key: node.key, official: node, ours: found, how: 'role-text' })
  }
  officialPool = officialPool.filter((node) => !usedOfficial.has(node))
  oursPool = oursPool.filter((node) => !usedOurs.has(node))

  const candidates: Array<{ score: number; official: StyleNode; ours: StyleNode }> = []
  for (const left of officialPool) {
    for (const right of oursPool) {
      if (left.tag !== right.tag) continue
      if (left.rect.w > 500 && left.rect.h > 400) continue
      if (left.style.color === 'rgb(128, 0, 128)' && right.style.color !== left.style.color) continue
      const score = iou(left.rect, right.rect)
      if (score >= 0.5) candidates.push({ score, official: left, ours: right })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  usedOurs.clear()
  usedOfficial.clear()
  for (const candidate of candidates) {
    if (usedOfficial.has(candidate.official) || usedOurs.has(candidate.ours)) continue
    usedOfficial.add(candidate.official)
    usedOurs.add(candidate.ours)
    pairs.push({ key: candidate.official.key, official: candidate.official, ours: candidate.ours, how: 'iou' })
  }

  return {
    pairs,
    unmatchedOfficial: officialPool.filter((node) => !usedOfficial.has(node)),
    unmatchedOurs: oursPool.filter((node) => !usedOurs.has(node)),
  }
}
