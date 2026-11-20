// fb1554 长回答 markdown 渲染检查（浏览器内运行）。window.__md(side, expect?) → { metrics, fails[] }
// side: 'ours' | 'off'。只有选择器分两边，规则完全相同；官方冻结 DOM 必须全绿，才能拿来卡我们。
(() => {
  const SEL = {
    ours: { roots: () => [...document.querySelectorAll('article.turn.assistant')].pop()?.querySelectorAll(':scope > .prose') ?? [], cite: '.cite', browseLink: '.timeline-browse a.browse-link, .browse-line a.browse-link', browseIcon: (a) => a.querySelector('svg') || a.nextElementSibling?.querySelector('svg'), searchRow: () => document.querySelector('.timeline-search'), searchIcons: (r) => [...r.querySelectorAll('.favicons > *')], pillIcons: () => [...([...document.querySelectorAll('[data-testid=search-results]')].pop()?.querySelectorAll('.favicons > *') ?? [])] },
    off: { roots: () => document.querySelectorAll('.ds-markdown.ds-assistant-message-main-content'), cite: '.ds-markdown-cite', browseLink: '._02fb570._9887d4d a._04ab7b1', browseIcon: (a) => a.nextElementSibling?.querySelector('svg'), searchRow: () => [...document.querySelectorAll('._60aa7fb')].find((e) => /搜索到 \d+ 个网页/.test(e.textContent)), searchIcons: (r) => [...r.querySelectorAll('.site_logo_back')], pillIcons: () => [...(document.querySelector('.f93f59e4')?.querySelectorAll('.site_logo_back') ?? [])] },
  }
  const SKIP = 'pre, code, .katex, .katex-display, .cite, .ds-markdown-cite, .cite-wrap, [data-citation-group], .search-view-card'
  const LITERAL = [/\*\*/, /(^|[^\\])__/, /`/, /\[citation/i, /〔\d+〕/, /^\s*#{1,6}\s/m, /^\s*\|.*\|\s*$/m, /\$\$?[^$]+\$/]
  const NO_LINE_START = '。，、；：？！）」』》”’〕】,.;:?!)]}…%'
  const BLOCK = (el) => { for (let e = el; e; e = e.parentElement) { const d = getComputedStyle(e).display; if (!/^inline/.test(d) && d !== 'contents') return e } return null }
  const textNodes = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT }); const out = []; while (w.nextNode()) out.push(w.currentNode); return out }
  const charRects = (node) => { const out = []; const r = document.createRange(); for (let k = 0; k < node.length; k++) { const ch = node.data[k]; if (/\s/.test(ch)) continue; r.setStart(node, k); r.setEnd(node, k + 1); const b = r.getClientRects()[0]; if (b && b.width > 0) out.push({ ch, b, node, k }) } return out }
  const prevChar = (badge) => { // 角标前最近一个可见字符（不跨块也照样找，用来判断是否被拆到别的块里）
    const all = [...document.querySelectorAll('body *')]; let el = badge.closest('[data-citation-group], .cite-wrap') || badge
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = []; while (w.nextNode()) { if (w.currentNode.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !w.currentNode.parentElement.closest(SKIP) && w.currentNode.data.trim()) nodes.push(w.currentNode) }
    const n = nodes.pop(); if (!n) return null; const cs = charRects(n); return cs.pop() || null }
  const css = (e, ks) => { const s = getComputedStyle(e); return Object.fromEntries(ks.map((k) => [k, s.getPropertyValue(k)])) }
  window.__md = (side, X) => {
    const S = SEL[side]; const fails = []; const fail = (rule, detail) => fails.push({ rule, detail })
    const roots = [...S.roots()]; const M = { roots: roots.length }
    // 1 不残留 markdown 字面符号
    const lit = []; for (const r of roots) for (const n of textNodes(r)) for (const re of LITERAL) if (re.test(n.data)) lit.push({ re: String(re), text: n.data.slice(0, 60) })
    M.literal = lit; if (lit.length) fail('no-literal-markdown', lit)
    // 2 角标 inline，且和前一个字符同一块、同一行盒
    const cites = roots.flatMap((r) => [...r.querySelectorAll(S.cite)]); M.cites = []
    for (const c of cites) {
      const chain = []; for (let e = c; e && !roots.includes(e); e = e.parentElement) chain.push(getComputedStyle(e).display)
      const inline = /^inline/.test(chain[0]) && /^inline/.test(chain[1] ?? 'inline')
      const p = prevChar(c); const b = c.getBoundingClientRect()
      const sameBlock = p ? BLOCK(p.node.parentElement) === BLOCK(c.parentElement) : false
      const sameLine = p ? b.bottom > p.b.top && b.top < p.b.bottom : false
      const rec = { n: c.textContent.replace(/\D/g, ''), chain: chain.slice(0, 4), prev: p?.ch ?? null, sameBlock, sameLine, dyTop: p ? +(b.top - p.b.top).toFixed(2) : null, dxGap: p ? +(b.left - p.b.right).toFixed(2) : null, w: +b.width.toFixed(2), h: +b.height.toFixed(2) }
      M.cites.push(rec)
      if (!inline || !sameBlock || !sameLine) fail('cite-inline-same-line', rec)
    }
    // 3 结构计数
    const q = (s) => roots.reduce((a, r) => a + r.querySelectorAll(s).length, 0)
    M.counts = { h2: q('h2'), topLevelP: roots.reduce((a, r) => a + r.querySelectorAll(':scope > p').length, 0), li: q('li'), table: q('table'), tableRows: q('tr'), pre: q('pre'), nestedPre: q('pre pre'), katex: q('.katex'), strong: roots.flatMap((r) => [...r.querySelectorAll('strong')].map((s) => s.textContent.trim())) }
    if (X) {
      if (roots.length !== X.proseRoots) fail('one-markdown-root', { got: roots.length, want: X.proseRoots })
      for (const k of ['h2', 'topLevelP', 'li', 'table', 'tableRows', 'pre', 'katex']) if (M.counts[k] !== X[k]) fail('count-' + k, { got: M.counts[k], want: X[k] })
      if (JSON.stringify(M.counts.strong) !== JSON.stringify(X.strong)) fail('strong-texts', { got: M.counts.strong, want: X.strong })
      const nums = M.cites.map((c) => c.n.replace(/\D/g, '')); if (JSON.stringify(nums) !== JSON.stringify(X.cites)) fail('cite-numbers', { got: nums, want: X.cites })
    }
    // 4 避头：每个块的每一行，行首不能是闭合标点
    const heads = []
    for (const r of roots) for (const blk of r.querySelectorAll('p, li, h1, h2, h3, h4, td, th')) {
      let lastTop = null; let first = true
      for (const n of textNodes(blk)) { if (BLOCK(n.parentElement) !== blk) continue; for (const { ch, b } of charRects(n)) { const newLine = lastTop === null || b.top > lastTop + 4; if (newLine && NO_LINE_START.includes(ch)) heads.push({ ch, block: blk.tagName, first, text: blk.textContent.slice(0, 30) }); if (newLine) lastTop = b.top; first = false } }
    }
    M.lineHeads = heads; if (heads.length) fail('kinsoku-line-start', heads)
    // 5 样式量值（与官方 fixture 比对在 node 侧做）
    const links = [...document.querySelectorAll(S.browseLink)]
    M.browse = { count: links.length, uniqueHref: new Set(links.map((a) => a.href)).size, texts: links.map((a) => a.textContent.trim()), link: links[0] ? css(links[0], ['color', 'font-size', 'line-height', 'text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-underline-offset', 'white-space']) : null, icon: links[0] && S.browseIcon(links[0]) ? (() => { const s = S.browseIcon(links[0]); const bb = s.getBoundingClientRect(); return { viewBox: s.getAttribute('viewBox'), w: +bb.width.toFixed(1), h: +bb.height.toFixed(1), inLink: links[0].contains(s), color: getComputedStyle(s).color } })() : null, rowGap: links[1] ? +(links[1].getBoundingClientRect().left - (S.browseIcon(links[0])?.getBoundingClientRect().right ?? links[0].getBoundingClientRect().right)).toFixed(1) : null }
    if (M.browse.count !== M.browse.uniqueHref) fail('browse-no-duplicate-url', { count: M.browse.count, unique: M.browse.uniqueHref, texts: M.browse.texts })
    if (X && M.browse.count !== X.browseLinks) fail('browse-count', { got: M.browse.count, want: X.browseLinks })
    const row = S.searchRow(); const icons = row ? S.searchIcons(row) : []
    M.search = { icons: icons.length, icon: icons[0] ? (() => { const bb = icons[0].getBoundingClientRect(); return { w: +bb.width.toFixed(1), h: +bb.height.toFixed(1), radius: getComputedStyle(icons[0]).borderRadius, overlap: icons[1] ? +(icons[0].getBoundingClientRect().right - icons[1].getBoundingClientRect().left).toFixed(1) : null } })() : null }
    const pi = S.pillIcons(); M.pill = { icons: pi.length, icon: pi[0] ? { w: +pi[0].getBoundingClientRect().width.toFixed(1), h: +pi[0].getBoundingClientRect().height.toFixed(1), overlap: pi[1] ? +(pi[0].getBoundingClientRect().right - pi[1].getBoundingClientRect().left).toFixed(1) : null } : null }
    M.labels = { browse: (document.body.innerText.match(/浏览 \d+ 个页面/) || [null])[0], found: (document.body.innerText.match(/搜索到 \d+ 个网页/) || [null])[0], pill: (document.body.innerText.match(/(^|\n)\s*\d+ 个网页/) || [null])[0]?.trim() ?? null }
    if (cites[0]) M.citeStyle = css(cites[0], ['font-size', 'font-weight', 'line-height', 'color', 'background-color', 'border-top-left-radius', 'border-bottom-left-radius', 'vertical-align', 'top', 'min-width', 'height', 'padding-left', 'margin-left'])
    return { metrics: M, fails }
  }
})()
