// fb1344 in-page measurement library (shared by official-render.mjs and probe-ours.mjs and the e2e spec).
// Injected as a string; defines window.__m. No app-specific selectors in here.
(() => {
  const r1 = (v) => Math.round(v * 10) / 10
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r1(r.x), y: r1(r.y), w: r1(r.width), h: r1(r.height) } }
  const visible = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 0.5 || r.height < 0.5) return false; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false } return true }
  const union = (rs) => { rs = rs.filter((r) => r && r.width > 0 && r.height > 0); if (!rs.length) return null; const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top)), R = Math.max(...rs.map((r) => r.right)), B = Math.max(...rs.map((r) => r.bottom)); return { x: r1(x), y: r1(y), w: r1(R - x), h: r1(B - y) } }
  // decoration layers that are not content (official ds-button__background/__border, focus rings, our tooltips)
  const isDecor = (el) => { const c = typeof el.className === 'string' ? el.className : (el.className?.baseVal || ''); if (/ds-button__(background|border)|ds-focus-ring|timeline-(line|dot)|tooltip/.test(c)) return true; const cs = getComputedStyle(el); return cs.position === 'absolute' && !el.querySelector('svg,img') && !el.textContent.trim() }
  // glyph rects of visible text nodes inside el
  const textRects = (el) => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.textContent.trim() ? 1 : 3 }); let n; while ((n = w.nextNode())) { if (!visible(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) out.push(r) } return out }
  const text = (el) => union(textRects(el))
  // content = glyphs + svg/img boxes (what the eye sees), excluding decoration layers
  const content = (el) => { const rs = textRects(el); for (const g of el.querySelectorAll('svg,img')) { if (!visible(g)) continue; let d = false; for (let e = g; e && e !== el; e = e.parentElement) if (isDecor(e)) d = true; if (!d) rs.push(g.getBoundingClientRect()) }
    // painted leaf boxes (favicon dots, letter avatars drawn with background) also count as content
    for (const e of el.querySelectorAll('*')) { if (!visible(e) || isDecor(e)) continue; const r = e.getBoundingClientRect(); if (r.width > 40 || r.height > 40 || r.width < 4) continue; const t = getComputedStyle(e); if ((t.backgroundImage && t.backgroundImage !== 'none') || (t.boxShadow && t.boxShadow !== 'none') || (!e.children.length && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(t.backgroundColor))) rs.push(r) }
    return union(rs) }
  // offset of a child box's centre from a container's centre (container = padding box minus border)
  const off = (outer, inner) => { if (!outer || !inner) return null; return { dx: r1(inner.x + inner.w / 2 - (outer.x + outer.w / 2)), dy: r1(inner.y + inner.h / 2 - (outer.y + outer.h / 2)) } }
  const KEYS = ['display', 'width', 'height', 'min-width', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'column-gap', 'font-size', 'line-height', 'font-weight', 'color', 'background-color', 'border-top-width', 'border-top-style', 'border-top-color', 'border-top-left-radius', 'box-shadow', 'justify-content', 'align-items', 'text-align', 'cursor']
  const cs = (el, keys = KEYS, pseudo) => { if (!el) return null; const s = getComputedStyle(el, pseudo || null); return Object.fromEntries(keys.map((k) => [k, s.getPropertyValue(k)])) }
  // visible border: own border, or an absolutely positioned child that draws it (official .ds-button__border)
  const border = (el) => { if (!el) return null; const s = getComputedStyle(el); if (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') return { by: 'self', width: s.borderTopWidth, color: s.borderTopColor, radius: s.borderTopLeftRadius }
    for (const c of el.children) { const t = getComputedStyle(c); if (t.position === 'absolute' && parseFloat(t.borderTopWidth) > 0 && t.borderTopStyle !== 'none') return { by: 'child', width: t.borderTopWidth, color: t.borderTopColor, radius: t.borderTopLeftRadius } }
    if (s.boxShadow && s.boxShadow !== 'none' && /0px 0px 0px 1px/.test(s.boxShadow)) return { by: 'shadow', width: '1px', color: s.boxShadow.replace(/ 0px 0px 0px 1px.*/, ''), radius: s.borderTopLeftRadius }
    return { by: 'none' } }
  // background: own, or official .ds-button__background child
  const bg = (el) => { if (!el) return null; const s = getComputedStyle(el).backgroundColor; if (s && !/rgba\(\d+, \d+, \d+, 0\)/.test(s)) return s; for (const c of el.children) { const k = typeof c.className === 'string' ? c.className : ''; if (/background/.test(k)) return getComputedStyle(c).backgroundColor } return s }
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0).toString(16) }
  const svg = (g) => { if (!g) return null; const paths = [...g.querySelectorAll('path,circle,rect,line,polyline,polygon')]; const st = getComputedStyle(g); const p0 = paths[0] ? getComputedStyle(paths[0]) : null
    const d = paths.map((p) => p.getAttribute('d') || p.outerHTML).join('|')
    return { box: box(g), viewBox: g.getAttribute('viewBox'), n: paths.length, fill: p0 ? p0.fill : st.fill, stroke: p0 ? p0.stroke : st.stroke, strokeWidth: p0 ? p0.strokeWidth : st.strokeWidth, color: st.color, d0: d.slice(0, 28), dHash: hash(d), dir: dir(g) } }

  // pointing direction of a chevron-like glyph: rasterise the shapes on a grid in user space (isPointInFill/Stroke),
  // the tip is the side whose edge rows/columns have the smallest ink extent; map through the screen CTM (CSS rotate included)
  const dir = (g) => { if (!g || !g.getScreenCTM) return null; const vb = (g.getAttribute('viewBox') || `0 0 ${g.width.baseVal.value} ${g.height.baseVal.value}`).split(/[\s,]+/).map(Number); const shapes = [...g.querySelectorAll('path,polyline,line,circle,rect,polygon')]; if (!shapes.length) return null
    const N = 32, ink = []; const pt = g.createSVGPoint()
    for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) { pt.x = vb[0] + (ix + 0.5) * vb[2] / N; pt.y = vb[1] + (iy + 0.5) * vb[3] / N
      if (shapes.some((s) => { const c = getComputedStyle(s); const filled = c.fill !== 'none'; const stroked = c.stroke !== 'none' && parseFloat(c.strokeWidth) > 0; return (filled && s.isPointInFill(pt)) || (stroked && s.isPointInStroke(pt)) })) ink.push([ix, iy]) }
    if (ink.length < 4) return null
    const ext = (axis, lo) => { const vals = ink.map((p) => p[axis]); const mn = Math.min(...vals), mx = Math.max(...vals); const band = (mx - mn) * 0.25; const sel = ink.filter((p) => lo ? p[axis] <= mn + band : p[axis] >= mx - band); const o = sel.map((p) => p[1 - axis]); return o.length ? Math.max(...o) - Math.min(...o) : 0 }
    const top = ext(1, true), bottom = ext(1, false), left = ext(0, true), right = ext(0, false)
    const vAsym = Math.abs(top - bottom), hAsym = Math.abs(left - right); if (Math.max(vAsym, hAsym) < 3) return 'none'
    let v = vAsym > hAsym ? [0, top < bottom ? -1 : 1] : [left < right ? -1 : 1, 0]
    const m = g.getScreenCTM(); const sx = m.a * v[0] + m.c * v[1], sy = m.b * v[0] + m.d * v[1]
    return Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'down' : 'up') }
  // generic: for every visible clickable/labelled container, compare content centre with container centre
  const CANDIDATES = 'button,[role=button],[role=menuitem],[role=tab],[role=option],a,label,.chip,[class*=pill],[class*=avatar],[class*=badge],[data-tip]'
  const centering = (root = document.body, minSize = 12) => { const out = []
    for (const el of root.querySelectorAll(CANDIDATES)) { if (!visible(el)) continue; const b = el.getBoundingClientRect(); if (b.width < minSize || b.height < minSize || b.height > 64) continue
      const s = getComputedStyle(el); const inner = { x: b.x + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft), y: b.y + parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop) }
      inner.w = b.width - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth) - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); inner.h = b.height - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth) - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)
      const c = content(el); if (!c) continue
      const o = off({ x: b.x, y: b.y, w: b.width, h: b.height }, c)
      // horizontal centring only matters when the content is meant to be centred (short label / icon-only / avatar)
      const pseudo = ['::before', '::after'].some((ps) => { const q = getComputedStyle(el, ps); return q.content && q.content !== 'none' && q.content !== 'normal' && parseFloat(q.width) > 0 && q.position !== 'absolute' })
      const selectLike = el.hasAttribute('aria-haspopup') || /menu|select|dropdown/.test(typeof el.className === 'string' ? el.className : '') || [...el.querySelectorAll('svg')].some((g) => getComputedStyle(g).position === 'absolute')
      const short = !pseudo && !selectLike && c.w <= b.width * 0.8 && (s.justifyContent === 'center' || s.textAlign === 'center' || /avatar|pill|chip/.test(el.className) || (c.w < 60 && b.width < 96))
      out.push({ el: describe(el), text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24), box: box(el), content: c, dx: short ? o.dx : null, dy: o.dy, h: r1(b.height) })
    } return out }
  const describe = (el) => { const id = el.getAttribute('data-testid'); const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''; return el.tagName.toLowerCase() + (id ? `[data-testid=${id}]` : '') + (c ? '.' + c : '') }
  window.__m = { dir, box, text, content, off, cs, border, bg, svg, centering, visible, describe, KEYS }
})()
