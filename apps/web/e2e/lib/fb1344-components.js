// fb1344 component extractors. window.__comp(side) → uniform metrics for official ('off') or ours ('ours').
// Requires lib/measure.js (window.__m). Selectors are the only side-specific part.
(() => {
  const M = window.__m
  const byText = (re, root = document) => [...root.querySelectorAll('span,div,p,button')].find((e) => re.test((e.firstChild && e.firstChild.nodeType === 3 ? e.firstChild.textContent : '').trim()) && M.visible(e))
  const SEL = {
    ours: {
      thinkHead: () => document.querySelector('[data-testid=thinking] > button'),
      thinkLabel: (h) => h,
      thinkIcons: (h) => [h.querySelector(':scope > svg'), h.querySelector('.chev svg')],
      searchRow: () => document.querySelector('.timeline-search') || document.querySelector('.search-block .found-line, .found-line'),
      searchIcon: (r) => r.querySelector(':scope > svg'),
      browseRow: () => document.querySelector('.timeline-browse'),
      pill: () => [...document.querySelectorAll('[data-testid=search-results]')].pop(),
      pillIcons: (p) => [...p.querySelectorAll('.favicons > *')],
      actions: () => [...document.querySelectorAll('.action-row')].pop(),
      actionButtons: (a) => [...a.querySelectorAll(':scope > button')],
      userRow: () => document.querySelector('[data-testid=user-menu]') || document.querySelector('.user-row'),
      avatar: (u) => u.querySelector('.avatar'),
      userName: (u) => u.querySelector('.user-label') || u.querySelector('.user-copy'),
      userMore: (u) => u.querySelector('.user-more svg'),
    },
    off: {
      thinkHead: () => byText(/^已思考/)?.parentElement,
      thinkLabel: (h) => [...h.children].find((c) => /已思考/.test(c.textContent)),
      thinkIcons: (h) => [...h.querySelectorAll('.ds-icon svg')].slice(0, 2),
      searchRow: () => byText(/^搜索到 \d+ 个网页/)?.parentElement,
      searchIcon: (r) => r.querySelector('.ds-icon svg'),
      browseRow: () => byText(/^浏览 \d+ 个页面/)?.parentElement?.parentElement,
      pill: () => byText(/^\d+ 个网页$/)?.parentElement,
      pillIcons: (p) => [...p.querySelectorAll('.site_logo_back')],
      actions: () => document.querySelector('.ds-flex._965abe9'),
      actionButtons: (a) => [...a.querySelectorAll(':scope > [role=button]')],
      userRow: () => document.querySelector('._2afd28d'),
      avatar: (u) => u.querySelector('.ede5bc47'),
      userName: (u) => u.querySelector('._9d8da05'),
      userMore: (u) => u.querySelector('._39cc453 svg'),
    },
  }
  const FONT = ['font-size', 'line-height', 'font-weight', 'color']
  window.__comp = (side) => {
    const S = SEL[side]; const R = {}
    const h = S.thinkHead()
    if (h) { const lab = S.thinkLabel(h); const [i1, i2] = S.thinkIcons(h); const hb = M.box(h), tb = M.text(lab)
      R.thinkHead = { box: hb, cs: M.cs(h, ['display', 'height', 'gap', 'column-gap', 'padding-left', 'padding-right', 'border-top-left-radius', 'background-color', 'cursor']), bg: M.bg(h), label: { text: lab.textContent.trim(), box: tb, cs: M.cs(lab, FONT) }, iconLead: M.svg(i1), iconChevron: M.svg(i2),
        gapIconLabel: i1 && tb ? +(tb.x - (M.box(i1).x + M.box(i1).w)).toFixed(1) : null, gapLabelChevron: i2 && tb ? +(M.box(i2).x - (tb.x + tb.w)).toFixed(1) : null, labelOff: M.off(hb, tb), iconLeadOff: i1 ? M.off(hb, M.box(i1)) : null } }
    for (const [k, f] of [['searchRow', S.searchRow], ['browseRow', S.browseRow]]) { const r = f(); if (!r) continue; const ic = S.searchIcon(r); const tb = M.text(r)
      const lab = [...r.querySelectorAll('*')].find((e) => /个网页|网页/.test(e.firstChild?.nodeType === 3 ? e.firstChild.textContent : '')) || r
      R[k] = { box: M.box(r), cs: M.cs(r, ['display', 'height', 'gap', 'column-gap', 'align-items', 'margin-top', 'padding-left', ...FONT]), labelCs: M.cs(lab, FONT), icon: M.svg(ic), iconColor: ic ? getComputedStyle(ic).color : null, text: r.textContent.trim().slice(0, 30), textBox: tb, iconOff: ic ? M.off(M.box(r), M.box(ic)) : null } }
    const p = S.pill()
    if (p) { const ics = S.pillIcons(p); const b = M.box(p)
      R.pill = { box: b, cs: M.cs(p), border: M.border(p), bg: M.bg(p), text: p.textContent.trim(), contentOff: M.off(b, M.content(p)), textOff: M.off(b, M.text(p)),
        icons: ics.map((e) => M.box(e)), iconOverlap: ics.length > 1 ? +(M.box(ics[0]).x + M.box(ics[0]).w - M.box(ics[1]).x).toFixed(1) : null, iconRadius: ics[0] ? getComputedStyle(ics[0]).borderTopLeftRadius : null, iconBorder: ics[0] ? M.border(ics[0]) : null } }
    const a = S.actions()
    if (a) { const bs = S.actionButtons(a)
      R.actions = { box: M.box(a), cs: M.cs(a, ['display', 'gap', 'column-gap', 'padding-top', 'padding-bottom', 'margin-left', 'color', 'height', 'min-height']), n: bs.length,
        buttons: bs.map((b) => ({ label: b.getAttribute('aria-label') || b.getAttribute('data-tip') || '', box: M.box(b), radius: getComputedStyle(b).borderTopLeftRadius, color: getComputedStyle(b).color, svg: M.svg(b.querySelector('svg')), iconOff: M.off(M.box(b), M.box(b.querySelector('svg'))) })),
        gaps: bs.slice(1).map((b, i) => +(M.box(b).x - M.box(bs[i]).x - M.box(bs[i]).w).toFixed(1)) } }
    const u = S.userRow()
    if (u && M.visible(u)) { const av = S.avatar(u), nm = S.userName(u), mo = S.userMore(u); const ub = M.box(u), ab = M.box(av)
      R.userRow = { box: ub, cs: M.cs(u, ['display', 'height', 'gap', 'column-gap', 'padding-left', 'padding-right', 'padding-top', 'align-items', 'border-top-left-radius']),
        avatar: av ? { box: ab, cs: M.cs(av, ['width', 'height', 'font-size', 'line-height', 'font-weight', 'color', 'background-color', 'border-top-left-radius', 'display', 'align-items', 'justify-content', 'text-align']), glyphOff: M.off(ab, M.text(av)), inRowOff: M.off(ub, ab) } : null,
        name: nm ? { box: M.text(nm), cs: M.cs(nm, FONT), inRowOff: M.off(ub, M.text(nm)) } : null,
        more: mo ? { svg: M.svg(mo), inRowOff: M.off(ub, M.box(mo)) } : null } }
    return R
  }
  // settings dialog inline buttons (ours: any visible dialog; official capture JSON is used instead)
  window.__settingsButtons = () => { const d = [...document.querySelectorAll('[role=dialog], .settings-shell')].filter(M.visible).pop(); if (!d) return null
    const nav = new Set([...d.querySelectorAll('nav button, .settings-nav button, [role=tab]')])
    return [...d.querySelectorAll('button, [role=button], label:has(input[type=file]), label.file-button, a.account-quiet')].filter((b) => !nav.has(b) && b.textContent.trim() && b.getBoundingClientRect().width > 0 && !b.closest('nav, .settings-nav') && !b.matches('.switch')).map((b) => { const bb = M.box(b); return { text: b.textContent.trim().slice(0, 12), box: bb, cs: M.cs(b, ['display', 'width', 'height', 'min-width', 'padding-left', 'padding-right', 'font-size', 'line-height', 'color', 'border-top-left-radius', 'justify-content', 'align-items', 'text-align']), border: M.border(b), bg: M.bg(b), textOff: M.off(bb, M.text(b)), tag: b.tagName.toLowerCase(), cls: typeof b.className === 'string' ? b.className : '', right: +(bb.x + bb.w).toFixed(1), row: (b.closest('.settings-line, .settings-row, [class*=row]')?.firstElementChild?.textContent || '').trim().slice(0, 16) } }) }
})()
