// fb1344: goes to apps/web/e2e/version.spec.ts. The built app exposes its version for people and machines.
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
const version = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version
test('version.json and meta match package.json', async ({ page, request }) => {
  const v = await (await request.get('/version.json')).json()
  expect(v.version).toBe(version); expect(v.commit).toMatch(/^[0-9a-f]{7}$|^unknown$/)
  await page.goto('/'); await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', version)
})
test('version is shown in Settings → 服务协议 (brand exception)', async ({ page }) => {
  await page.route('https://api.deepseek.com/**', (r) => r.fulfill({ json: { data: [{ id: 'deepseek-flash' }], is_available: true, balance_infos: [] } }))
  await page.goto('/'); await page.getByTestId('landing-send').click(); await page.getByTestId('key-input').fill('demo-local-key'); await page.getByTestId('key-save').click()
  await page.getByTestId('user-menu').click(); await page.getByTestId('settings-open').click(); await page.getByRole('button', { name: '服务协议' }).click()
  await expect(page.getByTestId('app-version')).toHaveText(new RegExp(`^DeepAPI v${version.replace(/\./g, '\\.')} · [0-9a-f]{7}$`))
})
