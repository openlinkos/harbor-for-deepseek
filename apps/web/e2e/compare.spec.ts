import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), '../../docs/parity/ours')
mkdirSync(dir, { recursive: true })

const quicksortUser = '请用一个 markdown 表格、一段 python 代码块、一个 LaTeX 公式和一个三级列表，简单介绍快速排序。'
const quicksort = [
  '| 项目 | 说明 |',
  '| --- | --- |',
  '| 核心思想 | 选一个基准元素，把数组分成“小于基准”和“大于基准”两部分，再递归排序 |',
  '| 平均时间复杂度 | $O(n\\log n)$ |',
  '| 最坏时间复杂度 | $O(n^2)$，例如每次基准都选到最值 |',
  '| 空间复杂度 | 平均 $O(\\log n)$，递归栈开销 |',
  '| 稳定性 | 通常不稳定 |',
  '',
  '快速排序的分治递推关系可表示为：',
  '',
  '$$T(n) = T(k) + T(n-1-k) + \\Theta(n)$$',
  '',
  '其中 $k$ 是分区后小于基准的元素个数；平均情况下 $T(n) = O(n\\log n)$。',
  '',
  '```python',
  'def quick_sort(arr):',
  '    if len(arr) <= 1:',
  '        return arr',
  '    pivot = arr[len(arr) // 2]',
  '    left = [x for x in arr if x < pivot]',
  '    mid = [x for x in arr if x == pivot]',
  '    right = [x for x in arr if x > pivot]',
  '    return quick_sort(left) + mid + quick_sort(right)',
  '',
  'print(quick_sort([3, 6, 1, 8, 2, 5]))',
  '```',
  '',
  '三级列表来说明快速排序流程：',
  '',
  '- 第一级：选择基准',
  '  - 第二级：从数组中选一个元素作为 pivot',
  '    - 第三级：常用选法包括首元素、尾元素、中间元素或随机元素',
  '- 第一级：分区',
  '  - 第二级：将元素与 pivot 比较',
  '    - 第三级：小于 pivot 放左边，大于 pivot 放右边，等于 pivot 可放中间',
  '- 第一级：递归排序',
  '  - 第二级：对左右子数组分别递归调用快速排序',
  '    - 第三级：当子数组长度小于等于 1 时停止递归，最终得到有序数组',
].join('\n')

const weather = [
  '## 🌤️ 天气与气温：一天之内体验“两季”',
  '',
  '今天白天到夜间，上海天气会经历一个转变过程：阴到多云，伴有短时小雨，中午起转为多云到阴，夜里则会是晴到多云的天气。〔1〕〔2〕',
  '',
  '气温方面，呈现“倒挂”走势。虽然最高气温仍可能达到15℃左右，但这通常出现在上午。随着冷空气主体南下，气温会一路下跌，傍晚下班时段预计会降到10℃至13℃，夜间还会更低。中心城区（徐家汇站）今天的最高气温实际止步于14.6℃。〔2〕〔1〕',
  '',
  '## 🌬️ 风力强劲，务必注意防风',
  '',
  '今天的风力非常明显。西北风可达4-5级，上午起会增大到5-6级，阵风7级；沿江沿海地区风力更强，阵风可达7-8级。上海市气象台已发布大风蓝色预警，预计午夜以后风力才会逐渐减弱。大风天气下，请留意高空坠物，避开广告牌等临时搭建物。〔3〕〔1〕',
  '',
  '## 🍃 空气质量与预警信息',
  '',
  '受上游颗粒物输送影响，今天上海的空气质量有所下降，为轻度污染，首要污染物是PM2.5，易感人群建议做好防护。目前，大风蓝色预警以及嘉定、奉贤等7个郊区的寒潮蓝色预警仍在生效中。不过，根据上海市气象局的预报，今天AQI指数预计在60-80之间，等级为良。〔5〕〔1〕',
  '',
  '## 💡 温馨提示',
  '',
  '这次冷空气实力强劲，预计48小时（17-19日）最低气温降幅可达8～10℃。明晨（19日）会更冷，中心城区最低气温在6℃左右，郊区仅2-4℃，并可能出现霜或暗霜。如果晚归，一定要记得穿上保暖的衣物，谨防感冒。〔2〕',
].join('\n')

const sse = (events: unknown[]) =>
  `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const reply = (title: string, thinking: string, text: string, extra: unknown[] = []) => [
  { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking } },
  { type: 'content_block_stop', index: 0 },
  ...extra,
  { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 2 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 80, service_tier: 'standard', output_tokens_details: { thinking_tokens: 12 } } },
  { type: 'message_stop' },
]

let kind: 'quick' | 'weather' | 'delay' = 'quick'

const fulfill = async (route: Route) => {
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
  if (kind === 'delay') {
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  if (kind === 'weather') {
    const results = [
      { title: '强冷空气抵沪！今天最高15℃，傍晚时段跌至10℃左右，明天最低仅6℃！', url: 'https://example.com/sohu', snippet: '今天最高15℃，傍晚时段跌至10℃左右，明天最低仅6℃！2026-11-18 09:44 发布于 … 今天最高气温15度 明天最低…', site_name: '手机搜狐网', page_age: '2026-11-17' },
      { title: '强冷空气上午起影响本市 早晚如两季！', url: 'https://example.com/tianqi', snippet: '强冷空气影响下，预计48小时（17-19日）最低气温降幅可达8～10℃，周四到周六早晨气温较低，市区最低气温6℃…', site_name: '天气网', page_age: '2026-11-17' },
      { title: '怕冷星人注意了：明晨郊区最低2℃！', url: 'https://example.com/tianqi-2', snippet: '受冷空气影响，上海今天云系较多 … 风力明显增大。气温也是止步不前，市区徐家汇站今天白天最高气温14.6℃ …', site_name: '天气网', page_age: '2026-11-17' },
      { title: '上海开启硬核降温！明晨更冷，郊区最低2℃有霜，防寒要点速看', url: 'https://example.com/gmw', snippet: '今天冷空气南下，午后气温缓慢下跌，晚间气温更低，加上风寒效应明显，下班时段体感明显变冷。此外 … 今天上午…', site_name: '光明网', page_age: '2026-11-17' },
      { title: '首页-上海市气象局', url: 'https://example.com/shmb', snippet: '首要污染物:PM2.5 - AQI 良 … - 18日（00时—24时）- 60-80 … - 11月18日 星期三多云 晴 9℃～15℃', site_name: '上海市气象局', page_age: '2026-11-15' },
      { title: '上海开启硬核降温！明晨更冷，郊区最低2℃有霜，防寒要点速看', url: 'https://example.com/toutiao', snippet: '伴随冷空气南下，今天上午气温在小幅上升接近15℃后调头下跌，预计下班时段的气温降至13~10℃ … 下班时段体感…', site_name: '今日头条', page_age: '2026-11-17' },
      { title: '上海-天气预报', url: 'https://example.com/nmc', snippet: '上海 10.2℃ … 降水量 0mm 东南风 微风 相对湿度 … 8.9℃ … 11-18 20:00 11/18 周三 6℃ 晴 西北风 … 阴', site_name: '中央气象台', page_age: '2026-11-17' },
      { title: '上海天气预报 上海7天天气预报', url: 'https://example.com/tianqi-7', snippet: '上海今天天气：阴转多云，短时小雨，午后气温回落。', site_name: '天气网', page_age: '2026-11-15' },
      { title: '寒潮蓝色预警', url: 'https://example.com/cold', snippet: '嘉定、奉贤等7个郊区的寒潮蓝色预警仍在生效。', site_name: '预警', page_age: '2026-11-17' },
      { title: '大风蓝色预警', url: 'https://example.com/wind', snippet: '上海市气象台发布大风蓝色预警，沿江沿海阵风7-8级。', site_name: '预警', page_age: '2026-11-17' },
      { title: '上海空气质量', url: 'https://example.com/aqi', snippet: '今天AQI指数预计在60-80之间，等级为良，首要污染物PM2.5。', site_name: '空气质量', page_age: '2026-11-17' },
      { title: '徐家汇站实况', url: 'https://example.com/xjh', snippet: '中心城区（徐家汇站）今天的最高气温实际止步于14.6℃。', site_name: '气象台', page_age: '2026-11-17' },
    ]
    const extra = [
      { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'tool', kind: 'search', content: results.map((item) => ({ type: 'web_search_result', site_icon: null, ...item })) } },
    ]
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(reply('上海今日强冷空气降温', '先查上海实时天气、风力和空气质量。', weather, extra)) })
    return
  }
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: sse(reply('快排介绍', '先列复杂度，再写递推公式、Python 实现和三级步骤。', quicksort)),
  })
}

const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: join(dir, name), animations: 'disabled' })
}

const pinGreeting = async (page: Page) => {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const text = await page.locator('.greeting').innerText()
    if (text.includes('你好，我能帮什么忙吗？')) {
      return
    }
    await page.getByRole('button', { name: '快排介绍' }).click()
    await expect(page.locator('.greeting')).toHaveCount(0)
    await page.getByTestId('new-chat').click()
    await expect(page.locator('.greeting')).toBeVisible()
  }
  await expect(page.locator('.greeting')).toContainText('你好，我能帮什么忙吗？')
}

test('capture official states at 1920x1072', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1072 })
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()

  kind = 'quick'
  await page.getByTestId('composer').fill(quicksortUser)
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('核心思想')
  await expect(page.getByTestId('sidebar')).toContainText('快排介绍')
  await page.getByTestId('new-chat').click()
  await pinGreeting(page)
  await expect(page.getByTestId('toggle-thinking')).toHaveClass(/on/)
  await expect(page.getByTestId('toggle-search')).toHaveClass(/on/)
  await shot(page, 'home.png')

  await page.getByTestId('composer').focus()
  await shot(page, 'composer-focus.png')

  await page.keyboard.press('Control+k')
  await expect(page.locator('.search-dialog')).toBeVisible()
  await shot(page, 'search-dialog.png')
  await page.keyboard.press('Escape')

  await page.getByTestId('user-menu').click()
  await expect(page.getByText('系统设置')).toBeVisible()
  await shot(page, 'user-menu.png')
  await page.getByTestId('settings-open').click()
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()
  await expect(page.getByRole('button', { name: '深色' })).toHaveClass(/on/)
  await shot(page, 'settings-general.png')
  await page.getByTestId('language-trigger').click()
  await expect(page.getByRole('option', { name: 'English' })).toBeVisible()
  await shot(page, 'settings-general-language-dropdown.png')
  await page.getByTestId('language-trigger').click()
  await page.getByRole('button', { name: '账号管理' }).click()
  await expect(page.getByTestId('nickname')).toBeVisible()
  await expect(page.getByText('微信')).toHaveCount(0)
  await shot(page, 'settings-account.png')
  await page.getByRole('button', { name: '数据管理' }).click()
  await expect(page.getByText('导出所有历史对话')).toBeVisible()
  await shot(page, 'settings-data.png')
  await page.getByRole('button', { name: '服务协议' }).click()
  await expect(page.getByTestId('site-footer')).toBeVisible()
  await shot(page, 'settings-agreement.png')
  await page.getByRole('button', { name: '通用设置' }).click()
  await page.getByRole('button', { name: '浅色' }).click()
  await expect(page.locator('body')).not.toHaveAttribute('data-ds-dark-theme', '')
  await shot(page, 'settings-general-light.png')
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
  await shot(page, 'home-light.png')

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  await page.getByRole('button', { name: '快排介绍' }).click()
  await expect(page.getByTestId('assistant-text')).toContainText('quick_sort')
  await page.getByTestId('message-user').hover()
  await shot(page, 'answer-rich-thinking-expanded-user-bubble.png')
  await page.getByTestId('thinking-toggle').click()
  await expect(page.locator('.thinking-collapse')).not.toHaveClass(/open/)
  await shot(page, 'answer-rich-thinking-collapsed.png')
  await shot(page, 'answer-rich-table-math-code.png')
  await page.locator('.code-card').getByRole('button', { name: '复制' }).hover()
  await page.waitForTimeout(200)
  await shot(page, 'answer-rich-code-copy-hover.png')
  await page.locator('.action-row').getByRole('button', { name: '复制' }).hover()
  await page.waitForTimeout(200)
  await shot(page, 'answer-rich-actionrow-copy-tooltip.png')
  await page.locator('.action-row').getByRole('button', { name: '分享' }).hover()
  await page.waitForTimeout(200)
  await shot(page, 'answer-rich-actionrow-share-tooltip.png')

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '浅色' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  await shot(page, 'answer-rich-light.png')

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  kind = 'delay'
  await page.getByTestId('new-chat').click()
  await page.getByTestId('composer').fill('停一下')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('stop')).toBeVisible()
  await shot(page, 'streaming-stop-button.png')
  await page.getByTestId('stop').click()

  kind = 'weather'
  await page.getByTestId('new-chat').click()
  await page.getByTestId('composer').fill('上海今天天气怎么样')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('search-results')).toBeVisible()
  await shot(page, 'answer-search-timeline-expanded-sources-open.png')
  await page.getByTestId('thinking-toggle').click()
  await shot(page, 'answer-search-final-sources-pill.png')
  await page.getByTestId('search-results').click()
  await expect(page.getByTestId('search-panel')).toBeVisible()
  await shot(page, 'answer-search-sources-panel.png')
  await page.getByTestId('search-panel').getByRole('button', { name: '关闭' }).click()

  await page.getByTestId('new-chat').click()
  await pinGreeting(page)
  await expect(page.getByTestId('toggle-thinking')).toHaveClass(/on/)
  await expect(page.getByTestId('toggle-search')).toHaveClass(/on/)
  const idle = page.locator('.chat-link').filter({ hasText: '快排介绍' })
  await expect(idle).not.toHaveClass(/active/)
  await idle.hover()
  await idle.locator('.more').click()
  await expect(page.getByRole('menuitem', { name: '重命名' })).toBeVisible()
  await shot(page, 'sidebar-item-menu.png')
})
