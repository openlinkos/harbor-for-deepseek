import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import 'katex/dist/katex.min.css'
import type { TextCitation } from '@harbor/types'
import { Children, Component, useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('go', go)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('yaml', yaml)

const highlight = (language: string | undefined, value: string) => {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(value, { language }).value
  }
  return hljs.highlightAuto(value).value
}

const Mermaid = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    void import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
      const id = `m-${Math.random().toString(36).slice(2)}`
      try {
        const { svg } = await mermaid.render(id, chart)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch {
        if (!cancelled) {
          setFailed(true)
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [chart])
  if (failed) {
    return <pre className="code-fallback">{chart}</pre>
  }
  return <div className="mermaid" ref={ref} />
}

const CodeBlock = ({ language, value }: { language?: string; value: string }) => {
  const html = highlight(language, value)
  const [copied, setCopied] = useState(false)
  const download = () => {
    const blob = new Blob([value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `harbor.${language || 'txt'}`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="code-card">
      <div className="code-head">
        <span>{(language || 'text').toLowerCase()}</span>
        <span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(value).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1200)
              })
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={download}>
            Download
          </button>
        </span>
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}

class Boundary extends Component<{ text: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return <pre className="code-fallback">{this.props.text}</pre>
    }
    return this.props.children
  }
}

const citeChildren = (children: ReactNode, citations?: TextCitation[]) =>
  Children.map(children, (child) => {
    if (typeof child !== 'string' || !child.includes('〔')) {
      return child
    }
    return child.split(/(〔\d+〕)/g).map((bit, index) => {
      const match = /^〔(\d+)〕$/.exec(bit)
      const citation = match ? citations?.[Number(match[1]) - 1] : undefined
      if (!match || !citation) {
        return bit
      }
      return (
        <span className="cite" key={`${citation.url}-${index}`}>
          {match[1]}
          <span className="hover-card">
            <strong>{citation.title || citation.url}</strong>
            <p>{citation.cited_text}</p>
          </span>
        </span>
      )
    })
  })

export const Markdown = ({ text, citations }: { text: string; citations?: TextCitation[] }) => (
  <Boundary text={text}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p({ children }) {
          return <p>{citeChildren(children, citations)}</p>
        },
        a({ href, children }) {
          const safe = href && /^https?:\/\//i.test(href) ? href : undefined
          return (
            <a href={safe} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          )
        },
        code({ className, children }) {
          const value = String(children).replace(/\n$/, '')
          const language = /language-([\w-]+)/.exec(className ?? '')?.[1]
          if (!className) {
            return <code className="inline-code">{children}</code>
          }
          if (language === 'mermaid') {
            return <Mermaid chart={value} />
          }
          return <CodeBlock language={language} value={value} />
        },
      }}
    >
      {text}
    </ReactMarkdown>
  </Boundary>
)
