// fb1721 markdown/math measurement, container-agnostic. window.__mdm(root) → metrics for one markdown container.
(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.x + r.width, b: r.y + r.height } }
  const textBox = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter((r) => r.width > 0); if (!rs.length) return null
    return { y: Math.min(...rs.map((r) => r.y)), b: Math.max(...rs.map((r) => r.y + r.height)), x: Math.min(...rs.map((r) => r.x)), r: Math.max(...rs.map((r) => r.x + r.width)) } }
  window.__mdm = (root) => {
    const disp = [...root.querySelectorAll('.katex-display')].filter(vis)
    const inl = [...root.querySelectorAll('.katex')].filter((k) => vis(k) && !k.closest('.katex-display'))
    const errors = root.querySelectorAll('.katex-error').length
    const clone = root.cloneNode(true); clone.querySelectorAll('.katex, .katex-display, .katex-mathml').forEach((k) => k.remove())
    const plain = clone.textContent || ''
    const pfs = parseFloat(getComputedStyle(root.querySelector('p') || root).fontSize)
    const display = disp.map((d) => { const html = d.querySelector('.katex-html') || d; const cs = getComputedStyle(d); const db = box(d); const hb = box(html)
      // the visible formula = union of the base boxes inside katex-html
      const bases = [...html.querySelectorAll('.base')].map(box); const fx = bases.length ? Math.min(...bases.map((b) => b.x)) : hb.x; const fr = bases.length ? Math.max(...bases.map((b) => b.r)) : hb.r
      const prev = d.closest('p, div, span.katex-display')?.previousElementSibling || d.previousElementSibling
      return { textAlign: cs.textAlign, padding: cs.paddingTop, overflowX: cs.overflowX, width: db.w, centreDx: +(((fx + fr) / 2) - (db.x + db.w / 2)).toFixed(1), overflowing: d.scrollWidth > d.clientWidth + 1 } })
    const katexFont = [...root.querySelectorAll('.katex')].filter(vis).map((k) => +(parseFloat(getComputedStyle(k).fontSize) / parseFloat(getComputedStyle(k.closest('.katex-display')?.parentElement || k.parentElement).fontSize)).toFixed(3))
    return { inline: inl.length, display: disp.length, errors, plain, display_: display, katexFontRatio: [...new Set(katexFont)], rootFont: pfs }
  }
  // list/paragraph geometry: gaps between consecutive blocks, measured from text boxes (implementation-agnostic)
  window.__lists = (root) => {
    const md = root
    const blocks = [...md.querySelectorAll('p, ul, ol')].filter((e) => vis(e) && !e.closest('li') )
    const gap = (a, b) => +(box(b).y - box(a).b).toFixed(1)
    const kinds = blocks.map((b) => b.tagName.toLowerCase())
    const gaps = blocks.slice(1).map((b, i) => ({ from: kinds[i], to: kinds[i + 1], gap: gap(blocks[i], b) }))
    const lis = [...md.querySelectorAll('li')].filter(vis)
    const liGaps = []; for (const l of md.querySelectorAll('ul,ol')) { const ks = [...l.children].filter((c) => c.tagName === 'LI'); ks.slice(1).forEach((k, i) => liGaps.push(+(box(k).y - box(ks[i]).b).toFixed(1))) }
    const nested = [...md.querySelectorAll('li > ul, li > ol')].map((n) => { const li = n.parentElement; return +(box(n).y - (box(li).y + parseFloat(getComputedStyle(li).lineHeight))).toFixed(1) })
    const ul = md.querySelector('ul'); const li = md.querySelector('li')
    const indent = ul && li ? +(textBox(li).x - box(ul).x).toFixed(1) : null
    return { kinds, gaps, nested: [...new Set(nested)], liGaps: [...new Set(liGaps)], indent, liFont: li ? [getComputedStyle(li).fontSize, getComputedStyle(li).lineHeight] : null, liColor: li ? getComputedStyle(li).color : null, marker: li ? getComputedStyle(li, '::marker').color : null, pFont: md.querySelector('p') ? [getComputedStyle(md.querySelector('p')).fontSize, getComputedStyle(md.querySelector('p')).lineHeight] : null }
  }
})()
