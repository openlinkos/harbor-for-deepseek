// Computed conversation styles. Bubble, column margin, and the action row.
import { expect, test, type Page, type Route } from '@playwright/test'

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return route.fulfill({ status: 404, json: {} })
  })
}

const openSeed = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => ok(request.result)
      request.onerror = () => ko(request.error)
    })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    const id = crypto.randomUUID()
    const user = crypto.randomUUID()
    const assistant = crypto.randomUUID()
    const when = new Date().toISOString()
    tx.objectStore('conversations').put({ id, title: '气泡', titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: assistant, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: user, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '你好' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: assistant, conversationId: id, parentId: user, role: 'assistant', blocks: [{ type: 'text', text: '好的。' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  if ((page.viewportSize()?.width ?? 1440) < 768) await page.getByTestId('menu').click()
  await page.locator('a.chat-link', { hasText: '气泡' }).click()
  await expect(page.locator('.bubble')).toBeVisible()
}

// Normal mode must not reserve the share checkbox column. Master a8df8b9
// (wt-spec-ref) renders the checkbox with the hidden attribute, and
// input.share-box[hidden] is display:none, so it adds no gap. The in-flow
// sticky is 13+18+13 = 44px (styles.css .share-sticky). SP-SHARE-033.
const assertNoShareSticky = async (page: Page) => {
  await expect(page.locator('.share-col')).toHaveCount(0)
  await expect(page.locator('.share-sticky')).toHaveCount(0)
  const spacing = await page.evaluate(() => {
    const turn = document.querySelector('.turn.user') as HTMLElement
    const bubble = turn.querySelector('.bubble') as HTMLElement
    const assistant = document.querySelector('.turn.assistant') as HTMLElement
    const prose = assistant.querySelector('.prose') as HTMLElement
    const pad = parseFloat(getComputedStyle(turn).paddingTop)
    const margin = parseFloat(getComputedStyle(bubble).marginTop)
    return {
      userLead: bubble.getBoundingClientRect().top - turn.getBoundingClientRect().top,
      pad,
      margin,
      answerLead: prose.getBoundingClientRect().top - assistant.getBoundingClientRect().top,
    }
  })
  expect(Math.abs(spacing.userLead - (spacing.pad + spacing.margin)), `user bubble lead ${JSON.stringify(spacing)}`).toBeLessThanOrEqual(0.5)
  expect(spacing.answerLead, `answer lead ${JSON.stringify(spacing)}`).toBeLessThan(20)
}

test('bubble, column, and action row match the official message styles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSeed(page)
  await assertNoShareSticky(page)
  const bubble = page.locator('.bubble').first()
  await expect(bubble).toHaveCSS('font-size', '16px')
  await expect(bubble).toHaveCSS('line-height', '24px')
  await expect(bubble).toHaveCSS('border-radius', '22px')
  await expect(bubble).toHaveCSS('padding-top', '10px')
  await expect(bubble).toHaveCSS('padding-right', '16px')
  await expect(bubble).toHaveCSS('white-space', 'pre-wrap')
  await expect(bubble).toHaveCSS('background-color', 'rgb(237, 243, 254)')
  await expect(bubble).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(bubble).toHaveCSS('margin-top', '10px')
  await expect(page.locator('.turn.user')).toHaveCSS('margin-bottom', '16px')
  const widths = await page.evaluate(() => {
    const turn = document.querySelector('.turn.user') as HTMLElement
    const column = document.querySelector('.chat-column') as HTMLElement
    return { turn: turn.clientWidth, column: column.clientWidth, specified: getComputedStyle(turn).width }
  })
  expect(Math.abs(widths.turn - widths.column)).toBeLessThanOrEqual(1)
  await expect(page.locator('.chat-column')).toHaveCSS('margin-top', '0px')
  const row = page.locator('.action-row').last()
  await expect(row).toHaveCSS('padding-top', '12px')
  await expect(row).toHaveCSS('padding-bottom', '10px')
  await expect(row).toBeVisible()
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await expect(bubble).toHaveCSS('background-color', 'rgb(44, 44, 46)')
  await expect(bubble).toHaveCSS('color', 'rgb(249, 250, 251)')
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))

  await page.setViewportSize({ width: 390, height: 844 })
  const column = page.locator('.chat-column')
  await expect(column).toHaveCSS('margin-left', '20px')
  await expect(column).toHaveCSS('margin-right', '20px')
  await expect(column).toHaveCSS('margin-top', '0px')
  await expect(bubble).toHaveCSS('max-width', 'calc(100% - 68px)')
})
