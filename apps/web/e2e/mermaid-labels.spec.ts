import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

// Flowchart HTML labels and sequence SVG text, CJK and Latin. A label that was
// measured smaller than the font it paints with overflows its foreignObject or shape.

const answer = [
  '```mermaid',
  'flowchart LR',
  '  A[开始] -->|下一步| B[第一步]',
  '  B -->|Check| C[Done]',
  '```',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant U as 用户甲',
  '  participant S as API',
  '  U->>S: 查询 Hello',
  '  S-->>U: 完成 OK',
  '```',
].join('\n')

const required = ['开始', '第一步', '下一步', 'Check', 'Done', '用户甲', 'API', '查询 Hello', '完成 OK']

const sse = (text: string) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 8, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard' } },
    { type: 'message_stop' },
  ]
  return `${events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`
}

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] } })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return
  }
  if (!url.includes('/messages')) {
    await route.fulfill({ status: 404, json: {} })
    return
  }
  await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(answer) })
}

type LabelRow = {
  text: string
  kind: 'html' | 'svg'
  content: number
  container: number
  ellipsis: boolean
}

const measure = (root: Locator) => root.evaluate((node) => {
  const labels: LabelRow[] = []
  const failures: LabelRow[] = []
  const ellipsisOf = (el: Element) => {
    if (getComputedStyle(el).textOverflow === 'ellipsis') return true
    return [...el.querySelectorAll('*')].some((child) => getComputedStyle(child).textOverflow === 'ellipsis')
  }
  const push = (row: LabelRow) => {
    labels.push(row)
    if (!(row.content > 0) || row.content > row.container + 0.5 || row.ellipsis) failures.push(row)
  }
  node.querySelectorAll('foreignObject').forEach((fo) => {
    const text = (fo.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) return
    // The span inside a foreignObject reports scrollWidth 0. The xhtml div is the label box.
    const label = fo.querySelector('div') ?? fo
    const container = Number.parseFloat(fo.getAttribute('width') || '')
    push({
      text,
      kind: 'html',
      content: label.scrollWidth,
      container,
      ellipsis: ellipsisOf(label),
    })
  })
  node.querySelectorAll('text').forEach((text) => {
    if (text.closest('foreignObject')) return
    const value = (text.textContent || '').replace(/\s+/g, ' ').trim()
    if (!value || !(text instanceof SVGGraphicsElement)) return
    const content = text.getBBox().width
    let container = content
    let parent: Element | null = text.parentElement
    while (parent && parent.tagName.toLowerCase() !== 'svg') {
      if (parent.tagName.toLowerCase() === 'g') {
        const shape = [...parent.children].find((el) => /^(rect|polygon|ellipse|circle)$/i.test(el.tagName))
        if (shape instanceof SVGGraphicsElement) {
          container = shape.getBBox().width
          break
        }
      }
      parent = parent.parentElement
    }
    push({
      text: value,
      kind: 'svg',
      content,
      container,
      ellipsis: ellipsisOf(text),
    })
  })
  return {
    count: labels.length,
    html: labels.filter((row) => row.kind === 'html').length,
    svg: labels.filter((row) => row.kind === 'svg').length,
    failures,
    watched: labels.filter((row) => row.text === '开始' || row.text === '第一步'),
  }
})

const boot = async (page: Page, width: number, theme: 'light' | 'dark') => {
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  if (theme === 'dark') await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', '')
  else await expect(page.locator('body')).not.toHaveAttribute('data-ds-dark-theme', '')
  for (const id of ['toggle-thinking', 'toggle-search']) {
    const chip = page.getByTestId(id)
    if (await chip.evaluate((node) => node.classList.contains('on'))) await chip.click()
  }
  await page.getByTestId('composer').fill('画两张图')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('mermaid-card')).toHaveCount(2)
  await expect(page.getByTestId('mermaid-card').first().locator('.diagram-view svg')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('mermaid-card').nth(1).locator('.diagram-view svg')).toBeVisible({ timeout: 20_000 })
}

const readLabels = async (root: Locator, where: string) => {
  const report = await measure(root)
  console.log(`${where} count=${report.count} html=${report.html} svg=${report.svg} watched=${JSON.stringify(report.watched)}`)
  return { where, report }
}

const viewports = [
  { width: 1440, name: '1440' },
  { width: 390, name: '390' },
] as const

for (const viewport of viewports) {
  for (const theme of ['light', 'dark'] as const) {
    test(`mermaid labels fit in the card and in fullscreen at ${viewport.name} ${theme}`, async ({ page }) => {
      await boot(page, viewport.width, theme)
      const cards = page.getByTestId('mermaid-card')
      const surfaces = [
        await readLabels(cards.nth(0).locator('.diagram-view .mermaid'), 'inline-0'),
        await readLabels(cards.nth(1).locator('.diagram-view .mermaid'), 'inline-1'),
      ]
      const seen = await page.getByTestId('mermaid-card').evaluateAll((nodes) => nodes.flatMap((node) => [...node.querySelectorAll('foreignObject, text')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())))
      for (let index = 0; index < 2; index += 1) {
        await cards.nth(index).getByRole('button', { name: '全屏' }).click()
        const modal = page.getByTestId('mermaid-modal')
        await expect(modal.locator('.mermaid svg')).toBeVisible()
        surfaces.push(await readLabels(modal.locator('.mermaid'), `fullscreen-${index}`))
        await modal.getByRole('button', { name: '关闭' }).click()
        await expect(modal).toHaveCount(0)
      }
      for (const label of required) expect(seen.some((text) => text.includes(label)), label).toBe(true)
      expect(surfaces.some((item) => item.report.html > 0), 'flowchart html labels').toBe(true)
      expect(surfaces.some((item) => item.report.svg > 0), 'sequence svg labels').toBe(true)
      const empty = surfaces.filter((item) => item.report.count === 0).map((item) => item.where)
      const clipped = surfaces.flatMap((item) => item.report.failures.map((row) => ({ where: item.where, ...row })))
      expect(empty, 'surfaces with no labels').toEqual([])
      expect(clipped, JSON.stringify(clipped)).toEqual([])
    })
  }
}
