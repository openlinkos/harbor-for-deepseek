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

const label = (zh: string, en: string) => (document.documentElement.lang === 'en' ? en : zh)

const BOX = /[┌┐└┘├┤┬┴┼─│╔╗╚╝╠╣╦╩╬═║╭╮╯╰]/

const Mermaid = ({ chart }: { chart: string }) => {
  const view = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<'chart' | 'code'>('chart')
  const [zoom, setZoom] = useState(1)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    void import('mermaid').then(async ({ default: mermaid }) => {
      const dark = document.body.hasAttribute('data-ds-dark-theme')
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'neutral' })
      const id = `m-${Math.random().toString(36).slice(2)}`
      try {
        const { svg } = await mermaid.render(id, chart)
        if (!cancelled && view.current) {
          view.current.innerHTML = svg
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
  const download = () => {
    const svg = view.current?.querySelector('svg')
    if (!svg) {
      return
    }
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'diagram.svg'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="diagram-card" data-testid="mermaid-card" ref={card}>
      <div className="diagram-bar">
        <div className="diagram-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'chart'} className={tab === 'chart' ? 'on' : ''} onClick={() => setTab('chart')}>{label('图表', 'Diagram')}</button>
          <button type="button" role="tab" aria-selected={tab === 'code'} className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}>{label('代码', 'Code')}</button>
        </div>
        <div className="diagram-tools">
          {tab === 'chart' ? (
            <>
              <button type="button" aria-label={label('缩小', 'Zoom out')} onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(2))))}>−</button>
              <button type="button" aria-label={label('放大', 'Zoom in')} onClick={() => setZoom((value) => Math.min(2, Number((value + 0.1).toFixed(2))))}>+</button>
            </>
          ) : (
            <button type="button" onClick={() => void navigator.clipboard.writeText(chart)}>{label('复制', 'Copy')}</button>
          )}
          <button type="button" aria-label={label('下载', 'Download')} onClick={() => setMenu((value) => !value)}>{label('下载', 'Download')}</button>
          {menu ? (
            <div className="menu diagram-menu">
              <button type="button" onClick={() => { setMenu(false); download() }}>{label('下载 SVG', 'Download SVG')}</button>
              <button type="button" onClick={() => { setMenu(false); download() }}>{label('下载 PNG', 'Download PNG')}</button>
            </div>
          ) : null}
          <button type="button" aria-label={label('全屏', 'Full screen')} onClick={() => void card.current?.requestFullscreen?.()}>{label('全屏', 'Full screen')}</button>
        </div>
      </div>
      {failed ? <pre className="diagram-source"><code>{chart}</code></pre> : null}
      <pre className="diagram-source" hidden={failed || tab !== 'code'}><code>{chart}</code></pre>
      <div className="diagram-view" hidden={failed || tab !== 'chart'}>
        <div className="mermaid" ref={view} style={{ transform: `scale(${zoom})` }} />
      </div>
    </div>
  )
}

const CodeBlock = ({ language, value }: { language?: string; value: string }) => {
  const html = highlight(language, value)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const long = value.split('\n').length > 18
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
      <div className="code-sticky">
      <div className="code-head">
        <div className="code-bar">
        <span>{(language || 'text').toLowerCase()}</span>
        <span className="code-tools">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(value).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1200)
              })
            }}
          >
            <svg width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4.2" y="3.2" width="7.2" height="9.6" rx="1.2" /><path d="M2.6 11.2V2.8h6.2" /></svg>
            <span>{copied ? '✓' : label('复制', 'Copy')}</span>
          </button>
          <button type="button" aria-label={label('下载', 'Download')} onClick={download}>
            <svg width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 2.5v7.2M4.2 7.2 7 10l2.8-2.8M2.5 13h9" /></svg>
            <span>{label('下载', 'Download')}</span>
          </button>
        </span>
        </div>
      </div>
      </div>
      <pre className={long && !expanded ? 'collapsed' : ''}>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      <svg className="code-corner" width="12" height="12" aria-hidden="true" />
      <svg className="code-corner end" width="12" height="12" aria-hidden="true" />
      {long ? (
        <button type="button" className="code-fold" onClick={() => setExpanded((open) => !open)}>
          {expanded ? label('收起', 'Collapse') : label('展开', 'Expand')}
        </button>
      ) : null}
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
    if (typeof child !== 'string' || !(/〔\d+〕|\[\d+\]|\(\d+\)/.test(child))) {
      return child
    }
    return child.split(/(〔\d+〕|\[\d+\]|\(\d+\))/g).map((bit, index) => {
      const match = /^(?:〔|\[|\()(\d+)(?:〕|\]|\))$/.exec(bit)
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
        li({ children }) {
          return <li>{citeChildren(children, citations)}</li>
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
          const block = Boolean(className) || value.includes('\n')
          if (!block) {
            return <code className="inline-code">{children}</code>
          }
          if (language === 'mermaid') {
            return <Mermaid chart={value} />
          }
          if (BOX.test(value)) {
            return (
              <div className="code-card">
                <pre className="box-drawing"><code>{value}</code></pre>
              </div>
            )
          }
          return <CodeBlock language={language} value={value} />
        },
        img({ src, alt }) {
          const safe = src && (/^https:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) ? src : undefined
          return <img className="md-img" src={safe} alt={alt ?? ''} />
        },
      }}
    >
      {text}
    </ReactMarkdown>
  </Boundary>
)
