// fb1721 state-style probe for the thinking/tool timeline, ours or official (no DeepAPI class names needed).
// window.__state() → { dots:[{bg,anim}], icon:{color}, lines:[color], anims:[…] } for the LAST assistant message.
// window.__sampler.start()/stop() records __state() every animation frame (transition sampling).
(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const lastMsg = () => [...document.querySelectorAll('[data-testid=thinking], .ds-message')].filter(vis).pop()
  const anim = (s) => (s.animationName === 'none' || s.animationName === '' ? 'none' : `${s.animationDuration} ${s.animationTimingFunction} ${s.animationIterationCount}`)
  window.__state = () => {
    const m = lastMsg(); if (!m) return null
    const dots = []; const lines = []
    for (const e of m.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(e, pseudo); if (pseudo && (s.content === 'none' || s.content === 'normal')) continue
        if (s.width === '5px' && s.height === '5px' && /50%|2\.5px/.test(s.borderTopLeftRadius)) dots.push({ bg: s.backgroundColor, anim: anim(s), transition: s.transitionDuration + ' ' + s.transitionProperty, y: Math.round(e.getBoundingClientRect().y) })
        const w = parseFloat(s.width), h = parseFloat(s.height)
        if (!pseudo && h > 10 && ((w <= 1.01 && w > 0 && s.backgroundColor !== 'rgba(0, 0, 0, 0)') || (w === 0 && parseFloat(s.borderLeftWidth) === 1))) lines.push(w === 0 ? s.borderLeftColor : s.backgroundColor)
      }
    }
    const head = m.querySelector('button, [class*="_245c867"]'); const ic = head && (head.querySelector('.ds-icon') || head.querySelector('svg'))
    const iconColor = ic ? getComputedStyle(ic).color : null
    const anims = [...m.querySelectorAll('*')].map((e) => getComputedStyle(e)).filter((s) => s.animationName !== 'none' && s.animationIterationCount === 'infinite').map(anim)
    return { dots, lines: [...new Set(lines)], icon: iconColor, anims: [...new Set(anims)] }
  }
  window.__sampler = { rec: [], on: false, start() { this.rec = []; this.on = true; const t0 = performance.now(); const tick = () => { if (!this.on) return; this.rec.push({ t: Math.round(performance.now() - t0), s: window.__state() }); requestAnimationFrame(tick) }; requestAnimationFrame(tick) }, stop() { this.on = false; return this.rec } }
})()
