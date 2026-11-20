// fb1721-S: required CI gate for 昊辰 2026-11-20 17:21「这种界面都串行了」— settings controls cross their row/divider.
// Picked up by `pnpm e2e` (ci.yml) through apps/web/playwright.config.ts, same as fb1554-markdown.spec.ts:
// testDir ./e2e, testMatch *.spec.ts. There is no second playwright config.
// Official numbers: e2e/fixtures/official-fb1721.json → settingsRow (frozen CSS + style-official samples; do not edit in feature PRs).
// sha256 8ba1a80f43671876169d6528e2210c9d409f0ffb9ca42697cda4e9ea0eee319a.
// Generic row invariants (lib/fb1721-rows.js) on EVERY settings tab × light/dark × 1440/1920/390 × zh/en ×
// control states (switches flipped, safety low). No per-row whitelist: brand-exception rows (界面包、安全等级…)
// are checked exactly like official rows.
// Red cases on master are test.fail() via knownFailure(). IDs are fb1721-S1 … fb1721-S4.
// A fix PR deletes only its own id. An unexpected pass fails the run. FB1721_STRICT=1 ignores knownFailure.
import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot, openSettings } from './lib/fb1721-boot'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROWS = readFileSync(join(HERE, 'lib/fb1721-rows.js'), 'utf8')
const OFF = JSON.parse(readFileSync(join(HERE, 'fixtures/official-fb1721.json'), 'utf8'))
const SHOTS = process.env.SHOTS
const STRICT = process.env.FB1721_STRICT === '1'
// Known failure on master 6eae2b7 → the fix PR deletes this id.
const KNOWN: Record<string, string> = {
  'fb1721-S3': 'fb1721-S3: 深色分隔线用了浅色 rgba(0,0,0,.1)，官方 rgba(255,255,255,.06)',
  'fb1721-S4': 'fb1721-S4: 390 余额行换行后按钮/标签不居中',
}
const knownFailure = (id: string) => { if (!STRICT && KNOWN[id]) test.fail(true, KNOWN[id]) }
const TABS = ['general', 'account', 'data', 'legal']
const VARIANTS: { theme: 'light' | 'dark'; w: number; h: number; lang: 'zh' | 'en'; flip: boolean }[] = []
for (const theme of ['light', 'dark'] as const) for (const [w, h] of [[1440, 900], [1920, 1072], [390, 844]]) for (const lang of ['zh', 'en'] as const) VARIANTS.push({ theme, w, h, lang, flip: false })
VARIANTS.push({ theme: 'light', w: 1440, h: 900, lang: 'zh', flip: true }, { theme: 'light', w: 390, h: 844, lang: 'zh', flip: true })
for (const v of VARIANTS) {
  const cell = `${v.theme} ${v.w} ${v.lang}${v.flip ? ' flipped' : ''}`
  test.describe(`fb1721 settings ${cell}`, () => {
    test.use({ viewport: { width: v.w, height: v.h }, colorScheme: v.theme, bypassCSP: true })
    for (const tab of TABS) test(`rows-${tab}`, async ({ page }) => {
      if (tab === 'account' && v.theme === 'dark') knownFailure('fb1721-S3')
      else if (tab === 'account' && v.w < 768) knownFailure('fb1721-S4')
      await boot(page, v.theme); await openSettings(page)
      if (v.lang === 'en') { await page.getByTestId('language-trigger').click(); await page.getByRole('option', { name: 'English' }).click(); await page.waitForTimeout(300) }
      if (v.flip) { for (const s of await page.locator('[data-testid=settings-dialog] .switch').all()) if (await s.isVisible()) await s.click()
        await page.getByTestId('safety-select').click(); await page.getByRole('option').last().click(); await page.waitForTimeout(200) }
      const nav = page.getByTestId(`settings-nav-${tab}`); if (await nav.isVisible()) await nav.click(); else test.fail(true, `tab ${tab} not reachable at ${v.w}`)
      await page.waitForTimeout(250)
      await page.evaluate(ROWS)
      // scroll the panel through so every row is measured on screen
      const fails: string[] = []; let seen = 0; const metrics: unknown[] = []
      for (let pass = 0; pass < 8; pass++) {
        const r = await page.evaluate((c) => (window as any).__rows({ dividerColor: c }), OFF.settingsRow.divider[v.theme])
        metrics.push(r); seen = Math.max(seen, r.rows.length); for (const f of r.fails) fails.push(`${f.rule} 「${f.row}」 ${f.detail}`)
        const more = await page.evaluate(() => { const m = document.querySelector('.settings-main') || document.querySelector('[role=dialog] [class*=scroll]'); if (!m || m.scrollTop + m.clientHeight >= m.scrollHeight - 1) return false; m.scrollTop += m.clientHeight * 0.8; return true })
        if (!more) break; await page.waitForTimeout(100)
      }
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true })
        await page.getByTestId('settings-dialog').screenshot({ path: join(SHOTS, `settings-${tab}-${cell.replace(/ /g, '-')}.png`) })
        writeFileSync(join(SHOTS, `settings-${tab}-${cell.replace(/ /g, '-')}.json`), JSON.stringify(metrics, null, 2))
      }
      // Legal is text-only in the official app and in master; row count is genuinely zero.
      if (tab !== 'legal') expect(seen, 'rows found').toBeGreaterThan(0)
      if (tab === 'legal') { const ov = await page.locator('.settings-main').evaluate((e) => e.scrollWidth - e.clientWidth); expect(ov, 'legal text does not overflow horizontally').toBeLessThanOrEqual(1) }
      expect([...new Set(fails)]).toEqual([])
    })
  })
}
