import katex from 'katex'
import { Children, type ReactNode } from 'react'
import { deepseekMath, deepseekMathFromMarkdown } from './math-syntax.js'

type ProcessorData = {
  micromarkExtensions?: unknown[]
  fromMarkdownExtensions?: unknown[]
}

export function remarkDeepseekMath(this: { data: () => unknown }) {
  const data = this.data() as ProcessorData
  const micromarkExtensions = data.micromarkExtensions ?? []
  data.micromarkExtensions = micromarkExtensions
  micromarkExtensions.push(deepseekMath())
  const fromMarkdownExtensions = data.fromMarkdownExtensions ?? []
  data.fromMarkdownExtensions = fromMarkdownExtensions
  fromMarkdownExtensions.push(deepseekMathFromMarkdown())
}

const textValue = (children: ReactNode) => {
  const parts: string[] = []
  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') parts.push(String(child))
  })
  return parts.join('')
}

const DISPLAY_OPEN = '<span class="katex-display">'
const INLINE_OPEN = '<span class="katex">'

// Official: renderToString({throwOnError:true, strict:false, displayMode:!inline}); on failure, the source text.
const renderMath = (value: string, display: boolean) => {
  try {
    const html = katex.renderToString(value, { throwOnError: true, strict: false, displayMode: display })
    const open = display ? DISPLAY_OPEN : INLINE_OPEN
    if (!html.startsWith(open) || !html.endsWith('</span>')) return value
    const inner = html.slice(open.length, -'</span>'.length)
    if (display) return <span className="katex-display ds-markdown-math" dangerouslySetInnerHTML={{ __html: inner }} />
    return <span className="katex" dangerouslySetInnerHTML={{ __html: inner }} />
  } catch {
    return value
  }
}

export const MathInline = ({ children }: { children?: ReactNode }) => <>{renderMath(textValue(children), false)}</>
export const MathBlock = ({ children }: { children?: ReactNode }) => <>{renderMath(textValue(children), true)}</>
