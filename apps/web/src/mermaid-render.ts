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
      return isCancelled() ? null : svg
    } catch (error) {
      document.getElementById(id)?.remove()
      throw error
    }
  })
  renderQueue = result.then(() => {}, () => {})
  return result
}
