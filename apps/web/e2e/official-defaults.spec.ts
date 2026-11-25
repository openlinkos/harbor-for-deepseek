// Every fresh-load composer default must be backed by an official capture, not only a bundle fallback.
// 昊辰 11/26 00:30: official 深度思考 and 智能搜索 are on by default; we had recorded off from the bundle.
import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

type Capture = { file: string; sha256: string; theme: 'light' | 'dark'; x: number; y: number; on: [number, number, number]; off: [number, number, number] }
type Control = { role: 'button'; name: string; color: string }
type Entry = { id: string; prefKey: string | null; spec: string[]; testIds: string[]; control?: Control; official: boolean | null; noOfficial?: string; captures: Capture[] }

const HERE = dirname(fileURLToPath(import.meta.url))
const root = join(HERE, '..', '..', '..')
const registry = JSON.parse(readFileSync(join(HERE, 'fixtures', 'official-defaults.json'), 'utf8')) as { entries: Entry[] }

// Minimal PNG reader: 8-bit RGB or RGBA, non-interlaced (what the parity captures use).
const pixel = (file: string, x: number, y: number): [number, number, number] => {
  const buf = readFileSync(file)
  const width = buf.readUInt32BE(16)
  const depth = buf[24]
  const color = buf[25]
  const interlace = buf[28]
  if (depth !== 8 || (color !== 2 && color !== 6) || interlace !== 0) throw new Error(`unsupported png ${file}`)
  const bpp = color === 6 ? 4 : 3
  const chunks: Buffer[] = []
  for (let at = 8; at < buf.length; ) {
    const size = buf.readUInt32BE(at)
    const type = buf.toString('ascii', at + 4, at + 8)
    if (type === 'IDAT') chunks.push(buf.subarray(at + 8, at + 8 + size))
    at += 12 + size
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const stride = width * bpp
  let prev = Buffer.alloc(stride)
  for (let row = 0; row <= y; row++) {
    const filter = raw[row * (stride + 1)]
    const line = Buffer.from(raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)))
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let add = 0
      if (filter === 1) add = a
      else if (filter === 2) add = b
      else if (filter === 3) add = (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[i] = (line[i] + add) & 255
    }
    prev = line
  }
  return [prev[x * bpp], prev[x * bpp + 1], prev[x * bpp + 2]]
}

const near = (a: number[], b: number[]) => a.every((value, i) => Math.abs(value - b[i]) <= 3)

test('every defaultPrefs key has an official-defaults entry', () => {
  const store = readFileSync(join(root, 'apps/web/src/store.ts'), 'utf8')
  const body = store.match(/const defaultPrefs = \(\): Prefs => \(\{([\s\S]*?)\}\)/)?.[1]
  expect(body, 'defaultPrefs literal not found in store.ts').toBeTruthy()
  const keys = [...(body ?? '').matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort()
  expect(keys.length).toBeGreaterThan(0)
  expect(registry.entries.flatMap((entry) => (entry.prefKey ? [entry.prefKey] : [])).sort()).toEqual(keys)
  for (const entry of registry.entries) {
    if (entry.official === null) expect(entry.noOfficial, `${entry.id} needs a reason when there is no official default`).toBeTruthy()
    else expect(entry.captures.length, `${entry.id} needs at least one official capture`).toBeGreaterThan(0)
  }
})

for (const entry of registry.entries.filter((item) => item.official !== null)) {
  test(`${entry.id}: recorded default matches every official capture`, () => {
    for (const capture of entry.captures) {
      const file = join(root, capture.file)
      expect(createHash('sha256').update(readFileSync(file)).digest('hex'), `${capture.file} changed`).toBe(capture.sha256)
      const rgb = pixel(file, capture.x, capture.y)
      const isOn = near(rgb, capture.on)
      const isOff = near(rgb, capture.off)
      expect(isOn !== isOff, `${entry.id} ${capture.theme} ${capture.file}@${capture.x},${capture.y} rgb(${rgb.join(', ')}) matches neither or both of on/off`).toBe(true)
      expect(isOn, `${entry.id} ${capture.theme} ${capture.file}@${capture.x},${capture.y} shows ${isOn ? 'on' : 'off'}, registry says ${entry.official ? 'on' : 'off'}`).toBe(entry.official)
    }
  })

  test(`${entry.id}: fresh load renders the official default`, async ({ page }) => {
    await page.route('https://api.deepseek.com/**', (route) => route.fulfill({ status: 404, json: {} }))
    await page.goto('/')
    const landing = entry.testIds.find((id) => id.startsWith('landing-'))
    if (landing) await expect(page.getByTestId(landing)).toHaveAttribute('aria-pressed', String(entry.official))
    await page.getByTestId('landing-send').click()
    await page.getByTestId('key-input').fill('demo-local-key')
    await page.getByTestId('key-save').click()
    await expect(page.getByTestId('composer')).toBeVisible()
    for (const id of entry.testIds.filter((item) => !item.startsWith('landing-'))) {
      await expect(page.getByTestId(id)).toHaveAttribute('aria-pressed', String(entry.official))
    }
    if (entry.control) {
      // Enabled means: not disabled, the official enabled colour, and a real click reaches the action.
      const control = page.locator('.tool-right').getByRole(entry.control.role, { name: entry.control.name, exact: true })
      await page.mouse.move(0, 0)
      if (entry.official) {
        await expect(control).toBeEnabled()
        await expect(control).not.toHaveAttribute('aria-disabled', 'true')
        await expect(control).toHaveCSS('color', entry.control.color)
        const chooser = page.waitForEvent('filechooser', { timeout: 5_000 })
        await control.click()
        await chooser
      } else {
        await expect(control).toBeDisabled()
      }
    }
  })
}

export type { Page }
