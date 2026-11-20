/** Rasterize a filled SVG path glyph and report the ink box inside a CSS-pixel slot. */

type Pt = [number, number]

const TOKEN = /[MmLlHhVvCcZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g

const isCmd = (token: string) => /[A-Za-z]/.test(token)

const flatten = (out: Pt[], x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, depth = 0) => {
  const dx = x3 - x0
  const dy = y3 - y0
  const len = Math.hypot(dx, dy) || 1
  const d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / len
  const d2 = Math.abs((x2 - x0) * dy - (y2 - y0) * dx) / len
  if ((d1 < 0.15 && d2 < 0.15) || depth > 10) {
    out.push([x3, y3])
    return
  }
  const x01 = (x0 + x1) / 2
  const y01 = (y0 + y1) / 2
  const x12 = (x1 + x2) / 2
  const y12 = (y1 + y2) / 2
  const x23 = (x2 + x3) / 2
  const y23 = (y2 + y3) / 2
  const x012 = (x01 + x12) / 2
  const y012 = (y01 + y12) / 2
  const x123 = (x12 + x23) / 2
  const y123 = (y12 + y23) / 2
  const x0123 = (x012 + x123) / 2
  const y0123 = (y012 + y123) / 2
  flatten(out, x0, y0, x01, y01, x012, y012, x0123, y0123, depth + 1)
  flatten(out, x0123, y0123, x123, y123, x23, y23, x3, y3, depth + 1)
}

const subpaths = (d: string): Pt[][] => {
  const tokens = d.match(TOKEN) ?? []
  let i = 0
  const num = () => Number(tokens[i++])
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  const paths: Pt[][] = []
  let cur: Pt[] | null = null
  const lineTo = (x: number, y: number) => {
    cur?.push([x, y])
    cx = x
    cy = y
  }
  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (!cmd) break
    if (cmd === 'M') {
      const x = num()
      const y = num()
      cur = [[x, y]]
      paths.push(cur)
      cx = sx = x
      cy = sy = y
      while (i < tokens.length && tokens[i] && !isCmd(tokens[i])) lineTo(num(), num())
    } else if (cmd === 'L') {
      while (i < tokens.length && tokens[i] && !isCmd(tokens[i])) lineTo(num(), num())
    } else if (cmd === 'H') {
      while (i < tokens.length && tokens[i] && !isCmd(tokens[i])) lineTo(num(), cy)
    } else if (cmd === 'V') {
      while (i < tokens.length && tokens[i] && !isCmd(tokens[i])) lineTo(cx, num())
    } else if (cmd === 'C') {
      while (i < tokens.length && tokens[i] && !isCmd(tokens[i])) {
        const x1 = num()
        const y1 = num()
        const x2 = num()
        const y2 = num()
        const x = num()
        const y = num()
        if (cur) flatten(cur, cx, cy, x1, y1, x2, y2, x, y)
        cx = x
        cy = y
      }
    } else if (cmd === 'Z' || cmd === 'z') {
      if (cur && (cur[0][0] !== cx || cur[0][1] !== cy)) cur.push([sx, sy])
      cx = sx
      cy = sy
    } else {
      throw new Error(`unsupported path command ${cmd}`)
    }
  }
  return paths
}

const hit = (x: number, y: number, subs: Pt[][], evenodd: boolean) => {
  let wind = 0
  for (const sub of subs) {
    for (let i = 0; i < sub.length - 1; i += 1) {
      const [x0, y0] = sub[i]
      const [x1, y1] = sub[i + 1]
      if (y0 === y1) continue
      const up = y1 > y0
      if ((up && y >= y0 && y < y1) || (!up && y >= y1 && y < y0)) {
        const t = (y - y0) / (y1 - y0)
        if (x < x0 + t * (x1 - x0)) wind += up ? 1 : -1
      }
    }
  }
  return evenodd ? (wind & 1) !== 0 : wind !== 0
}

export type InkBox = { w: number; h: number; coverage: number }

/** A CSS pixel counts when any of four subsamples sits in the fill. Coverage is ink ÷ ink-box area. */
export const measureInk = (paths: readonly string[], viewBox: string, size: number, fill: 'evenodd' | 'nonzero' = 'nonzero'): InkBox => {
  const [minX, minY, vbW, vbH] = viewBox.split(/[\s,]+/).map(Number)
  const prepared = paths.map((d) => subpaths(d))
  const evenodd = fill === 'evenodd'
  const samples = [0.25, 0.75]
  let minPx = size
  let minPy = size
  let maxPx = -1
  let maxPy = -1
  let count = 0
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let on = false
      for (const sy of samples) {
        for (const sx of samples) {
          const x = minX + ((px + sx) / size) * vbW
          const y = minY + ((py + sy) / size) * vbH
          if (prepared.some((subs) => hit(x, y, subs, evenodd))) on = true
        }
      }
      if (!on) continue
      count += 1
      if (px < minPx) minPx = px
      if (py < minPy) minPy = py
      if (px > maxPx) maxPx = px
      if (py > maxPy) maxPy = py
    }
  }
  const w = count ? maxPx - minPx + 1 : 0
  const h = count ? maxPy - minPy + 1 : 0
  return { w, h, coverage: w && h ? count / (w * h) : 0 }
}
