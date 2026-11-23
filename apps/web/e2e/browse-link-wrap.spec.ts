// Official evidence (do not treat this as a baseline/threshold change):
//   CSS: frozen official-source/main.dc093a796f.css
//     item ._02fb570 { white-space:nowrap; display:inline-flex; max-width:100%; margin-right:6px }
//     link ._04ab7b1 { display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%;
//                      text-decoration-line:underline; text-decoration-style:dotted }
//     wrap .f2021e64 { display:flex; flex-wrap:wrap; align-items:center; row-gap:6px;
//                      width:calc(100% - 30px); overflow:hidden }
//   Screenshots: official-captures/fb1344/t1_06_A3_thinking_after_browse4.png
//                official-captures/fb1554/c5_01_thinking_search_browse.png
// Official layout: each title+↗ is one line box and wraps as a whole unit;
// a title longer than the wrap box ellipsizes; nothing may cross the wrap box's right edge.
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SHOTS = process.env.BROWSE_WRAP_SHOTS || '/tmp/browse-wrap-shots'

const PAGES = [
  { title: '杭州天气预报,杭州7天天气预报,杭州15天天气预报,杭州天气查询', url: 'https://weather.example/1' },
  { title: '杭州又迎低温！新一股冷空气在候场，周末仍是赏秋好时机', url: 'https://weather.example/2' },
  { title: '今日小雪 | 杭州的早晨寒意十足 赏秋的好时候到了', url: 'https://weather.example/3' },
  { title: '杭州冷出今年下半年新低 气温“过山车”要来了', url: 'https://weather.example/4' },
  { title: '周五至周六早晨气温或跌破“冰点”', url: 'https://weather.example/5' },
  { title: '刚刚，杭州下大雪了！最低-4℃，后面还要冷！', url: 'https://weather.example/6' },
]

const sse = (events: object[]) => events.map((e: object) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('')

const events = () => {
  const o: object[] = [{ type: 'message_start', message: { id: 'r', model: 'deepseek-flash' } }]
  let i = 0
  o.push(
    { type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: '需要打开几个天气页面核对气温。' } },
    { type: 'content_block_stop', index: i++ },
    { type: 'content_block_start', index: i, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: PAGES.map((p, n) => ({ type: 'web_search_result', title: p.title, url: p.url, snippet: '', site_name: '天气', page_age: '2026-11-22T00:00:00Z', encrypted_content: 'x' })) } },
    { type: 'content_block_stop', index: i++ },
  )
  PAGES.forEach((p, k) => {
    o.push(
      { type: 'content_block_start', index: i, content_block: { type: 'server_tool_use', id: 'f' + k, name: 'deepseek_web_fetch', input: { action: 'open_page', url: p.url } } },
      { type: 'content_block_stop', index: i++ },
      { type: 'content_block_start', index: i, content_block: { type: 'web_fetch_tool_result', tool_use_id: 'f' + k, content: { type: 'web_fetch_result', url: p.url, content: { type: 'document', title: p.title, source: { type: 'text', media_type: 'text/plain', data: '' } }, published_at: null } } },
      { type: 'content_block_stop', index: i++ },
    )
  })
  o.push(
    { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: '杭州未来一周气温先降后升。' } },
    { type: 'content_block_stop', index: i++ },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '[筑衡测试] 浏览链接换行' }, usage: { input_tokens: 1, output_tokens: 1 } },
    { type: 'message_stop' },
  )
  return o
}

const boot = async (page: Page, theme: string) => {
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(events()) })
  })
  await page.addInitScript((t) => localStorage.setItem('deepapi-theme', t), theme)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.addStyleTag({ content: '*{transition-duration:0s!important;transition-delay:0s!important}' })
  for (const id of ['toggle-thinking', 'toggle-search']) {
    const c = (await page.getByTestId(id).getAttribute('class')) || ''
    if (!c.includes('on')) await page.getByTestId(id).click()
  }
  await page.getByTestId('composer').fill('[筑衡测试] 浏览链接换行')
  await page.getByTestId('send').click()
  await page.getByTestId('assistant-text').first().waitFor()
  await page.locator('.browse-item, .browse-link').first().waitFor()
}

const measure = async (page: Page) => page.evaluate(() => {
  const row = document.querySelector('.timeline-browse') as HTMLElement | null
  if (!row) return { error: 'no-browse-row', items: [] as never[], violations: [{ type: 'missing', detail: 'no .timeline-browse' }] }
  const rowBox = row.getBoundingClientRect()
  const wrap = row.querySelector('.browse-wrap, .browse-items, .browse-line-inner') as HTMLElement | null
  const wrapBox = (wrap || row).getBoundingClientRect()
  const body = (row.closest('.thinking-body') || row.closest('.turn') || row.parentElement) as HTMLElement
  const bodyBox = body.getBoundingClientRect()
  const items = [...row.querySelectorAll('.browse-item')] as HTMLElement[]
  const violations: object[] = []
  for (const item of items) {
    const link = item.querySelector('a.browse-link') as HTMLElement | null
    const arrow = (item.querySelector('.browse-ext') || item.querySelector('svg')) as HTMLElement | null
    const title = (link?.textContent || '').trim()
    const itemRects = [...item.getClientRects()]
    const linkRects = link ? [...link.getClientRects()] : []
    const itemBox = item.getBoundingClientRect()
    const itemSpan = itemRects.length ? Math.max(...itemRects.map((r) => r.top)) - Math.min(...itemRects.map((r) => r.top)) : 0
    if (itemRects.length > 1 && itemSpan > 2) {
      violations.push({ type: 'item-splits-lines', title, rects: itemRects.length, lineSpan: itemSpan })
    }
    const linkSpan = linkRects.length ? Math.max(...linkRects.map((r) => r.top)) - Math.min(...linkRects.map((r) => r.top)) : 0
    if (linkRects.length > 1 && linkSpan > 2) {
      violations.push({ type: 'link-wraps', title, rects: linkRects.length, lineSpan: linkSpan })
    }
    if (link && arrow) {
      const lb = link.getBoundingClientRect()
      const ab = arrow.getBoundingClientRect()
      const sameLine = ab.bottom > lb.top + 1 && ab.top < lb.bottom - 1
      if (!sameLine) violations.push({ type: 'arrow-split', title, linkTop: lb.top, linkBottom: lb.bottom, arrowTop: ab.top, arrowBottom: ab.bottom })
    }
    // Official wrap box sits beside the icon (width:calc(100% - 30px)).
    // Wrapped items must not cross the vertical timeline line / sit under the icon.
    // They align with the "浏览 N 个页面" count, as in official-captures/fb1344/t1_06_*.png.
    const count = row.querySelector('.browse-count') as HTMLElement | null
    const icon = row.querySelector('svg') as SVGElement | null
    const lineLeft = count ? count.getBoundingClientRect().left : (icon ? icon.getBoundingClientRect().right : rowBox.left)
    if (itemBox.left + 1 < lineLeft) {
      violations.push({ type: 'crosses-timeline-line', title, itemLeft: itemBox.left, lineLeft, delta: lineLeft - itemBox.left })
    }
    // Official wrap box is width:calc(100% - 30px) of the row and overflow:hidden.
    // Items must not cross that column or the thinking/answer content edge.
    const edges = [
      { name: 'wrap', right: wrapBox.right },
      { name: 'row', right: rowBox.right },
      { name: 'body', right: bodyBox.right },
    ]
    for (const edge of edges) {
      const overflow = itemBox.right - edge.right
      if (overflow > 1) violations.push({ type: 'overflow', title, edge: edge.name, overflow, itemRight: itemBox.right, edgeRight: edge.right })
    }
  }
  return {
    n: items.length,
    row: { left: rowBox.left, right: rowBox.right, width: rowBox.width },
    wrap: { left: wrapBox.left, right: wrapBox.right, width: wrapBox.width, className: (wrap || row).className },
    body: { right: bodyBox.right, width: bodyBox.width },
    items: items.map((item) => {
      const link = item.querySelector('a.browse-link')
      const box = item.getBoundingClientRect()
      return { title: (link?.textContent || '').trim(), left: box.left, right: box.right, width: box.width, top: box.top, height: box.height, linkRects: link ? link.getClientRects().length : 0 }
    }),
    violations,
  }
})

const shot = async (page: Page, name: string) => {
  mkdirSync(SHOTS, { recursive: true })
  const row = page.locator('.timeline-browse').first()
  await row.scrollIntoViewIfNeeded()
  await row.screenshot({ path: join(SHOTS, `${name}.png`) })
}

for (const theme of ['light', 'dark'] as const) {
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    test.describe(`browse-wrap ${theme} ${w}`, () => {
      test.use({ viewport: { width: w, height: h }, colorScheme: theme, bypassCSP: true })
      test('each title+arrow stays on one line and does not overflow', async ({ page }) => {
        await boot(page, theme)
        await shot(page, `${theme}-${w}`)
        const m = await measure(page)
        expect(m, JSON.stringify(m, null, 2)).not.toHaveProperty('error')
        expect(m.n, JSON.stringify(m, null, 2)).toBe(Math.min(PAGES.length, 5))
        expect(m.violations, JSON.stringify(m, null, 2)).toEqual([])
      })
    })
  }
}
