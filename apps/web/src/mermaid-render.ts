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
    const id = `deepapi-mermaid-${nextId++}`
    try {
      const { svg } = await mermaid.render(id, sanitizeMermaid(code))
      return isCancelled() ? null : applyThemeStyles(svg)
    } catch (error) {
      document.getElementById(id)?.remove()
      throw error
    }
  })
  renderQueue = result.then(() => {}, () => {})
  return result
}
