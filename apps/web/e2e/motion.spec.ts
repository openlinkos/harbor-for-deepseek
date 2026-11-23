import { expect, test, devices, type Browser, type Page, type Route } from '@playwright/test'

const points = [
  { id: 'desktop-1920', width: 1920, height: 1072, layout: 'desktop' },
  { id: 'desktop-1440', width: 1440, height: 900, layout: 'desktop' },
  { id: 'desktop-1280', width: 1280, height: 800, layout: 'desktop' },
  { id: 'tablet-1024', width: 1024, height: 768, layout: 'desktop' },
  { id: 'tablet-768', width: 768, height: 1024, layout: 'tablet' },
  { id: 'mobile-390', width: 390, height: 844, layout: 'mobile' },
] as const

const long = Array.from({ length: 120 }, (_, index) => `第一段第 ${index} 行，把列表撑高，方便检查跟随。`).join('\n')

const sse = (text: string, title: string) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'ok' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 12, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 20, service_tier: 'standard', output_tokens_details: { thinking_tokens: 2 } } },
    { type: 'message_stop' },
  ]
  return `${events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}`
}

const openAt = async (browser: Browser, width: number, height: number, mobile: boolean) => {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
    userAgent: mobile
      ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
      : devices['Desktop Chrome'].userAgent,
  })
  const page = await context.newPage()
  let reply = long
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }] } })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
      return
    }
    if (!url.includes('/messages')) {
      await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
      return
    }
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(reply, reply === long ? '长列表' : '新的一段') })
  })
  const nextReply = (text: string) => {
    reply = text
  }
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  return { page, nextReply }
}

for (const point of points) {
  test(`shared motion at ${point.id}`, async ({ browser }) => {
    test.setTimeout(60_000)
    const mobile = point.layout === 'mobile'
    const { page } = await openAt(browser, point.width, point.height, mobile)
    try {
      await expect(page.locator('.greeting')).toContainText('今天有什么可以帮到你？')
      const bar = await page.locator('.transcript').evaluate((node) => getComputedStyle(node).scrollbarWidth)
      expect(bar).toBe('none')
      const max = await page.locator('.transcript').evaluate((node) => getComputedStyle(node).maxWidth)
      if (point.width >= 1024) {
        expect(max).toBe('840px')
      } else if (point.width >= 768) {
        expect(max).toBe('712px')
        const stage = await page.locator('.stage').boundingBox()
        const list = await page.locator('.transcript').boundingBox()
        const inset = Math.round((list?.x ?? 0) - (stage?.x ?? 0))
        expect(inset).toBeGreaterThanOrEqual(35)
        expect(inset).toBeLessThanOrEqual(37)
      } else {
        const composer = await page.locator('.composer').boundingBox()
        expect(Math.round(composer?.x ?? 0)).toBeGreaterThanOrEqual(31)
        expect(Math.round(composer?.x ?? 0)).toBeLessThanOrEqual(33)
      }

      if (mobile) {
        await expect(page.locator('.chip-label').first()).toBeVisible()
        await expect(page.getByTestId('toggle-thinking')).toHaveCSS('height', '34px')
        await expect(page.getByTestId('toggle-thinking')).toContainText('深度思考')
        await expect(page.locator('.sidebar')).toBeHidden()
      } else {
        await expect(page.locator('.chip-label').first()).toBeVisible()
        await expect(page.getByTestId('toggle-thinking')).toHaveCSS('height', '34px')
        const pill = await page.getByTestId('toggle-thinking').boundingBox()
        expect(pill?.width ?? 0).toBeGreaterThan(34)
        if (point.width < 1024) {
          await expect(page.locator('.sidebar')).toBeHidden()
          const collapsedWidth = await page.locator('.sidebar').evaluate((node) => Math.round(node.getBoundingClientRect().width))
          expect(collapsedWidth).toBe(0)
          await page.getByRole('button', { name: '打开边栏' }).click()
          await expect(page.locator('.sidebar')).toBeVisible()
        } else {
          await expect(page.locator('.sidebar')).toBeVisible()
          const width = await page.locator('.sidebar').evaluate((node) => Math.round(node.getBoundingClientRect().width))
          expect(width).toBe(261)
        }
        const motion = await page.locator('.sidebar').evaluate((node) => getComputedStyle(node).transitionDuration)
        expect(motion).toContain('0.3s')
      }

      if (mobile) {
        await page.getByTestId('menu').click()
        await expect(page.locator('.sidebar')).toBeVisible()
      }
      await page.getByTestId('user-menu').click()
      await page.getByTestId('settings-open').click()
      await expect(page.locator('.settings-shell')).toBeVisible()
      const pop = await page.locator('.settings-shell').evaluate((node) => getComputedStyle(node).animationName)
      expect(pop).toContain('harbor-pop')
      const scrollColor = await page.locator('.settings-main').evaluate((node) => getComputedStyle(node).scrollbarColor)
      expect(scrollColor).toContain('rgba(0, 0, 0')
      await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
      await expect(page.getByTestId('settings-dialog')).toBeHidden()
      if (mobile) {
        await page.locator('.scrim').click({ position: { x: 320, y: 500 } })
        await expect(page.locator('.sidebar')).toBeHidden()
      }

      await page.getByTestId('composer').fill('先写长的')
      await page.getByTestId('send').click()
      await expect(page.getByTestId('assistant-text')).toContainText('第一段第 0 行')
      await expect(page.getByTestId('assistant-text')).toContainText('第一段第 119 行')
      const placed = await page.getByTestId('message-list').evaluate((node) => {
        const prose = node.querySelectorAll('.prose')
        const last = prose[prose.length - 1] as HTMLElement | undefined
        if (!last) return { top: 999, distance: 0 }
        const list = node.getBoundingClientRect()
        const box = last.getBoundingClientRect()
        return { top: box.top - list.top, distance: node.scrollHeight - node.scrollTop - node.clientHeight }
      })
      expect(placed.top).toBeGreaterThanOrEqual(-1)
      expect(placed.top).toBeLessThanOrEqual(40)
      expect(placed.distance).toBeGreaterThan(52)
      await expect(page.getByRole('button', { name: '回到底部' })).toBeVisible()

      await page.getByTestId('message-list').evaluate((node) => {
        node.scrollTop = node.scrollHeight - node.offsetHeight - 80
        node.dispatchEvent(new Event('scroll'))
      })
      await expect(page.getByRole('button', { name: '回到底部' })).toBeVisible()
      await page.getByTestId('message-list').evaluate((node) => {
        node.scrollTop = node.scrollHeight - node.offsetHeight
        node.dispatchEvent(new Event('scroll'))
      })
      await expect(page.getByRole('button', { name: '回到底部' })).toBeHidden()
      await page.getByTestId('message-list').evaluate((node) => {
        node.scrollTop = 0
        node.dispatchEvent(new Event('scroll'))
      })
      await expect(page.getByRole('button', { name: '回到底部' })).toBeVisible()
      await page.getByRole('button', { name: '回到底部' }).click({ force: true })
      await expect(page.getByRole('button', { name: '回到底部' })).toBeHidden()

      if (mobile) {
        await page.getByTestId('menu').click()
        await expect(page.locator('.sidebar')).toBeVisible()
        const drawer = await page.locator('.sidebar').evaluate((node) => Math.round(node.getBoundingClientRect().width))
        expect(drawer).toBe(261)
        await page.locator('.chat-link .more').first().click()
        await expect(page.locator('.item-menu.sheet')).toBeVisible()
        await expect(page.locator('.item-menu-scrim')).toBeVisible()
        await page.locator('.item-menu-scrim').click({ position: { x: 200, y: 120 } })
        await page.getByTestId('new-chat').click()
      } else {
        await page.locator('.chat-link').first().hover()
        await page.locator('.chat-link .more').first().click()
        await expect(page.locator('.item-menu')).toBeVisible()
        await expect(page.locator('.item-menu.sheet')).toHaveCount(0)
        await page.keyboard.press('Escape')
        await page.getByTestId('new-chat').click()
        await expect(page.locator('.greeting')).toBeVisible()
        await page.getByRole('button', { name: '收起边栏' }).click()
        await expect(page.locator('.shell')).toHaveClass(/sider-collapsed/)
        await expect(page.locator('.sidebar')).toHaveCSS('width', '0px')
      }
      await expect(page.locator('.greeting')).toContainText(/欢迎回来，(想从哪里开始？|随时开始吧)|你好，我能帮什么忙吗？/)
    } finally {
      await page.context().close().catch(() => undefined)
    }
  })
}
