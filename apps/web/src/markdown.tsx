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
import type { TextCitation } from '@deepapi/types'
import { Children, Component, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { SearchCiteCard } from './blocks.js'
import { citationNumbers, holdDelimitedMath, remarkCitations, stripPartialCitation } from './citations.js'
import ReactMarkdown, { type Components } from 'react-markdown'
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

const OPEN_MS = 300
const CLOSE_MS = 100

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const CiteIcon = ({ label, icon }: { label: string; icon?: string | null }) => {
  const src = typeof icon === 'string' ? icon.trim() : ''
  const [failed, setFailed] = useState(false)
  const letter = (label.trim().slice(0, 1) || '?').toUpperCase()
  if (!src || failed) {
    return <i className="search-view-card__icon" aria-hidden="true">{letter}</i>
  }
  return (
    <i className="search-view-card__icon" aria-hidden="true">
      <img src={src} alt="" onError={() => setFailed(true)} />
    </i>
  )
}

const CiteCardBody = ({ card }: { card: SearchCiteCard }) => (
  <>
    <span className="search-view-card__meta">
      <CiteIcon label={card.site || card.title} icon={card.icon} />
      <span className="search-view-card__site">{card.site}</span>
      {card.date ? (
        <>
          <span className="search-view-card__rule" aria-hidden="true" />
          <span className="search-view-card__date">{card.date}</span>
        </>
      ) : null}
    </span>
    <span className="search-view-card__title">{card.title}</span>
    {card.snippet ? <span className="search-view-card__snippet">{card.snippet}</span> : null}
  </>
)

const placeCard = (badge: DOMRect, card: DOMRect) => {
  const margin = 8
  const width = Math.min(card.width, window.innerWidth - margin * 2)
  let left = badge.left
  if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width
  if (left < margin) left = margin
  let top = badge.top - margin - card.height
  if (top < margin) top = badge.bottom + margin
  const coversBadge = top < badge.bottom && top + card.height > badge.top && left < badge.right && left + width > badge.left
  if (coversBadge) top = badge.bottom + margin
  return { left, top }
}

const CiteMark = ({ n, href, card }: { n: string; href?: string; card: SearchCiteCard }) => {
  const anchor = useRef<HTMLElement | null>(null)
  const float = useRef<HTMLElement | null>(null)
  const openTimer = useRef(0)
  const closeTimer = useRef(0)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const place = () => {
    const badge = anchor.current?.getBoundingClientRect()
    const layer = float.current?.getBoundingClientRect()
    if (!badge || !layer) return
    setPos(placeCard(badge, layer))
  }
  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open, card])
  useEffect(() => {
    if (!open) return
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])
  useEffect(() => () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }, [])
  const show = () => {
    window.clearTimeout(closeTimer.current)
    if (open) return
    window.clearTimeout(openTimer.current)
    openTimer.current = window.setTimeout(() => setOpen(true), OPEN_MS)
  }
  const hide = () => {
    window.clearTimeout(openTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      setPos(null)
    }, CLOSE_MS)
  }
  const className = n.length > 1 ? 'cite wide' : 'cite'
  const badge = href ? (
    <a
      ref={(node) => { anchor.current = node }}
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {n}
    </a>
  ) : (
    <span ref={(node) => { anchor.current = node }} className={className} onMouseEnter={show} onMouseLeave={hide}>
      {n}
    </span>
  )
  const layer = open
    ? createPortal(
        href ? (
          <a
            ref={(node) => { float.current = node }}
            className="search-view-card"
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <CiteCardBody card={card} />
          </a>
        ) : (
          <span
            ref={(node) => { float.current = node }}
            className="search-view-card"
            style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <CiteCardBody card={card} />
          </span>
        ),
        document.body,
      )
    : null
  return (
    <>
      {badge}
      {layer}
    </>
  )
}

const cardFor = (n: number, citations?: TextCitation[], cards?: SearchCiteCard[]): SearchCiteCard => {
  const known = cards?.[n - 1]
  if (known) return known
  const citation = citations?.[n - 1]
  return {
    title: citation?.title || citation?.url || '',
    site: citation ? hostOf(citation.url) : '',
    snippet: citation?.cited_text ?? '',
    url: citation?.url ?? '',
    icon: null,
  }
}

const citeMarkFor = (value: number, citations: TextCitation[] | undefined, cards: SearchCiteCard[] | undefined) => {
  const citation = citations?.[value - 1]
  const href = citation && /^https?:\/\//i.test(citation.url) ? citation.url : undefined
  return <CiteMark n={String(value)} href={href} card={cardFor(value, citations, cards)} />
}

const readCiteNumber = (n: string | number | undefined, node?: { properties?: { n?: string | number } }) =>
  Number(n ?? node?.properties?.n)

const CiteContext = createContext<{ citations?: TextCitation[]; cards?: SearchCiteCard[] }>({})

const CitationView = ({ n, node }: { n?: string | number; node?: { properties?: { n?: string | number } } }) => {
  const { citations, cards } = useContext(CiteContext)
  const value = readCiteNumber(n, node)
  if (!Number.isFinite(value) || value <= 0) return null
  return citeMarkFor(value, citations, cards)
}

const CitationGroupView = ({ children }: { children?: ReactNode }) => (
  <span data-citation-group="">{children}</span>
)

const PHRASING = new Set(['a', 'abbr', 'b', 'br', 'cite', 'code', 'em', 'i', 'img', 'kbd', 'mark', 's', 'small', 'span', 'strong', 'sub', 'sup', 'u'])
const isPhrasing = (node: ReactNode) => typeof node === 'string' || typeof node === 'number' || (isValidElement(node) && ((typeof node.type === 'string' && PHRASING.has(node.type)) || node.type === CitationGroupView))
// Official answers put each list item's text in a paragraph. The paragraph's margin is what opens the gap before a nested list.
const itemBlocks = (children: ReactNode) => {
  const nodes = Children.toArray(children)
  const out: ReactNode[] = []
  let inline: ReactNode[] = []
  const flush = () => {
    const text = inline.some((node) => typeof node !== 'string' || node.trim() !== '')
    if (text) {
      if (inline.length === 1 && isValidElement(inline[0]) && inline[0].type === 'p') out.push(inline[0])
      else out.push(<p key={out.length}>{inline}</p>)
    }
    inline = []
  }
  for (const node of nodes) {
    if (isPhrasing(node)) inline.push(node)
    else {
      flush()
      out.push(node)
    }
  }
  flush()
  return out
}

const components = {
  citation: CitationView,
  'citation-group': CitationGroupView,
  li({ children }: { children?: ReactNode }) {
    return <li>{itemBlocks(children)}</li>
  },
  a({ href, children }: { href?: string; children?: ReactNode }) {
    const safe = href && /^https?:\/\//i.test(href) ? href : undefined
    return (
      <a href={safe} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    )
  },
  code({ className, children }: { className?: string; children?: ReactNode }) {
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
  img({ src, alt }: { src?: string; alt?: string }) {
    const safe = src && (/^https:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) ? src : undefined
    return <img className="md-img" src={safe} alt={alt ?? ''} />
  },
} as unknown as Components

export const Markdown = ({ text, citations, cards, streaming = false }: { text: string; citations?: TextCitation[]; cards?: SearchCiteCard[]; streaming?: boolean }) => (
  <CiteContext.Provider value={{ citations, cards }}>
    <Boundary text={text}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkCitations(citationNumbers(citations))]} rehypePlugins={[rehypeKatex]} components={components}>
        {holdDelimitedMath(stripPartialCitation(text, streaming))}
      </ReactMarkdown>
    </Boundary>
    </CiteContext.Provider>
)
