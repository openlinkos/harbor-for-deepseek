// SP-TH-220. New chat after an expanded thinking block returns to the home
// greeting: no thinking body, no search panel, empty composer. The stored
// DeepThink toggle is left as it is.
import { expect, test } from '@playwright/test'
import { boot } from './lib/fb1721-boot'

const answer = [
  { type: 'message_start', message: { id: 'req-think', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先核对人口数字。' } },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'content_block_start',
    index: 1,
    content_block: {
      type: 'web_search_tool_result',
      tool_use_id: 'srvtoolu_s_00_redacted',
      kind: 'search',
      content: [{
        type: 'web_search_result',
        title: 'Iceland population',
        url: 'https://example.com/iceland',
        snippet: 'About 394,000 people.',
        site_name: 'Example',
        site_icon: null,
        page_age: '2026-11-16',
      }],
    },
  },
  { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '大约三十九万。' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '冰岛人口' }, usage: { input_tokens: 20, output_tokens: 8 } },
  { type: 'message_stop' },
]

test('SP-TH-220 new chat clears the thinking body and the search panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await boot(page, 'light', { body: () => answer, freezeTransitions: false })
  await page.getByTestId('composer').fill('冰岛人口')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('thinking')).toBeVisible()
  await expect(page.locator('.thinking-body')).toBeVisible()
  await expect(page.locator('.thinking-body')).toContainText('先核对人口数字。')
  await expect(page.locator('.thinking-body')).toHaveCSS('font-size', '14px')
  await expect(page.locator('.thinking-body')).toHaveCSS('line-height', '24px')
  await expect(page.locator('.thinking-body')).toHaveCSS('color', 'rgb(97, 102, 107)')
  await expect(page.locator('.timeline-step').first()).toHaveCSS('padding-top', '5px')
  await expect(page.locator('.timeline-step').first()).toHaveCSS('padding-left', '22px')
  await page.getByTestId('search-results').click()
  await expect(page.getByTestId('search-panel')).toBeVisible()
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.home')).toBeVisible()
  await expect(page.getByTestId('thinking')).toHaveCount(0)
  await expect(page.locator('.thinking-body')).toHaveCount(0)
  await expect(page.getByTestId('search-panel')).toBeHidden()
  await expect(page.getByTestId('composer')).toHaveValue('')
})
