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
  how: 'brand' | 'semantic' | 'position'
}

export type MatchResult = {
  pairs: Pair[]
  unmatchedOfficial: StyleNode[]
  unmatchedOurs: StyleNode[]
  officialVisible: number
}

const byPos = (a: StyleNode, b: StyleNode) => a.rect.y - b.rect.y || a.rect.x - b.rect.x

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

export const visibleText = (node: StyleNode) => clean(node.text || '').slice(0, 24)

export const accessibleName = (node: StyleNode) => clean(node.name || '') || visibleText(node)

const alphaOf = (color: string) => {
  const match = color.trim().toLowerCase().match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/)
  if (match?.[1]) return Number(match[1])
  if (color === 'transparent') return 0
  if (/^rgb\(/.test(color) || /^#[0-9a-f]{3,8}$/i.test(color)) return 1
  return 1
}

const filled = (node: StyleNode) => {
  const background = node.style['background-color'] || ''
  return Boolean(background && background !== 'transparent' && alphaOf(background) > 0.01)
}

const bordered = (node: StyleNode) => ['top', 'right', 'bottom', 'left'].some((side) => {
  const width = Number.parseFloat(node.style[`border-${side}-width`] || '0')
  const style = node.style[`border-${side}-style`] || 'none'
  const color = node.style[`border-${side}-color`] || ''
  return width > 0 && style !== 'none' && alphaOf(color) > 0.01
})

const paints = (node: StyleNode) => {
  if (visibleText(node)) return true
  if (node.tag === 'svg' || node.tag === 'img' || node.tag === 'input' || node.tag === 'textarea' || node.tag === 'button' || node.tag === 'a' || node.tag === 'select' || node.tag === 'label') return true
  if (node.role === 'button') return true
  if (filled(node) || bordered(node)) return true
  const shadow = node.style['box-shadow'] || 'none'
  if (shadow && shadow !== 'none') return true
  const content = node.style.content || ''
  if (node.pseudo && content && content !== 'none' && content !== 'normal' && content !== '""') return true
  return false
}

export const isVisiblePainted = (node: StyleNode, viewport: { width: number; height: number }) => {
  const { x, y, w, h } = node.rect
  if (w < 0.5 || h < 0.5) return false
  if (x + w <= 0 || y + h <= 0 || x >= viewport.width || y >= viewport.height) return false
  if (node.style.visibility === 'hidden' || node.style.display === 'none') return false
  if (Number.parseFloat(node.style.opacity || '1') === 0) return false
  return paints(node)
}

let regionWidth = 1440
const regionOf = (node: StyleNode) => (regionWidth < 500 || node.rect.x >= 280 ? 'main' : 'sidebar')

export const humanLabel = (node: StyleNode) => {
  const region = regionOf(node)
  const name = accessibleName(node)
  const role = node.role || node.tag
  if (name) return `${region} > ${role} ‘${name}’`
  if (node.tag === 'svg' || node.tag === 'img') return `${region} > icon ${Math.round(node.rect.w)}×${Math.round(node.rect.h)} @${Math.round(node.rect.x)},${Math.round(node.rect.y)}`
  if (node.pseudo) return `${region} > ${node.tag} @${Math.round(node.rect.x)},${Math.round(node.rect.y)}`
  return `${region} > ${role} @${Math.round(node.rect.x)},${Math.round(node.rect.y)} ${Math.round(node.rect.w)}×${Math.round(node.rect.h)}`
}

const semanticKey = (node: StyleNode) => {
  const role = node.role || node.tag
  const name = accessibleName(node)
  if (name) return `${regionOf(node)}|${role}|${name}|${node.tag}`
  if (node.testId) return `${regionOf(node)}|${role}|#${node.testId}|${node.tag}`
  if (node.tag === 'svg' || node.tag === 'img') return ''
  return ''
}

const inSidebar = (node: StyleNode) => node.rect.x < 40 && node.rect.x + node.rect.w < 320

const isSidebarRow = (node: StyleNode) => {
  if (node.pseudo || node.rect.y < 110) return false
  if (!inSidebar(node)) return false
  if (node.rect.w < 160 || node.rect.h < 28 || node.rect.h > 52) return false
  if (!/^(a|div|button)$/.test(node.tag)) return false
  const text = accessibleName(node)
  if (/开启新对话|深度思考|智能搜索|new chat/i.test(text)) return false
  return true
}

const isLooseTitle = (node: StyleNode) => {
  if (node.rect.x > 160 || node.rect.y < 140 || node.rect.h > 40 || node.rect.w > 220) return false
  const text = visibleText(node) || node.name.trim()
  if (!text || isGroupLabel(node)) return false
  return !/开启新对话|本地模式|密钥|置顶|今天|昨天|天内|重命名|分享|多选|删除|取消置顶/.test(text)
}

const isGroupLabel = (node: StyleNode) => {
  if (!inSidebar(node)) return false
  const text = visibleText(node)
  return text.length > 0 && text.length <= 16 && /置顶|今天|昨天|天内|^\d{4}-\d{2}$/.test(text)
}

const isWordmark = (node: StyleNode, side: 'official' | 'ours') => {
  if (node.rect.y > 140 || node.rect.x > 280) return false
  const text = accessibleName(node)
  if (side === 'official') return /deepseek/i.test(text) || (node.tag === 'svg' && node.rect.w > 80 && node.rect.y < 50)
  return /deepapi/i.test(text)
}

const isLogo = (node: StyleNode) =>
  (node.tag === 'svg' || node.tag === 'img') && node.rect.y < 80 && node.rect.x < 56 && node.rect.w <= 40 && node.rect.h <= 40

const isFooter = (node: StyleNode, side: 'official' | 'ours', height: number) => {
  if (node.rect.x > 320) return false
  const text = accessibleName(node)
  if (side === 'ours') return false
  return node.rect.y > height - 220 && /@/.test(text)
}

const take = (pool: StyleNode[], chosen: StyleNode[]) => {
  const drop = new Set(chosen)
  return pool.filter((node) => !drop.has(node))
}

const zip = (official: StyleNode[], ours: StyleNode[], brand: Pair['brand'], label: string): Pair[] => {
  const count = Math.min(official.length, ours.length)
  const pairs: Pair[] = []
  for (let index = 0; index < count; index += 1) {
    const left = official[index]
    const right = ours[index]
    if (!left || !right) continue
    pairs.push({ key: `${label} ${index + 1}`, official: left, ours: right, brand, how: 'brand' })
  }
  return pairs
}

const inside = (outer: StyleNode, inner: StyleNode) => {
  if (outer === inner) return true
  const box = outer.rect
  const item = inner.rect
  return item.x >= box.x - 1 && item.y >= box.y - 1 && item.x + item.w <= box.x + box.w + 2 && item.y + item.h <= box.y + box.h + 2
}

const dropInside = (pool: StyleNode[], rows: StyleNode[]) =>
  pool.filter((node) => !rows.some((row) => inside(row, node)))

const sameControl = (left: StyleNode, right: StyleNode) => {
  const tags = new Set([left.tag, right.tag])
  return tags.size === 2 && [...tags].every((tag) => tag === 'button' || tag === 'a' || tag === 'div' || tag === 'label' || tag === 'form' || tag === 'input')
}

const shellOf = (node: StyleNode, pool: StyleNode[]) => {
  let key = node.key
  let shell = node
  while (key.includes(' > ')) {
    key = key.slice(0, key.lastIndexOf(' > '))
    const ancestor = pool.find((item) => item.key === key)
    if (!ancestor) break
    if (ancestor.rect.w > 480 || ancestor.rect.h > 80) break
    const background = ancestor.style['background-color'] || ''
    const bordered = ['top', 'right', 'bottom', 'left'].some((side) => Number.parseFloat(ancestor.style[`border-${side}-width`] || '0') > 0)
    const filled = background && background !== 'transparent' && alphaOf(background) > 0.01
    if (ancestor.tag === 'button' || ancestor.tag === 'a' || filled || bordered) shell = ancestor
  }
  return shell
}

const pairShells = (official: StyleNode[], ours: StyleNode[]) => {
  const labels = ['开启新对话', '深度思考', '智能搜索', '新对话']
  const pairs: Pair[] = []
  const usedOfficial = new Set<StyleNode>()
  const usedOurs = new Set<StyleNode>()
  for (const label of labels) {
    const leftText = official.find((node) => accessibleName(node) === label)
    const rightText = ours.find((node) => leftText && regionOf(node) === regionOf(leftText) && (accessibleName(node) === label || accessibleName(node).includes(label)))
    if (!leftText || !rightText) continue
    const left = shellOf(leftText, official)
    const right = shellOf(rightText, ours)
    if (usedOfficial.has(left) || usedOurs.has(right) || left === leftText || right === rightText) continue
    usedOfficial.add(left)
    usedOurs.add(right)
    pairs.push({ key: `control ‘${label}’`, official: left, ours: right, how: 'semantic' })
  }
  return pairs
}

const pairByBox = (official: StyleNode[], ours: StyleNode[], pred: (node: StyleNode) => boolean, label: string) =>
  zip(official.filter(pred).sort(byPos), ours.filter(pred).sort(byPos), undefined, label)

const pairShortcuts = (official: StyleNode[], ours: StyleNode[]) => {
  const hit = (node: StyleNode) => /⌘|Ctrl/.test(`${accessibleName(node)} ${node.style.content || ''}`)
  return zip(official.filter(hit).sort(byPos), ours.filter(hit).sort(byPos), undefined, 'sidebar > shortcut')
}

const pairGreetings = (official: StyleNode[], ours: StyleNode[]) => {
  const big = (node: StyleNode) => Number.parseFloat(node.style['font-size'] || '0') >= 20 && visibleText(node).length > 4 && node.rect.w > 80 && node.rect.y > 40
  const left = official.filter(big).sort(byPos)
  const right = ours.filter(big).sort(byPos)
  return zip(left, right, undefined, 'main > greeting').map((pair) => ({ ...pair, how: 'position' as const }))
}

const center = (node: StyleNode) => ({ x: node.rect.x + node.rect.w / 2, y: node.rect.y + node.rect.h / 2 })

const distance = (left: StyleNode, right: StyleNode) => {
  const a = center(left)
  const b = center(right)
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export const matchCaptures = (official: Capture, ours: Capture): MatchResult => {
  const viewport = official.viewport || { width: 1440, height: 900 }
  regionWidth = viewport.width
  const isPageCanvas = (node: StyleNode) => !visibleText(node) && node.tag !== 'svg' && node.rect.w >= viewport.width - 2 && node.rect.h >= viewport.height - 2
  const isSyntaxToken = (node: StyleNode) => {
    if (node.tag !== 'span' && node.tag !== 'code') return false
    if (node.role === 'button' || !visibleText(node)) return false
    const size = Number.parseFloat(node.style['font-size'] || '0')
    if (node.tag === 'code') return size > 0 && size <= 14.5 && node.rect.h <= 24
    return size > 0 && size <= 13.5 && node.rect.h <= 22
  }
  let officialPool = official.elements.filter((node) => isVisiblePainted(node, viewport) && !isPageCanvas(node) && !isSyntaxToken(node))
  let oursPool = ours.elements.filter((node) => isVisiblePainted(node, ours.viewport || viewport) && !isPageCanvas(node) && !isSyntaxToken(node))
  const officialVisible = officialPool.length
  const pairs: Pair[] = []

  const word = zip(
    officialPool.filter((node) => isWordmark(node, 'official')).sort(byPos),
    oursPool.filter((node) => isWordmark(node, 'ours')).sort(byPos),
    'wordmark',
    'sidebar > wordmark',
  )
  pairs.push(...word)
  officialPool = take(officialPool, word.map((pair) => pair.official))
  oursPool = take(oursPool, word.map((pair) => pair.ours))

  const logos = zip(
    officialPool.filter(isLogo).sort(byPos),
    oursPool.filter(isLogo).sort(byPos),
    'logo',
    'sidebar > mark',
  )
  pairs.push(...logos)
  officialPool = take(officialPool, logos.map((pair) => pair.official))
  oursPool = take(oursPool, logos.map((pair) => pair.ours))

  const footers = zip(
    officialPool.filter((node) => isFooter(node, 'official', viewport.height)).sort(byPos),
    oursPool.filter((node) => isFooter(node, 'ours', viewport.height)).sort(byPos),
    'account-footer',
    'sidebar > account',
  )
  pairs.push(...footers)
  officialPool = take(officialPool, footers.map((pair) => pair.official))
  oursPool = take(oursPool, footers.map((pair) => pair.ours))

  const officialRows = officialPool.filter(isSidebarRow).sort(byPos)
  const oursRows = oursPool.filter(isSidebarRow).sort(byPos)
  const rows = zip(officialRows, oursRows, 'chat-list', 'sidebar > row')
  pairs.push(...rows)
  const rowLabel = (node: StyleNode, rows: StyleNode[]) => rows.some((row) => row !== node && inside(row, node) && (node.rect.x < 100 || node.rect.w > 40))
  officialPool = take(officialPool, officialRows).filter((node) => !rowLabel(node, officialRows) && !isLooseTitle(node))
  oursPool = take(oursPool, oursRows).filter((node) => !rowLabel(node, oursRows) && !isLooseTitle(node))

  const officialGroups = officialPool.filter(isGroupLabel).sort(byPos)
  const oursGroups = oursPool.filter(isGroupLabel).sort(byPos)
  const sharedGroups = officialGroups.filter((node) => oursGroups.some((item) => visibleText(item) === visibleText(node)))
  const sharedOursGroups = oursGroups.filter((node) => officialGroups.some((item) => visibleText(item) === visibleText(node)))
  const groups = zip(sharedGroups, sharedOursGroups.sort(byPos), 'chat-list', 'sidebar > group')
  pairs.push(...groups)
  officialPool = take(officialPool, officialGroups)
  oursPool = take(oursPool, oursGroups)

  const shells = pairShells(officialPool, oursPool)
  pairs.push(...shells)
  officialPool = take(officialPool, shells.map((pair) => pair.official))
  oursPool = take(oursPool, shells.map((pair) => pair.ours))

  const sidebars = pairByBox(officialPool, oursPool, (node) => node.rect.x <= 1 && node.rect.w > 240 && node.rect.w < 280 && node.rect.h > 700, 'sidebar')
  pairs.push(...sidebars)
  officialPool = take(officialPool, sidebars.map((pair) => pair.official))
  oursPool = take(oursPool, sidebars.map((pair) => pair.ours))

  const shortcuts = pairShortcuts(officialPool, oursPool)
  pairs.push(...shortcuts)
  officialPool = take(officialPool, shortcuts.map((pair) => pair.official))
  oursPool = take(oursPool, shortcuts.map((pair) => pair.ours))

  const greetings = pairGreetings(officialPool, oursPool)
  pairs.push(...greetings)
  officialPool = take(officialPool, greetings.map((pair) => pair.official))
  oursPool = take(oursPool, greetings.map((pair) => pair.ours))

  const padSum = (node: StyleNode) => ['top', 'right', 'bottom', 'left'].reduce((sum, side) => sum + Number.parseFloat(node.style[`padding-${side}`] || '0'), 0)
  const controlShell = (node: StyleNode, pool: StyleNode[]) => {
    let shell = node
    for (const item of pool) {
      if (item === node || item.pseudo || item.rect.h < 28 || item.rect.h > 52 || item.rect.w < 80) continue
      if (!inside(item, node)) continue
      if (item.rect.h > shell.rect.h || (item.rect.h === shell.rect.h && padSum(item) > padSum(shell))) shell = item
    }
    return shell
  }
  const labeled: Pair[] = []
  const usedLabelOurs = new Set<StyleNode>()
  const usedLabelOfficial = new Set<StyleNode>()
  for (const left of officialPool) {
    const text = visibleText(left)
    if (!text || text.length > 12 || left.pseudo || usedLabelOfficial.has(left)) continue
    const rightText = oursPool
      .filter((node) => !usedLabelOurs.has(node) && !node.pseudo && visibleText(node) === text && regionOf(node) === regionOf(left))
      .sort((a, b) => Math.abs(a.rect.y - left.rect.y) - Math.abs(b.rect.y - left.rect.y))[0]
    if (!rightText) continue
    const officialShell = controlShell(left, officialPool)
    const oursShell = controlShell(rightText, oursPool)
    if (Math.abs(officialShell.rect.w - oursShell.rect.w) > Math.max(24, officialShell.rect.w * 0.4)) continue
    if (Math.abs(officialShell.rect.h - oursShell.rect.h) > 18) continue
    if (usedLabelOfficial.has(officialShell) || usedLabelOurs.has(oursShell)) continue
    usedLabelOfficial.add(officialShell)
    usedLabelOurs.add(oursShell)
    labeled.push({ key: humanLabel(left), official: officialShell, ours: oursShell, how: 'semantic' })
  }
  pairs.push(...labeled)
  officialPool = take(officialPool, labeled.map((pair) => pair.official))
  oursPool = take(oursPool, labeled.map((pair) => pair.ours))

  const menuPanels = pairByBox(
    officialPool,
    oursPool,
    (node) => node.rect.w > 100 && node.rect.w < 180 && node.rect.h > 150 && node.rect.h < 260 && node.rect.x > 80 && node.rect.x < 420,
    'menu',
  )
  pairs.push(...menuPanels)
  officialPool = take(officialPool, menuPanels.map((pair) => pair.official))
  oursPool = take(oursPool, menuPanels.map((pair) => pair.ours))
  const inPanel = (node: StyleNode, panels: Pair[], side: 'official' | 'ours') => panels.some((pair) => inside(side === 'official' ? pair.official : pair.ours, node))
  const menuIcons = (pool: StyleNode[], side: 'official' | 'ours') => pool.filter((node) => node.tag === 'svg' && node.rect.w <= 18 && node.rect.h <= 18 && inPanel(node, menuPanels, side)).sort(byPos)
  const icons = zip(menuIcons(officialPool, 'official'), menuIcons(oursPool, 'ours'), undefined, 'menu > icon')
  pairs.push(...icons)
  officialPool = take(officialPool, icons.map((pair) => pair.official))
  oursPool = take(oursPool, icons.map((pair) => pair.ours))
  const rowMore = (pool: StyleNode[], side: 'official' | 'ours') => pool.filter((node) => (node.tag === 'button' || node.role === 'button') && node.rect.w <= 36 && node.rect.h <= 36 && node.rect.x > 150 && node.rect.x < 300 && node.rect.y > 140 && node.rect.y < 820 && !inPanel(node, menuPanels, side)).sort(byPos)
  const more = zip(rowMore(officialPool, 'official'), rowMore(oursPool, 'ours'), undefined, 'row-more')
  pairs.push(...more)
  officialPool = take(officialPool, more.map((pair) => pair.official))
  oursPool = take(oursPool, more.map((pair) => pair.ours))
  const rowMoreIcon = (pool: StyleNode[], panels: Pair[], side: 'official' | 'ours') => pool.filter((node) => {
    if (node.tag !== 'svg' || node.rect.w < 14 || node.rect.w > 18) return false
    return panels.some((pair) => {
      const box = side === 'official' ? pair.official.rect : pair.ours.rect
      return node.rect.y > box.y - 48 && node.rect.y < box.y + 6 && Math.abs(node.rect.x + node.rect.w / 2 - (box.x + box.w / 2)) < box.w
    })
  }).sort(byPos)
  const moreIcons = zip(rowMoreIcon(officialPool, menuPanels, 'official'), rowMoreIcon(oursPool, menuPanels, 'ours'), undefined, 'row-more > icon')
  pairs.push(...moreIcons)
  officialPool = take(officialPool, moreIcons.map((pair) => pair.official))
  oursPool = take(oursPool, moreIcons.map((pair) => pair.ours))

  const oursByKey = new Map<string, StyleNode[]>()
  for (const node of oursPool) {
    const key = semanticKey(node)
    if (!key) continue
    const list = oursByKey.get(key) || []
    list.push(node)
    oursByKey.set(key, list)
  }
  const usedOurs = new Set<StyleNode>()
  const usedOfficial = new Set<StyleNode>()
  for (const node of officialPool) {
    const key = semanticKey(node)
    if (!key) continue
    const found = oursByKey.get(key)?.find((item) => !usedOurs.has(item))
    if (!found) continue
    usedOurs.add(found)
    usedOfficial.add(node)
    pairs.push({ key: humanLabel(node), official: node, ours: found, how: 'semantic' })
  }
  officialPool = officialPool.filter((node) => !usedOfficial.has(node))
  oursPool = oursPool.filter((node) => !usedOurs.has(node))

  const candidates: Array<{ score: number; official: StyleNode; ours: StyleNode }> = []
  for (const left of officialPool) {
    for (const right of oursPool) {
      if (regionOf(left) !== regionOf(right)) continue
      if (left.tag !== right.tag && left.role !== right.role && !sameControl(left, right)) continue
      const widthGap = Math.abs(left.rect.w - right.rect.w)
      const heightGap = Math.abs(left.rect.h - right.rect.h)
      if (widthGap > Math.max(16, left.rect.w * 0.25) || heightGap > Math.max(12, left.rect.h * 0.35)) continue
      const gap = distance(left, right)
      const limit = Math.max(36, Math.min(left.rect.w, left.rect.h))
      if (gap > limit) continue
      candidates.push({ score: gap, official: left, ours: right })
    }
  }
  candidates.sort((a, b) => a.score - b.score)
  usedOurs.clear()
  usedOfficial.clear()
  for (const candidate of candidates) {
    if (usedOfficial.has(candidate.official) || usedOurs.has(candidate.ours)) continue
    usedOfficial.add(candidate.official)
    usedOurs.add(candidate.ours)
    pairs.push({ key: humanLabel(candidate.official), official: candidate.official, ours: candidate.ours, how: 'position' })
  }

  const contentLeaf = (node: StyleNode) => {
    if (regionOf(node) !== 'main') return false
    if (/^(button|textarea|input|svg|img|a)$/.test(node.tag)) return false
    if (!visibleText(node)) return false
    if (Number.parseFloat(node.style['font-size'] || '0') >= 20) return false
    return true
  }
  const isScrollbar = (node: StyleNode) => node.rect.w <= 10 && node.rect.h >= 80
  const isHairline = (node: StyleNode) => regionOf(node) === 'sidebar' && node.rect.h <= 2 && node.rect.w >= 80
  const sameBox = (left: StyleNode, right: StyleNode) =>
    Math.abs(left.rect.x - right.rect.x) <= 1 && Math.abs(left.rect.y - right.rect.y) <= 1
    && Math.abs(left.rect.w - right.rect.w) <= 1 && Math.abs(left.rect.h - right.rect.h) <= 1
  const paired = pairs.map((pair) => pair.official)
  const duplicate = (node: StyleNode) => paired.some((other) => other !== node && sameBox(other, node))
  const wrapsPaired = (node: StyleNode) => node.rect.h <= 28 && paired.some((other) => other !== node && inside(node, other) && other.rect.h <= 24)
  const keep = (node: StyleNode) => !contentLeaf(node) && !isScrollbar(node) && !isHairline(node) && !duplicate(node) && !wrapsPaired(node)
  return {
    pairs,
    unmatchedOfficial: officialPool.filter((node) => !usedOfficial.has(node) && keep(node)),
    unmatchedOurs: oursPool.filter((node) => !usedOurs.has(node) && keep(node)),
    officialVisible,
  }
}
