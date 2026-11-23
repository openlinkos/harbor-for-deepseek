import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { join } from 'node:path'

const shots = '/opt/cursor/artifacts/theme-cards'
mkdirSync(shots, { recursive: true })

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
  await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
}

const unlock = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openSettings = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    const open = await page.locator('.shell').evaluate((node) => node.classList.contains('nav-open'))
    if (!open) {
      await page.getByTestId('menu').click()
      await expect(page.locator('.sidebar')).toBeVisible()
    }
  }
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await page.getByRole('button', { name: '通用设置' }).click()
  await page.locator('.theme-cards').scrollIntoViewIfNeeded()
}

type Rgba = { width: number; height: number; data: Buffer }

const paeth = (left: number, up: number, upLeft: number) => {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const diagonal = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left
  if (upDistance <= diagonal) return up
  return upLeft
}

const decodePng = (png: Buffer): Rgba => {
  if (png.toString('ascii', 1, 4) !== 'PNG') throw new Error('screenshot is not a png')
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const channels = png[25] === 6 ? 4 : png[25] === 2 ? 3 : 0
  if (png[24] !== 8 || channels === 0) throw new Error(`unsupported png ${png[24]}/${png[25]}`)
  const parts: Buffer[] = []
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') parts.push(png.subarray(offset + 8, offset + 8 + length))
    if (type === 'IEND') break
    offset += 12 + length
  }
  const inflated = inflateSync(Buffer.concat(parts))
  const stride = width * channels
  const raw = Buffer.alloc(height * stride)
  let source = 0
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source]
    source += 1
    const row = y * stride
    for (let x = 0; x < stride; x += 1) {
      const byte = inflated[source]
      source += 1
      const left = x >= channels ? raw[row + x - channels] : 0
      const up = y > 0 ? raw[row - stride + x] : 0
      const upLeft = y > 0 && x >= channels ? raw[row - stride + x - channels] : 0
      let value = byte
      if (filter === 1) value = (byte + left) & 255
      else if (filter === 2) value = (byte + up) & 255
      else if (filter === 3) value = (byte + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) value = (byte + paeth(left, up, upLeft)) & 255
      else if (filter !== 0) throw new Error(`png filter ${filter}`)
      raw[row + x] = value
    }
  }
  const data = Buffer.alloc(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const input = pixel * channels
    const output = pixel * 4
    data[output] = raw[input]
    data[output + 1] = raw[input + 1]
    data[output + 2] = raw[input + 2]
    data[output + 3] = channels === 4 ? raw[input + 3] : 255
  }
  return { width, height, data }
}

const inkRatio = (png: Buffer) => {
  const image = decodePng(png)
  const { width, height, data } = image
  const inset = Math.max(1, Math.round(Math.min(width, height) * 0.08))
  const corners = [
    [inset, inset],
    [width - 1 - inset, inset],
    [inset, height - 1 - inset],
    [width - 1 - inset, height - 1 - inset],
  ]
  const background = corners
    .map(([x, y]) => {
      const index = (y * width + x) * 4
      return [data[index], data[index + 1], data[index + 2]]
    })
    .reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0])
    .map((channel) => channel / corners.length)
  let ink = 0
  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.abs(data[index] - background[0]) + Math.abs(data[index + 1] - background[1]) + Math.abs(data[index + 2] - background[2])
    if (distance > 36) ink += 1
  }
  return ink / (width * height)
}

const hit = async (card: Locator) => card.evaluate((node) => {
  const box = node.getBoundingClientRect()
  const label = node.querySelector('.theme-label')
  const labelBox = label?.getBoundingClientRect()
  const probe = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y)
    const className = target instanceof Element ? String(target.className) : ''
    return {
      x,
      y,
      tag: target?.tagName ?? '',
      className,
      face: target instanceof Element && target.classList.contains('theme-face'),
      inside: target instanceof Node && node.contains(target),
    }
  }
  const text = labelBox
    ? probe(labelBox.left + labelBox.width / 2, labelBox.top + labelBox.height / 2)
    : probe(box.left + box.width / 2, box.top + box.height / 2)
  return {
    center: probe(box.left + box.width / 2, box.top + box.height / 2),
    text,
  }
})

const borderOf = async (card: Locator) => card.evaluate((node) => {
  const style = getComputedStyle(node)
  return {
    width: style.borderTopWidth,
    style: style.borderTopStyle,
    color: style.borderTopColor,
    background: style.backgroundColor,
  }
})

test('selected theme cards keep their ink, hit their own content, and show the 1px border', async ({ page }) => {
  test.setTimeout(90_000)
  await unlock(page)
  const viewports = [
    { width: 1440, height: 900, name: '1440' },
    { width: 390, height: 844, name: '390' },
  ]
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const theme of ['浅色', '深色'] as const) {
      await openSettings(page)
      const card = page.locator('.theme-cards button.chip', { hasText: theme })
      await card.click()
      await expect(card).toHaveClass(/on/)
      if (theme === '浅色') await expect(page.locator('body')).not.toHaveAttribute('data-ds-dark-theme')
      else await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', '')
      await card.scrollIntoViewIfNeeded()
      const where = `${viewport.name} ${theme}`
      const fill = theme === '浅色' ? 'rgb(241, 243, 245)' : 'rgb(67, 69, 74)'
      // SP-SET-800 light rgba(0, 0, 0, 0.1). SP-SET-801 dark rgba(255, 255, 255, 0.12).
      const border = theme === '浅色' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.12)'
      await expect(card, where).toHaveCSS('border-top-width', '1px')
      await expect(card, where).toHaveCSS('border-top-style', 'solid')
      await expect(card, where).toHaveCSS('border-top-color', border)
      await expect(card, where).toHaveCSS('background-color', fill)
      const pointer = await hit(card)
      expect(pointer.center.face, `${where} center ${pointer.center.className}`).toBe(false)
      expect(pointer.center.inside, `${where} center hit ${pointer.center.tag}.${pointer.center.className}`).toBe(true)
      expect(pointer.text.face, `${where} text ${pointer.text.className}`).toBe(false)
      expect(pointer.text.inside, `${where} text hit ${pointer.text.tag}.${pointer.text.className}`).toBe(true)
      expect(pointer.text.className, where).toContain('theme-label')
      const iconInk = inkRatio(await card.locator('svg').screenshot())
      const textInk = inkRatio(await card.locator('.theme-label').screenshot())
      expect(iconInk, `${where} icon ink ${iconInk}`).toBeGreaterThan(0.1)
      expect(textInk, `${where} text ink ${textInk}`).toBeGreaterThan(0.1)
      const idle = page.locator('.theme-cards button.chip:not(.on)').first()
      const idleBorder = await borderOf(idle)
      expect(idleBorder.width, `${where} idle`).toBe('1px')
      expect(idleBorder.style, `${where} idle`).toBe('solid')
      const shot = await page.locator('.theme-cards').screenshot()
      const file = join(shots, `theme-cards-${theme === '浅色' ? 'light' : 'dark'}-${viewport.name}.png`)
      writeFileSync(file, shot)
      await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
      await expect(page.getByTestId('settings-dialog')).toBeHidden()
    }
  }
})
