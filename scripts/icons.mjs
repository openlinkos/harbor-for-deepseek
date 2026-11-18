import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/public/icons')
mkdirSync(out, { recursive: true })

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c
}
const crc = (bytes) => {
  let c = 0xffffffff
  for (const byte of bytes) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  }
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

const png = (size) => {
  const pixels = Buffer.alloc(size * size * 4)
  const set = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return
    }
    const i = (y * size + x) * 4
    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = b
    pixels[i + 3] = 255
  }
  const fill = (x0, y0, x1, y1, color) => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        set(x, y, color[0], color[1], color[2])
      }
    }
  }
  const circle = (cx, cy, radius, color) => {
    const r2 = radius * radius
    for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= r2) {
          set(x, y, color[0], color[1], color[2])
        }
      }
    }
  }
  const s = size / 64
  fill(0, 0, size, size, [243, 239, 230])
  fill(0, Math.round(46 * s), size, size, [31, 106, 100])
  fill(Math.round(10 * s), Math.round(40 * s), Math.round(38 * s), Math.round(45 * s), [20, 34, 38])
  fill(Math.round(34 * s), Math.round(22 * s), Math.round(40 * s), Math.round(44 * s), [20, 34, 38])
  circle(37 * s, 17 * s, 4.2 * s, [224, 138, 60])
  fill(Math.round(42 * s), Math.round(16 * s), Math.round(54 * s), Math.round(18.4 * s), [224, 138, 60])
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync(join(out, 'icon-192.png'), png(192))
writeFileSync(join(out, 'icon-512.png'), png(512))
console.log('wrote harbor icons')
