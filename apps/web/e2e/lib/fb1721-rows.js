// fb1721 settings-row layout invariants. window.__rows(opts) → { rows:[…], fails:[…] }.
// Generic: works on ours and on the official DOM (no DeepAPI class names). Row = smallest block in the settings
// content panel that spans ≥ 90% of the panel width, is display:flex, and holds a label block plus ≥1 control.
// Official numbers (frozen style-official-settings-{general,account,data}-1440x900.json, main.dc093a796f.css):
//   row display:flex, padding 12px 0, height 60 (86 when the label has a description line) = content + 24;
//   control 36px tall, vertical centre == row centre, right edge == row right edge;
//   divider: `._50b3d9e+._50b3d9e{box-shadow:inset 0 1px 0 0 var(--dsw-alias-border-l2-darkmode-thin)}` → top of row N+1,
//   light rgba(0, 0, 0, 0.1), dark rgba(255, 255, 255, 0.06).
(() => {
  const CTRL = 'button, [role=button], [role=switch], [role=combobox], [aria-haspopup], select, input:not([type=hidden]):not([type=file]), label:has(input[type=file])'
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0 }
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), b: +(r.y + r.height).toFixed(2), r: +(r.x + r.width).toFixed(2) } }
  const union = (bs) => { const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y)), r = Math.max(...bs.map((b) => b.r)), b = Math.max(...bs.map((b) => b.b)); return { x, y, r, b, w: r - x, h: b - y } }
  const textBox = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter((r) => r.width > 0); return rs.length ? union(rs.map((r) => ({ x: r.x, y: r.y, r: r.x + r.width, b: r.y + r.height }))) : null }
  const inter = (a, b) => Math.min(a.r, b.r) - Math.max(a.x, b.x) > 0.5 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 0.5
  const divider = (e) => { const s = getComputedStyle(e)
    const m = /(rgba?\([^)]*\))\s+0px\s+1px\s+0px\s+0px\s+inset|inset\s+0px\s+1px\s+0px\s+0px\s+(rgba?\([^)]*\))/.exec(s.boxShadow)
    if (m) return { kind: 'inset-shadow', color: m[1] || m[2], y: box(e).y }
    if (parseFloat(s.borderTopWidth) >= 0.5 && s.borderTopStyle !== 'none') return { kind: 'border-top', color: s.borderTopColor, y: box(e).y }
    const before = getComputedStyle(e, '::before'); if (before.content !== 'none' && parseFloat(before.height) <= 1.5 && parseFloat(before.height) > 0) return { kind: '::before', color: before.backgroundColor, y: box(e).y + (parseFloat(before.top) || 0) }
    return null }
  window.__rows = (opts = {}) => {
    const dialog = [...document.querySelectorAll('[role=dialog], dialog, .ds-modal')].filter(vis).pop(); if (!dialog) return { rows: [], fails: [{ rule: 'no-dialog' }] }
    const nav = dialog.querySelector('nav, [role=tablist]')
    const navBox0 = nav && vis(nav) ? box(nav) : null
    const navBox = navBox0 && navBox0.w < box(dialog).w * 0.6 ? navBox0 : null
    // content panel = widest scrolling/flow column to the right of the nav (desktop) or the dialog body (390)
    const panel = dialog.querySelector('.settings-main, [data-settings-panel]') || dialog
    const all = [...panel.querySelectorAll('*')].filter(vis).filter((e) => !e.closest('header,nav,[role=tablist]'))
    const panelCands = all.filter((e) => (!navBox || box(e).x >= navBox.r - 1) && !e.closest('nav,[role=tablist]') && e.querySelector(CTRL))
    const panelW = Math.max(...panelCands.map((e) => box(e).w))
    const isRowish = (e) => { const s = getComputedStyle(e); return /flex|grid/.test(s.display) && box(e).w >= panelW * 0.9 - 1 && e.children.length >= 2 && !!e.querySelector(CTRL) && (e.textContent || '').trim().length > 0 && box(e).h >= 30 && box(e).h <= 200 }
    let cands = panelCands.filter(isRowish)
    // rows start at the panel's left content edge; inner flex wrappers on the right side are not rows
    const left = Math.min(...cands.map((e) => box(e).x)); cands = cands.filter((e) => Math.abs(box(e).x - left) <= 1)
    cands = cands.filter((e) => !cands.some((o) => o !== e && e.contains(o)))
    // a row must have a label part (first child with text, no control) and a control part
    const rows = []
    for (const r of cands) {
      const kids = [...r.children].filter(vis); const labelEl = kids.find((k) => !k.matches(CTRL) && !k.querySelector(CTRL) && (k.textContent || '').trim())
      if (!labelEl) continue
      const ctrls = [...r.querySelectorAll(CTRL)].filter(vis).filter((c) => !c.parentElement.closest(CTRL) || c.parentElement.closest(CTRL) === r)
      const top = ctrls.filter((c) => !ctrls.some((o) => o !== c && o.contains(c)))
      if (!top.length) continue
      rows.push({ el: r, label: (labelEl.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), labelEl, ctrls: top })
    }
    rows.sort((a, b) => box(a.el).y - box(b.el).y)
    const fails = []; const out = []
    const F = (rule, row, detail) => fails.push({ rule, row: row.label, detail })
    rows.forEach((row, i) => {
      const rb = box(row.el); const cs = getComputedStyle(row.el)
      const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom)
      const content = { y: rb.y + pt + parseFloat(cs.borderTopWidth), b: rb.b - pb - parseFloat(cs.borderBottomWidth) }
      const cbs = row.ctrls.map((c) => ({ text: (c.getAttribute('aria-label') || c.textContent || c.getAttribute('role') || c.tagName).trim().slice(0, 24), b: box(c), el: c }))
      const group = union(cbs.map((c) => c.b))
      const lb = textBox(row.labelEl.closest('*')) || box(row.labelEl); const lblock = box(row.labelEl)
      const rc = (rb.y + rb.b) / 2
      const rec = { label: row.label, box: rb, padTop: cs.paddingTop, padBottom: cs.paddingBottom, ctrls: cbs.map((c) => ({ text: c.text, box: c.b })), labelBlock: lblock, divider: i > 0 ? divider(row.el) : null }
      out.push(rec)
      // R1 every control inside the row's border box (a control that pokes past the row crosses the divider)
      for (const c of cbs) if (c.b.y < rb.y - 0.5 || c.b.b > rb.b + 0.5) F('ctrl-inside-row', row, `${c.text} y=${c.b.y}–${c.b.b} row=${rb.y}–${rb.b}`)
      // R2 control group vertically centred in the row
      const gc = (group.y + group.b) / 2; if (Math.abs(gc - rc) > 1) F('ctrl-centre', row, `group centre ${gc.toFixed(1)} row centre ${rc.toFixed(1)} Δ=${(gc - rc).toFixed(1)}`)
      // R3 label block vertically centred
      const lc = (lblock.y + lblock.b) / 2; if (Math.abs(lc - rc) > 1) F('label-centre', row, `label centre ${lc.toFixed(1)} row centre ${rc.toFixed(1)}`)
      // R4 no overlap among controls, nor with the label text
      cbs.forEach((a, j) => cbs.slice(j + 1).forEach((b) => { if (inter(a.b, b.b)) F('ctrl-overlap', row, `${a.text} × ${b.text}`) }))
      for (const c of cbs) if (lb && inter(c.b, lb)) F('ctrl-label-overlap', row, `${c.text} × label`)
      // R5 row height = content + 24 and ≥ 60; padding 12/12
      if (pt !== 12 || pb !== 12) F('row-padding', row, `${cs.paddingTop}/${cs.paddingBottom}`)
      const contentH = Math.max(group.h, lblock.h); if (rb.h < Math.max(60, contentH + 24) - 1) F('row-height', row, `h=${rb.h} content=${contentH.toFixed(1)} expect ${Math.max(60, contentH + 24)}`)
      // R6 controls right-aligned to the row's content edge
      if (Math.abs(group.r - (rb.r - parseFloat(cs.paddingRight))) > 1) F('ctrl-right', row, `group right ${group.r} row right ${rb.r}`)
      // R7 divider between rows (not on the first row of a section)
      if (i > 0 && opts.dividerColor && box(rows[i - 1].el).b <= rb.y + 1 && Math.abs(box(rows[i - 1].el).b - rb.y) < 1) {
        const d = rec.divider; if (!d) F('divider-missing', row, ''); else if (d.color !== opts.dividerColor) F('divider-color', row, `${d.kind} ${d.color} ≠ ${opts.dividerColor}`)
      }
      // R8 control not covered by anything else at its centre
      for (const c of cbs) { const panel = row.el.closest('.settings-main') || dialog; const pr = box(panel); if (c.b.y < pr.y || c.b.b > pr.b) continue; const x = c.b.x + c.b.w / 2, y = c.b.y + c.b.h / 2; const hit = document.elementFromPoint(x, y); if (hit && !c.el.contains(hit) && !hit.contains(c.el)) F('ctrl-covered', row, `${c.text} covered by ${hit.tagName}.${hit.className}`) }
    })
    // R9 adjacent rows do not overlap each other
    rows.forEach((row, i) => { if (i && box(rows[i - 1].el).b > box(row.el).y + 0.5) F('row-overlap', row, `prev bottom ${box(rows[i - 1].el).b} > ${box(row.el).y}`) })
    return { rows: out, fails, panelW }
  }
})()
