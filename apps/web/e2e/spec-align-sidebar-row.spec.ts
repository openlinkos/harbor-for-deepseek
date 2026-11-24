// Sidebar row geometry. The checker had no measurement of the title inset.
// Sources, not fitted:
// - Master a8df8b9 via staged-b5a225c/tools/row.mjs, evidence row-title-1440.txt and
//   row-title-390.txt (first pair, master): row x=12, width 236, title text x=22,
//   active light background rgb(228, 237, 253). Same at both viewports.
// - Official frozen captures named by the r23 review: answer-1440, home-with-history-1440,
//   mobile-drawer-390, answer-dark-1920. They agree with that x/width/text.
// - Official ._546d736 is height 40px, radius 12px, padding 9px 6px 9px 10px.
//   Official ._546d736 .c08e6e93 is line-height 18px and has no margin (SP-SB-056).
// - Active dark fill is the accent token --dsw-static-neutral-bluish-800 = rgb(53, 54, 56).
//   Master's dark row uses --dsw-specific-sidebar-nav-item-active (bluish-750). This pin follows the accent.
// - Hover fill is --dsw-specific-sidebar-nav-item-hover: light bluish-75 rgb(241, 243, 245),
//   dark bluish-850 rgb(44, 44, 46). theme.css maps those tokens.
// - Master a8df8b9 .chat-link.active .more is position absolute, top 6px, right 4px, 28×28,
//   svg 16×16. place-items center puts the icon 6px inside the button.
//   more.x = row.x + row.width - 4 - 28. more.y = row.y + 6.
// Phone row height stays 40px. Official height is 40px. Master's phone min-height 44px is not this pin.
import { expect, test, type Page, type Route } from '@playwright/test'

const TITLES = ['几何甲', '几何乙']

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return route.fulfill({ status: 404, json: {} })
  })
}

const seed = async (page: Page, theme: 'light' | 'dark') => {
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.evaluate(async (titles) => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => ok(request.result)
      request.onerror = () => ko(request.error)
    })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    titles.forEach((title, index) => {
      const id = crypto.randomUUID()
      const mid = crypto.randomUUID()
      const when = new Date(Date.now() - index * 60_000).toISOString()
      tx.objectStore('conversations').put({ id, title, titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: mid, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
      tx.objectStore('messages').put({ id: mid, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '问题：' + title }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  }, TITLES)
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const row = (page: Page, title: string) => page.locator('a.chat-link', { hasText: title })

const openDrawer = async (page: Page, width: number) => {
  if (width >= 768) return
  if (await page.locator('.nav-open').count()) return
  await page.getByTestId('menu').click()
  await expect.poll(async () => Math.round((await row(page, TITLES[0]).boundingBox())?.x ?? -1)).toBe(12)
}

type Box = { x: number; y: number; w: number; h: number }

const geometry = (page: Page, title: string) => row(page, title).evaluate((node) => {
  const rect = node.getBoundingClientRect()
  const style = getComputedStyle(node)
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let text: { x: number } | null = null
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (!current.textContent?.trim()) continue
    const range = document.createRange()
    range.selectNodeContents(current)
    text = { x: range.getBoundingClientRect().x }
    break
  }
  const more = node.querySelector('.more')
  const icon = more?.querySelector('svg')
  const moreBox = more?.getBoundingClientRect()
  const iconBox = icon?.getBoundingClientRect()
  const pack = (box: DOMRect | undefined): Box | null => box ? { x: box.x, y: box.y, w: box.width, h: box.height } : null
  return {
    x: rect.x,
    y: rect.y,
    w: rect.width,
    h: rect.height,
    radius: style.borderTopLeftRadius,
    bg: style.backgroundColor,
    text,
    more: pack(moreBox),
    icon: pack(iconBox),
  }
})

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`sidebar row geometry at ${vp.width} ${theme}`, async ({ page }) => {
      await page.setViewportSize(vp)
      await seed(page, theme)
      await openDrawer(page, vp.width)
      await row(page, TITLES[0]).locator('button').first().click()
      await openDrawer(page, vp.width)
      await expect(row(page, TITLES[0])).toHaveClass(/active/)
      const active = await geometry(page, TITLES[0])
      expect(Math.round(active.x), 'row x').toBe(12)
      expect(Math.round(active.w), 'row width').toBe(236)
      expect(Math.round(active.h), 'row height').toBe(40)
      expect(active.radius, 'row radius').toBe('12px')
      expect(Math.round(active.text?.x ?? -1), 'title text x').toBe(22)
      expect(active.bg, 'active highlight').toBe(theme === 'dark' ? 'rgb(53, 54, 56)' : 'rgb(228, 237, 253)')
      expect(active.more, 'active more box').not.toBeNull()
      expect(active.icon, 'active icon box').not.toBeNull()
      if (active.more && active.icon) {
        expect(Math.round(active.more.w), 'more width').toBe(28)
        expect(Math.round(active.more.h), 'more height').toBe(28)
        expect(Math.round(active.more.x), 'more x').toBe(Math.round(active.x + active.w - 32))
        expect(Math.round(active.more.y), 'more y').toBe(Math.round(active.y + 6))
        expect(Math.round(active.icon.w), 'icon width').toBe(16)
        expect(Math.round(active.icon.h), 'icon height').toBe(16)
        expect(Math.round(active.icon.x), 'icon x').toBe(Math.round(active.more.x + 6))
        expect(Math.round(active.icon.y), 'icon y').toBe(Math.round(active.more.y + 6))
      }
      await row(page, TITLES[1]).hover()
      const hover = await geometry(page, TITLES[1])
      expect(Math.round(hover.x), 'hover row x').toBe(12)
      expect(Math.round(hover.w), 'hover row width').toBe(236)
      expect(Math.round(hover.h), 'hover row height').toBe(40)
      expect(hover.radius, 'hover radius').toBe('12px')
      expect(Math.round(hover.text?.x ?? -1), 'hover title text x').toBe(22)
      expect(hover.bg, 'hover highlight').toBe(theme === 'dark' ? 'rgb(44, 44, 46)' : 'rgb(241, 243, 245)')
      expect(hover.more, 'hover more box').not.toBeNull()
      if (hover.more && hover.icon) {
        expect(Math.round(hover.more.w), 'hover more width').toBe(28)
        expect(Math.round(hover.more.h), 'hover more height').toBe(28)
        expect(Math.round(hover.more.x), 'hover more x').toBe(Math.round(hover.x + hover.w - 32))
        expect(Math.round(hover.more.y), 'hover more y').toBe(Math.round(hover.y + 6))
        expect(Math.round(hover.icon.w), 'hover icon width').toBe(16)
        expect(Math.round(hover.icon.h), 'hover icon height').toBe(16)
        expect(Math.round(hover.icon.x), 'hover icon x').toBe(Math.round(hover.more.x + 6))
        expect(Math.round(hover.icon.y), 'hover icon y').toBe(Math.round(hover.more.y + 6))
      }
    })
  }
}
