import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../..')
const BUNDLE = join(ROOT, 'apps/server/e2e/.live-harbor.mjs')

const titleOf = (page: Page) => page.locator('[data-testid=thinking-toggle]').first()
const secondsOf = async (page: Page) => {
  const text = await titleOf(page).innerText()
  const match = text.match(/用时\s*(\d+)\s*秒/)
  return match ? Number(match[1]) : null
}

test.describe('server live clock', () => {
  test.skip(!process.env.DATABASE_URL, 'needs the CI postgres')
  let child: ChildProcess | undefined
  let base = ''

  test.beforeAll(async () => {
    await rm(BUNDLE, { force: true })
    const build = spawn('pnpm', ['--filter', '@deepapi/server', 'exec', 'esbuild', 'e2e/live-harbor.ts', '--bundle', '--platform=node', '--format=esm', `--outfile=${BUNDLE}`], {
      cwd: ROOT,
      stdio: 'inherit',
    })
    const built = await once(build, 'exit')
    if (built[0] !== 0) throw new Error('live harbor bundle failed')
    child = spawn(process.execPath, [BUNDLE], {
      cwd: join(ROOT, 'apps/server'),
      env: { ...process.env, STATIC_DIR: join(ROOT, 'apps/web/dist') },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const ready = new Promise<number>((resolve, reject) => {
      let buffer = ''
      const timer = setTimeout(() => reject(new Error(`harbor did not start: ${buffer}`)), 20000)
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8')
        const match = buffer.match(/READY (\d+)/)
        if (match) {
          clearTimeout(timer)
          resolve(Number(match[1]))
        }
      }
      child?.stdout?.on('data', onData)
      child?.stderr?.on('data', onData)
      child?.once('exit', (code) => {
        clearTimeout(timer)
        reject(new Error(`harbor exited ${code}: ${buffer}`))
      })
    })
    base = `http://127.0.0.1:${await ready}`
  })

  test.afterAll(async () => {
    child?.kill('SIGTERM')
    await rm(BUNDLE, { force: true })
  })

  const boot = async (page: Page) => {
    const setup = await page.request.post(`${base}/api/setup/admin`, { data: { username: 'ada', password: 'correct-horse' } })
    if (setup.ok()) {
      const created = (await setup.json()) as { csrf: string }
      const key = await page.request.post(`${base}/api/admin/keys`, {
        data: { secret: 'live-key', accountGroup: 'live' },
        headers: { 'content-type': 'application/json', 'x-harbor-csrf': created.csrf },
      })
      expect(key.ok()).toBeTruthy()
    } else {
      const login = await page.request.post(`${base}/api/auth/login`, { data: { username: 'ada', password: 'correct-horse' } })
      expect(login.ok()).toBeTruthy()
    }
    await page.goto(base)
    await expect(page.getByTestId('composer')).toBeVisible()
  }

  test('thinking seconds do not jump after a refresh during thinking', async ({ page }) => {
    await boot(page)
    await page.getByTestId('composer').fill('慢思考')
    await page.getByTestId('send').click()
    await expect(titleOf(page)).toHaveText(/正在思考/)
    await page.waitForTimeout(1500)
    await page.reload()
    await expect(titleOf(page)).toHaveText(/正在思考/)
    await expect(titleOf(page)).not.toHaveText(/用时/)
    await expect(page.locator('.turn.assistant')).toContainText('想完了')
    const first = await secondsOf(page)
    expect(first).toBeGreaterThanOrEqual(3)
    expect(first).toBeLessThanOrEqual(5)
    await page.waitForTimeout(800)
    expect(await secondsOf(page)).toBe(first)
  })

  test('stopping keeps the text and continuation stays on that message', async ({ page }) => {
    await boot(page)
    await page.getByTestId('new-chat').click()
    await page.getByTestId('composer').fill('分段')
    await page.getByTestId('send').click()
    const reply = page.locator('.turn.assistant').last()
    await expect(reply).toContainText('原文甲')
    const before = await secondsOf(page)
    await page.getByTestId('stop').click()
    await expect(page.getByTestId('continue')).toBeVisible()
    await expect(reply).toContainText('原文甲')
    await page.getByTestId('continue').click()
    await expect(reply).toContainText('续写乙')
    await expect(page.getByTestId('message-assistant')).toHaveCount(1)
    await expect(page.locator('.turn.user')).toHaveCount(1)
    if (before !== null) expect(await secondsOf(page)).toBe(before)
  })

  const storedAssistant = async (page: Page, needle: string) =>
    page.evaluate(async (needle) => {
      const list = (await fetch('/api/conversations', { credentials: 'include' }).then((response) => response.json())) as {
        conversations?: Array<{ id: string }>
      }
      for (const conversation of list.conversations ?? []) {
        const data = (await fetch(`/api/conversations/${conversation.id}/messages`, { credentials: 'include' }).then((response) => response.json())) as {
          messages?: Array<{ role: string; status: string; errorMessage?: string | null; blocks: Array<{ type: string; text?: string }> }>
        }
        const assistant = (data.messages ?? []).find((item) => item.role === 'assistant' && JSON.stringify(item.blocks).includes(needle))
        if (!assistant) continue
        return {
          status: assistant.status,
          errorMessage: assistant.errorMessage ?? null,
          types: assistant.blocks.map((block) => block.type),
          text: assistant.blocks.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n'),
        }
      }
      return null
    }, needle)

  test('thinking seconds stay frozen while the answer keeps streaming', async ({ page }) => {
    test.setTimeout(90_000)
    await boot(page)
    await page.getByTestId('new-chat').click()
    await page.getByTestId('composer').fill('接回用时')
    await page.getByTestId('send').click()
    await expect(titleOf(page)).toHaveText(/正在思考/)
    let duringThinking = 0
    for (let i = 0; i < 4; i += 1) {
      const title = await titleOf(page).innerText().catch(() => '')
      if (/用时/.test(title)) break
      await page.reload()
      await expect(page.getByTestId('composer')).toBeVisible()
      await expect(titleOf(page)).toBeVisible()
      const next = await titleOf(page).innerText()
      if (/正在思考/.test(next) && !/用时/.test(next)) duringThinking += 1
      if (/用时/.test(next)) break
    }
    expect(duringThinking).toBeGreaterThanOrEqual(2)
    const seen = new Set<number>()
    const note = async () => {
      const seconds = await secondsOf(page)
      if (seconds !== null) seen.add(seconds)
    }
    await expect.poll(async () => {
      await note()
      return (await titleOf(page).innerText()).includes('用时')
    }, { timeout: 20_000 }).toBe(true)
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      await note()
      const body = await page.locator('.turn.assistant').innerText()
      const streaming = (await page.getByTestId('stop').count()) > 0
      if (body.includes('正文完') && !streaming) break
      await page.waitForTimeout(350)
    }
    await expect(page.locator('.turn.assistant')).toContainText('正文完')
    await expect(page.getByTestId('stop')).toHaveCount(0)
    await note()
    await page.reload()
    await expect(page.locator('.turn.assistant')).toContainText('正文完')
    await expect(titleOf(page)).toContainText('用时')
    await note()
    expect(seen.size).toBe(1)
  })

  test('continuation keeps stored search blocks and source pills', async ({ page }) => {
    await boot(page)
    await page.getByTestId('new-chat').click()
    await page.getByTestId('composer').fill('搜索续写')
    await page.getByTestId('send').click()
    const reply = page.locator('.turn.assistant').last()
    await expect(reply).toContainText('原文甲')
    await expect(reply.getByTestId('search-results')).toBeVisible()
    await expect(reply.locator('.found-line')).toContainText('搜索到 1 个网页')
    await page.getByTestId('stop').click()
    await expect(page.getByTestId('continue')).toBeVisible()
    await page.getByTestId('continue').click()
    await expect(reply).toContainText('续写乙')
    await expect(page.getByTestId('message-assistant')).toHaveCount(1)
    await expect(reply.getByTestId('search-results')).toBeVisible()
    await expect(reply.locator('.found-line')).toContainText('搜索到 1 个网页')
    await expect(reply.locator('.prose')).not.toContainText('https://weather.example/a')
    await expect.poll(async () => (await storedAssistant(page, '续写乙'))?.types.slice(0, 4).join(',') ?? '').toBe('thinking,server_tool_use,web_search_tool_result,text')
    const stored = await storedAssistant(page, '续写乙')
    expect(stored?.text).toContain('原文甲')
    expect(stored?.text).toContain('续写乙')
    expect(stored?.text).not.toContain('https://weather.example/a')
    expect(stored?.text).not.toContain('天气来源')
    await page.reload()
    await expect(page.locator('.turn.assistant')).toContainText('原文甲')
    await expect(page.locator('.turn.assistant')).toContainText('续写乙')
    await expect(page.getByTestId('search-results')).toBeVisible()
    await expect(page.locator('.found-line')).toContainText('搜索到 1 个网页')
    await expect(page.locator('.prose')).not.toContainText('https://weather.example/a')
    await expect(page.getByTestId('message-assistant')).toHaveCount(1)
  })

  test('a rejected web continuation regenerates and keeps the stopped original', async ({ page }) => {
    test.setTimeout(90_000)
    await boot(page)
    await page.getByTestId('new-chat').click()
    await page.getByTestId('composer').fill('仍要400')
    await page.getByTestId('send').click()
    const reply = page.locator('.turn.assistant').last()
    await expect(reply).toContainText('原文甲')
    await expect(reply.getByTestId('search-results')).toBeVisible()
    await page.getByTestId('stop').click()
    await expect(page.getByTestId('continue')).toBeVisible()
    await page.getByTestId('continue').click()
    await expect(page.getByTestId('versions')).toContainText('2 / 2')
    await expect(page.locator('.turn.assistant').last()).toContainText('重新生成')
    const backToOriginal = async () => {
      await page.getByTestId('versions').locator('button').first().click()
      await expect(page.getByTestId('versions')).toContainText('1 / 2')
      await expect(page.locator('.turn.assistant').last()).toContainText('已停止')
      await expect(page.getByTestId('continue')).toBeVisible()
      await expect(page.getByTestId('search-results')).toBeVisible()
      await expect(page.locator('.found-line')).toContainText('搜索到 1 个网页')
      await expect(page.getByTestId('retry')).toHaveCount(0)
      await expect(page.locator('.prose')).toContainText('原文甲')
      await expect(page.locator('.prose')).not.toContainText('https://weather.example/a')
      await expect(page.locator('.prose')).not.toContainText('重新生成')
    }
    await backToOriginal()
    const stored = await storedAssistant(page, '原文甲')
    expect(stored?.status).toBe('aborted')
    expect(stored?.errorMessage).toBeNull()
    expect(stored?.types).toEqual(['thinking', 'server_tool_use', 'web_search_tool_result', 'text'])
    expect(stored?.text).toContain('原文甲')
    expect(stored?.text).not.toContain('https://weather.example/a')
    expect(stored?.text).not.toContain('续写乙')
    await page.getByTestId('versions').locator('button').nth(1).click()
    await expect(page.getByTestId('versions')).toContainText('2 / 2')
    await page.reload()
    await expect(page.getByTestId('versions')).toContainText('2 / 2')
    await expect(page.locator('.turn.assistant').last()).toContainText('重新生成')
    await backToOriginal()
  })
})
