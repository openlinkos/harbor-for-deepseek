import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const INK = [15, 23, 42]
const ACCENT = [37, 99, 235]
const INK_DARK = [226, 232, 240]
const ACCENT_DARK = [107, 155, 255]
const TILE = [15, 23, 42]

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}
const crc = (bytes) => {
  let c = 0xffffffff
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc(body), 8 + data.length)
  return out
}
const png = (size, pixels, colorType = 6) => {
  const channels = colorType === 2 ? 3 : 4
  const raw = Buffer.alloc(size * (size * channels + 1))
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * channels + 1)
    raw[row] = 0
    if (channels === 4) {
      pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4)
    } else {
      for (let x = 0; x < size; x += 1) {
        const s = (y * size + x) * 4
        const d = row + 1 + x * 3
        raw[d] = pixels[s]
        raw[d + 1] = pixels[s + 1]
        raw[d + 2] = pixels[s + 2]
      }
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = colorType
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const ico = (images) => {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const dir = Buffer.alloc(16 * images.length)
  let offset = 6 + dir.length
  const parts = [header, dir]
  images.forEach((image, index) => {
    const at = index * 16
    dir[at] = image.size >= 256 ? 0 : image.size
    dir[at + 1] = image.size >= 256 ? 0 : image.size
    dir.writeUInt16LE(1, at + 4)
    dir.writeUInt16LE(32, at + 6)
    dir.writeUInt32LE(image.png.length, at + 8)
    dir.writeUInt32LE(offset, at + 12)
    offset += image.png.length
    parts.push(image.png)
  })
  return Buffer.concat(parts)
}

const distSeg = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2))
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
}

const flattenQuad = (p0, p1, p2, steps = 14) => {
  const points = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const u = 1 - t
    points.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ])
  }
  return points
}

const hull = [
  [18, 18],
  [28, 28],
  [40, 28],
  ...flattenQuad([40, 28], [34, 40], [24, 40]).slice(1),
  ...flattenQuad([24, 40], [8, 40], [8, 30]).slice(1),
  [12, 30],
]
const wave = flattenQuad([6, 44], [24, 40], [42, 44])

const insidePoly = (x, y, points) => {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const cover = (px, py, stroke) => {
  if (insidePoly(px, py, hull)) return 'ink'
  let nearest = Infinity
  for (let i = 0; i < wave.length - 1; i += 1) {
    nearest = Math.min(nearest, distSeg(px, py, wave[i][0], wave[i][1], wave[i + 1][0], wave[i + 1][1]))
  }
  if (nearest <= stroke / 2) return 'accent'
  return null
}

const render = (size, options) => {
  const ss = size > 256 ? 2 : 4
  const S = size * ss
  const src = Buffer.alloc(S * S * 4)
  const stroke = options.small ? 5.5 : 4
  const ox = options.ox ?? 0
  const oy = options.oy ?? 0
  const scale = options.scale ?? 1
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const gx = ((x + 0.5) * 48) / S
      const gy = ((y + 0.5) * 48) / S
      let color = null
      if (options.tile) {
        const rx = options.bleed ? 0 : 10.5
        const inside = rx === 0 || insideRound(gx, gy, 0, 0, 48, 48, rx)
        if (inside) color = TILE
      }
      const lx = (gx - ox) / scale
      const ly = (gy - oy) / scale
      if (lx >= -2 && ly >= -2 && lx <= 50 && ly <= 50) {
        const hit = cover(lx, ly, stroke)
        if (hit === 'ink') color = options.ink
        if (hit === 'accent') color = options.accent
      }
      if (!color) continue
      const i = (y * S + x) * 4
      src[i] = color[0]
      src[i + 1] = color[1]
      src[i + 2] = color[2]
      src[i + 3] = 255
    }
  }
  if (options.circle) {
    const cx = S / 2
    const cy = S / 2
    const r = S / 2
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) src[(y * S + x) * 4 + 3] = 0
      }
    }
  }
  const out = Buffer.alloc(size * size * 4)
  const n = ss * ss
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const i = ((y * ss + sy) * S + (x * ss + sx)) * 4
          const pa = src[i + 3]
          r += src[i] * pa
          g += src[i + 1] * pa
          b += src[i + 2] * pa
          a += pa
        }
      }
      const o = (y * size + x) * 4
      if (a === 0) continue
      out[o] = Math.round(r / a)
      out[o + 1] = Math.round(g / a)
      out[o + 2] = Math.round(b / a)
      out[o + 3] = Math.round(a / n)
    }
  }
  return out
}

const insideRound = (px, py, x, y, w, h, r) => {
  if (px < x || py < y || px >= x + w || py >= y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

const lightMark = (size, small) => render(size, { ink: INK, accent: ACCENT, small, scale: 1, ox: 0, oy: 0 })
const tile = (size, { bleed = false, circle = false, small = false } = {}) => {
  const scale = 0.7
  const ox = (1 - scale) * 24
  const oy = ox
  return render(size, {
    ink: INK_DARK,
    accent: ACCENT_DARK,
    small,
    scale,
    ox,
    oy,
    tile: true,
    bleed,
    circle,
  })
}

const SAIL = 'M18 18L28 28H40Q34 40 24 40Q8 40 8 30H12Z'
const WAVER = 'M6 44Q24 40 42 44'

const markSvg = (stroke, ink, accent) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="Harbor for DeepSeek">` +
  `<path d="${SAIL}" fill="${ink}"/>` +
  `<path d="${WAVER}" fill="none" stroke="${accent}" stroke-width="${stroke}" stroke-linecap="round"/>` +
  `</svg>\n`

const faviconSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="Harbor for DeepSeek">` +
  `<style>.ink{fill:#0f172a}.accent{fill:none;stroke:#2563eb;stroke-width:5.5;stroke-linecap:round}` +
  `@media (prefers-color-scheme:dark){.ink{fill:#e2e8f0}.accent{stroke:#6b9bff}}</style>` +
  `<path class="ink" d="${SAIL}"/>` +
  `<path class="accent" d="${WAVER}"/>` +
  `</svg>\n`

const write = (path, data) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

const optionSvg = (name, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="${name}">${body}</svg>\n`

write(join(root, 'brand/logo.svg'), markSvg(4, '#0f172a', '#2563eb'))
write(join(root, 'brand/logo-dark.svg'), markSvg(4, '#e2e8f0', '#6b9bff'))
write(join(root, 'brand/options/sail.svg'), optionSvg('Sail', `<path d="${SAIL}" fill="#0f172a"/><path d="${WAVER}" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round"/>`))
write(join(root, 'brand/options/wave.svg'), optionSvg('Wave', `<path d="M6 22Q24 10 42 22L42 32Q24 24 6 32Z" fill="#2563eb"/>`))
write(join(root, 'brand/options/buoy.svg'), optionSvg('Buoy', `<path d="M16 6L22 12L16 18L10 12Z" fill="#0f172a"/><path d="M6 26Q24 18 42 26L42 36Q24 30 6 36Z" fill="#2563eb"/>`))
write(join(root, 'brand/options/lamp.svg'), optionSvg('Lamp', `<path d="M12 26h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V28a2 2 0 0 1 2-2z" fill="#0f172a"/><path d="M24 26L46 12L46 30Z" fill="#2563eb"/>`))
write(join(root, 'apps/web/public/logo.svg'), markSvg(4, '#0f172a', '#2563eb'))
write(join(root, 'apps/web/public/favicon.svg'), faviconSvg)

const publicDir = join(root, 'apps/web/public')
write(join(publicDir, 'favicon-16.png'), png(16, lightMark(16, true)))
write(join(publicDir, 'favicon-32.png'), png(32, lightMark(32, true)))
const png48 = png(48, lightMark(48, false))
write(join(publicDir, 'favicon.ico'), ico([
  { size: 16, png: png(16, lightMark(16, true)) },
  { size: 32, png: png(32, lightMark(32, true)) },
  { size: 48, png: png48 },
]))
write(join(publicDir, 'apple-touch-icon.png'), png(180, tile(180, { bleed: true }), 2))
write(join(publicDir, 'icons/icon-192.png'), png(192, tile(192)))
write(join(publicDir, 'icons/icon-512.png'), png(512, tile(512)))
write(join(publicDir, 'icons/icon-maskable-192.png'), png(192, tile(192, { bleed: true })))
write(join(publicDir, 'icons/icon-maskable-512.png'), png(512, tile(512, { bleed: true })))
write(join(root, 'brand/logo-128.png'), png(128, tile(128)))
write(join(root, 'brand/logo-512.png'), png(512, tile(512)))
write(
  join(root, 'submission/awesome-deepseek-integration/docs/harbor/assets/logo.png'),
  png(512, tile(512)),
)

const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
]
const res = join(root, 'apps/mobile/android/app/src/main/res')
for (const [name, legacy, foreground] of densities) {
  write(join(res, `mipmap-${name}/ic_launcher.png`), png(legacy, tile(legacy)))
  write(join(res, `mipmap-${name}/ic_launcher_round.png`), png(legacy, tile(legacy, { circle: true })))
  write(join(res, `mipmap-${name}/ic_launcher_foreground.png`), png(foreground, tile(foreground, { bleed: true })))
}
write(
  join(root, 'apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'),
  png(1024, tile(1024, { bleed: true }), 2),
)

const splashSizes = [
  ['drawable/splash.png', 480, 320],
  ['drawable-land-mdpi/splash.png', 480, 320],
  ['drawable-land-hdpi/splash.png', 800, 480],
  ['drawable-land-xhdpi/splash.png', 1280, 720],
  ['drawable-land-xxhdpi/splash.png', 1600, 960],
  ['drawable-land-xxxhdpi/splash.png', 1920, 1280],
  ['drawable-port-mdpi/splash.png', 320, 480],
  ['drawable-port-hdpi/splash.png', 480, 800],
  ['drawable-port-xhdpi/splash.png', 720, 1280],
  ['drawable-port-xxhdpi/splash.png', 960, 1600],
  ['drawable-port-xxxhdpi/splash.png', 1280, 1920],
]
const blit = (width, height, mark, background) => {
  const pixels = Buffer.alloc(width * height * 4)
  const row = Buffer.alloc(width * 4)
  for (let x = 0; x < width; x += 1) {
    row[x * 4] = background[0]
    row[x * 4 + 1] = background[1]
    row[x * 4 + 2] = background[2]
    row[x * 4 + 3] = 255
  }
  for (let y = 0; y < height; y += 1) row.copy(pixels, y * width * 4)
  const side = mark.length / 4
  const markSize = Math.sqrt(side)
  const left = Math.round((width - markSize) / 2)
  const top = Math.round((height - markSize) / 2)
  for (let y = 0; y < markSize; y += 1) {
    for (let x = 0; x < markSize; x += 1) {
      const s = (y * markSize + x) * 4
      const a = mark[s + 3] / 255
      if (a === 0) continue
      const d = ((top + y) * width + left + x) * 4
      pixels[d] = Math.round(mark[s] * a + pixels[d] * (1 - a))
      pixels[d + 1] = Math.round(mark[s + 1] * a + pixels[d + 1] * (1 - a))
      pixels[d + 2] = Math.round(mark[s + 2] * a + pixels[d + 2] * (1 - a))
      pixels[d + 3] = 255
    }
  }
  return pixels
}
const splashPng = (width, height) => {
  const markSide = Math.round(Math.min(width, height) * 0.22)
  const mark = lightMark(markSide, markSide <= 32)
  const pixels = blit(width, height, mark, [248, 250, 252])
  const channels = 3
  const raw = Buffer.alloc(height * (width * channels + 1))
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * channels + 1)
    raw[row] = 0
    for (let x = 0; x < width; x += 1) {
      const s = (y * width + x) * 4
      const d = row + 1 + x * 3
      raw[d] = pixels[s]
      raw[d + 1] = pixels[s + 1]
      raw[d + 2] = pixels[s + 2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
for (const [file, width, height] of splashSizes) write(join(res, file), splashPng(width, height))
const iosSplash = splashPng(2732, 2732)
const splashSet = join(root, 'apps/mobile/ios/App/App/Assets.xcassets/Splash.imageset')
write(join(splashSet, 'splash-2732x2732.png'), iosSplash)
write(join(splashSet, 'splash-2732x2732-1.png'), iosSplash)
write(join(splashSet, 'splash-2732x2732-2.png'), iosSplash)

const fit = 108 / 48 * 0.7
const pad = (108 - 48 * fit) / 2
const vx = (n) => (pad + n * fit).toFixed(2)
const vector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#E2E8F0"
        android:pathData="M${vx(18)},${vx(18)}L${vx(28)},${vx(28)}L${vx(40)},${vx(28)}Q${vx(34)},${vx(40)} ${vx(24)},${vx(40)}Q${vx(8)},${vx(40)} ${vx(8)},${vx(30)}L${vx(12)},${vx(30)}Z"/>
    <path
        android:fillColor="#00000000"
        android:pathData="M${vx(6)},${vx(44)}Q${vx(24)},${vx(40)} ${vx(42)},${vx(44)}"
        android:strokeColor="#6B9BFF"
        android:strokeLineCap="round"
        android:strokeWidth="${(4 * fit).toFixed(2)}"/>
</vector>
`
write(join(res, 'drawable/ic_launcher_foreground.xml'), vector)
write(join(res, 'drawable-v24/ic_launcher_foreground.xml'), vector)
write(join(res, 'drawable/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="#0F172A" android:pathData="M0,0h108v108h-108z"/>
</vector>
`)

console.log('wrote harbor icons')
