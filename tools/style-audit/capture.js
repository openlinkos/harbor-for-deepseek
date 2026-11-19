/* Style capture. Classic script: bookmarklet (minified) and Playwright page.evaluate.
   No network. Assigns globalThis.captureStyleAudit and does not run it. */
;(function () {
  var PROPS = (
    'display,position,box-sizing,width,height,min-width,max-width,min-height,max-height,' +
    'margin-top,margin-right,margin-bottom,margin-left,padding-top,padding-right,padding-bottom,padding-left,' +
    'gap,row-gap,column-gap,' +
    'border-top-width,border-right-width,border-bottom-width,border-left-width,' +
    'border-top-style,border-right-style,border-bottom-style,border-left-style,' +
    'border-top-color,border-right-color,border-bottom-color,border-left-color,' +
    'border-top-left-radius,border-top-right-radius,border-bottom-right-radius,border-bottom-left-radius,' +
    'background-color,background-image,box-shadow,color,opacity,' +
    'font-family,font-size,font-weight,line-height,letter-spacing,text-align,white-space,' +
    'overflow,overflow-x,overflow-y,z-index,transform,' +
    'transition-property,transition-duration,transition-timing-function,transition-delay,' +
    'animation-name,animation-duration,animation-timing-function,animation-delay,' +
    'cursor,outline,scrollbar-width,scrollbar-color'
  ).split(',')
  var SVG_PROPS = ['fill', 'stroke', 'stroke-width']
  var SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1, TEMPLATE: 1, BR: 1, WBR: 1 }
  var ROLE = {
    button: 'button', a: 'link', nav: 'navigation', main: 'main', header: 'banner', footer: 'contentinfo',
    aside: 'complementary', textarea: 'textbox', select: 'combobox', img: 'img', dialog: 'dialog',
    ul: 'list', ol: 'list', li: 'listitem', table: 'table', form: 'form', h1: 'heading', h2: 'heading',
    h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading', section: 'section',
  }

  function round(n) {
    return Math.round(n * 100) / 100
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function implicitRole(el) {
    var tag = el.tagName.toLowerCase()
    if (tag === 'input') {
      var type = (el.getAttribute('type') || 'text').toLowerCase()
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button'
      return 'textbox'
    }
    return ROLE[tag] || ''
  }

  function ownText(el) {
    var text = ''
    var nodes = el.childNodes
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 3) text += nodes[i].nodeValue || ''
    }
    text = clean(text)
    if (!text && el.childElementCount === 0) text = clean(el.textContent || '')
    return text.slice(0, 24)
  }

  function stylesOf(cs, extra) {
    var style = {}
    var list = extra ? PROPS.concat(extra) : PROPS
    for (var i = 0; i < list.length; i++) style[list[i]] = cs.getPropertyValue(list[i]).trim()
    return style
  }

  function shown(el, cs) {
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false
    var rect = el.getBoundingClientRect()
    return rect.width >= 0.5 || rect.height >= 0.5
  }

  function slug(value) {
    var text = clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return text || 'page'
  }

  function customProps(el) {
    var names = Object.create(null)
    function scan(rules) {
      if (!rules) return
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i]
        if (rule.cssRules) scan(rule.cssRules)
        var text = rule.cssText || ''
        var match
        var re = /--[a-zA-Z0-9_-]+/g
        while ((match = re.exec(text))) names[match[0]] = 1
      }
    }
    for (var s = 0; s < document.styleSheets.length; s++) {
      try { scan(document.styleSheets[s].cssRules) } catch (error) { /* cross-origin sheet */ }
    }
    var cs = getComputedStyle(el)
    var out = {}
    var keys = Object.keys(names).sort()
    for (var i = 0; i < keys.length; i++) {
      var value = cs.getPropertyValue(keys[i]).trim()
      if (value) out[keys[i]] = value
    }
    return out
  }

  function fonts() {
    var list = []
    if (document.fonts && document.fonts.forEach) {
      document.fonts.forEach(function (font) {
        list.push({ family: font.family, weight: String(font.weight), style: font.style, status: font.status })
      })
    }
    return list
  }

  function resolve(options) {
    options = options || {}
    var label = options.label
    var state = options.state
    if (!state) {
      if (typeof prompt !== 'function') return null
      var raw = prompt('State label. Prefix official/ or harbor/. Example: official/home-no-history', 'official/home-no-history')
      if (raw == null) return null
      var parts = String(raw).split('/')
      if (parts.length >= 2) {
        label = label || parts.shift()
        state = parts.join('/')
      } else {
        state = raw
      }
    }
    return {
      label: slug(label || 'capture'),
      state: slug(state || 'page'),
      download: options.download !== false,
    }
  }

  function emit(payload, name) {
    var json = JSON.stringify(payload)
    try {
      var blob = new Blob([json], { type: 'application/json' })
      var link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) { /* download is best-effort */ }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json)
    } catch (error) { /* clipboard is best-effort */ }
  }

  function captureStyleAudit(options) {
    var job = resolve(options)
    if (!job) return null
    var baseCache = new WeakMap()
    function baseKey(el) {
      var cached = baseCache.get(el)
      if (cached) return cached
      var role = el.getAttribute('role') || implicitRole(el)
      var name = clean(el.getAttribute('aria-label') || el.getAttribute('title') || '').slice(0, 48)
      var text = ownText(el)
      if (!text && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'LABEL' || role === 'button')) text = clean(el.textContent || '').slice(0, 24)
      var tag = el.tagName.toLowerCase()
      var key = (role || '') + '|' + name + '|' + text + '|' + tag
      baseCache.set(el, key)
      return key
    }
    function nthKey(el) {
      var base = baseKey(el)
      var nth = 1
      var parent = el.parentElement
      if (parent) {
        var kids = parent.children
        for (var i = 0; i < kids.length; i++) {
          if (kids[i] === el) break
          if (kids[i].nodeType === 1 && baseKey(kids[i]) === base) nth += 1
        }
      }
      return base + '#' + nth
    }
    function pathOf(el) {
      var parts = []
      var node = el
      while (node && node.nodeType === 1 && node !== document.documentElement && node !== document.body) {
        parts.push(nthKey(node))
        node = node.parentElement
      }
      parts.reverse()
      return parts.join(' > ')
    }
    var elements = []
    var nodes = document.body ? document.body.querySelectorAll('*') : []
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (SKIP[el.tagName]) continue
      if (el.tagName !== 'svg' && el.closest && el.closest('svg')) continue
      var cs = getComputedStyle(el)
      if (!shown(el, cs)) continue
      var rect = el.getBoundingClientRect()
      var extra = el.tagName === 'svg' || el.namespaceURI === 'http://www.w3.org/2000/svg' ? SVG_PROPS : null
      var key = pathOf(el)
      elements.push({
        key: key,
        role: el.getAttribute('role') || implicitRole(el),
        name: clean(el.getAttribute('aria-label') || el.getAttribute('title') || '').slice(0, 48),
        text: ownText(el),
        tag: el.tagName.toLowerCase(),
        testId: el.getAttribute('data-testid') || '',
        rect: { x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height) },
        style: stylesOf(cs, extra),
      })
      if (elements.length >= 8000) break
      pushPseudo(el, key, '::before')
      pushPseudo(el, key, '::after')
    }
    function pushPseudo(el, key, which) {
      var cs = getComputedStyle(el, which)
      var content = cs.getPropertyValue('content').trim()
      var width = parseFloat(cs.width) || 0
      var height = parseFloat(cs.height) || 0
      if ((content === 'none' || content === 'normal' || content === '') && width < 0.5 && height < 0.5) return
      var parent = el.getBoundingClientRect()
      var style = stylesOf(cs, null)
      style.content = content
      elements.push({
        key: key + which,
        role: '',
        name: '',
        text: '',
        tag: el.tagName.toLowerCase() + which,
        testId: '',
        pseudo: which,
        rect: { x: round(parent.x), y: round(parent.y), w: round(width), h: round(height) },
        style: style,
      })
    }
    var payload = {
      label: job.label,
      state: job.state,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio || 1,
      ua: navigator.userAgent,
      fonts: fonts(),
      customProperties: {
        root: customProps(document.documentElement),
        body: document.body ? customProps(document.body) : {},
      },
      truncated: elements.length >= 8000,
      elements: elements,
    }
    if (job.download) {
      emit(payload, 'style-' + job.label + '-' + job.state + '-' + payload.viewport.width + 'x' + payload.viewport.height + '.json')
    }
    return payload
  }

  globalThis.captureStyleAudit = captureStyleAudit
})()
