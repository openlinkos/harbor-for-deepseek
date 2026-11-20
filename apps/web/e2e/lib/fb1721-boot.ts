// Shared boot for fb1721 specs: mock api.deepseek.com (no real key), optional staged SSE, theme, locale.
// Staged SSE reuses e2e/lib/fb1344-sse.js, same as fb1554-markdown.spec.ts.
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
export const STAGED = readFileSync(join(HERE, 'fb1344-sse.js'), 'utf8')
export const sse = (events: unknown[]) => events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
export const boot = async (page: Page, theme: string, opts: { staged?: boolean; body?: (req: any) => unknown[]; freezeTransitions?: boolean } = {}) => {
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    const ev = opts.body ? opts.body(JSON.parse(route.request().postData() || '{}')) : []
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(ev) })
  })
  if (opts.staged) await page.addInitScript(STAGED)
  await page.addInitScript((t) => localStorage.setItem('deepapi-theme', t), theme)
  await page.goto('/')
  await page.getByTestId('landing-send').click(); await page.getByTestId('key-input').fill('demo-local-key'); await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  // proof-only: FIX_CSS simulates a fix to show the assertion turns green (never set in CI)
  if (process.env.FIX_CSS) await page.addStyleTag({ content: process.env.FIX_CSS })
  if (opts.freezeTransitions !== false) await page.addStyleTag({ content: '*{transition-duration:0s!important;transition-delay:0s!important}' })
}
export const chip = async (page: Page, id: string, on: boolean) => { const c = (await page.getByTestId(id).getAttribute('class')) || ''; if (c.includes('on') !== on) await page.getByTestId(id).click() }
export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768
export const drawer = async (page: Page) => { if (isMobile(page) && !(await page.locator('.nav-open').count())) { await page.getByTestId('menu').click(); await page.waitForTimeout(400) } }
export const openSettings = async (page: Page) => { await drawer(page); await page.getByTestId('user-menu').click(); await page.getByTestId('settings-open').click(); await page.getByTestId('settings-dialog').waitFor(); await page.waitForTimeout(250) }
