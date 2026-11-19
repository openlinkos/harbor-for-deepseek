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

const isChatRow = (node: StyleNode) => {
  if (node.tag !== 'button' || node.pseudo) return false
  if (node.rect.x > 320 || node.rect.w < 80) return false
  if (node.rect.h < 18 || node.rect.h > 64) return false
  const text = node.text.trim()
  if (text.length < 1) return false
  if (/开启新对话|new chat/i.test(text)) return false
  return true
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

  const chat = zipBrand(officialPool.filter(isChatRow), oursPool.filter(isChatRow), 'chat-list')
  pairs.push(...chat.pairs)
  officialPool = take(officialPool, chat.pairs.map((pair) => pair.official))
  oursPool = take(oursPool, chat.pairs.map((pair) => pair.ours))

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
