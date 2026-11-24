type Mermaid = typeof import('mermaid').default

let mermaidPromise: Promise<Mermaid> | null = null
let renderQueue = Promise.resolve()
let nextId = 0

const loadMermaid = () => {
  mermaidPromise ??= import('mermaid')
    .then((module) => module.default)
    .catch((error: unknown) => {
      mermaidPromise = null
      throw error
    })
  return mermaidPromise
}

/** Escape image tags so a diagram cannot pull in remote images. */
const sanitizeMermaid = (code: string) => code.replace(/<((?:img|image)\s+)/gi, '&lt;$1')

/** Mermaid paints with a `<style>` element. The page CSP allows style attributes and blocks that element, so unstyled shapes stay the SVG default black. Copy each rule onto the elements it matches. */
const applyThemeStyles = (svg: string) => {
  if (typeof DOMParser === 'undefined' || typeof CSSStyleSheet === 'undefined') return svg
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return svg
  const style = doc.querySelector('style')
  const css = style?.textContent ?? ''
  if (!style || !css.trim()) return svg
  const sheet = new CSSStyleSheet()
  try {
    sheet.replaceSync(css)
  } catch {
    return svg
  }
  const apply = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        let nodes: NodeListOf<Element>
        try {
          nodes = doc.querySelectorAll(rule.selectorText)
        } catch {
          continue
        }
        for (const node of nodes) {
          if (!(node instanceof SVGElement) && !(node instanceof HTMLElement)) continue
          for (let index = 0; index < rule.style.length; index += 1) {
            const prop = rule.style.item(index)
            node.style.setProperty(prop, rule.style.getPropertyValue(prop), rule.style.getPropertyPriority(prop))
          }
        }
      } else if (rule instanceof CSSGroupingRule && !(rule instanceof CSSKeyframesRule)) {
        apply(rule.cssRules)
      }
    }
  }
  apply(sheet.cssRules)
  style.remove()
  return new XMLSerializer().serializeToString(doc)
}

/** Theme font used while Mermaid measures HTML labels. Missing values are not replaced with a guessed size. */
const themeFont = (mermaid: Mermaid) => {
  const theme = mermaid.mermaidAPI.getConfig().themeVariables as { fontSize?: unknown; fontFamily?: unknown } | undefined
  const fontSize = theme?.fontSize
  const fontFamily = theme?.fontFamily
  if (
    typeof fontSize !== 'string' ||
    fontSize.trim() === '' ||
    typeof fontFamily !== 'string' ||
    fontFamily.trim() === ''
  ) {
    throw new Error('Mermaid theme is missing a font size or family')
  }
  return { fontSize, fontFamily }
}

/**
 * Mermaid measures HTML labels before `applyThemeStyles` runs. Its theme CSS is a `<style>` element, which the page CSP blocks, so a temporary tree on `document.body` inherits the 14px body font and the foreignObject is too narrow for the 16px paint. The host carries the theme font into that measurement.
 */
const measurementHost = (fontSize: string, fontFamily: string) => {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '0'
  host.style.top = '0'
  host.style.visibility = 'hidden'
  host.style.pointerEvents = 'none'
  host.style.fontSize = fontSize
  host.style.fontFamily = fontFamily
  document.body.append(host)
  return host
}

/** Draw one diagram at a time. A failure does not block the next chart. */
export const renderMermaid = (
  code: string,
  dark: boolean,
  isCancelled: () => boolean,
): Promise<string | null> => {
  const result = renderQueue.then(async () => {
    if (isCancelled() || !code.trim()) return null
    const mermaid = await loadMermaid()
    if (isCancelled()) return null
    mermaid.initialize({
      theme: dark ? 'dark' : 'default',
      securityLevel: 'strict',
      startOnLoad: false,
    })
    const { fontSize, fontFamily } = themeFont(mermaid)
    const id = `deepapi-mermaid-${nextId++}`
    const host = measurementHost(fontSize, fontFamily)
    try {
      const { svg } = await mermaid.render(id, sanitizeMermaid(code), host)
      return isCancelled() ? null : applyThemeStyles(svg)
    } catch (error) {
      document.getElementById(id)?.remove()
      throw error
    } finally {
      host.remove()
    }
  })
  renderQueue = result.then(() => {}, () => {})
  return result
}
