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
})
