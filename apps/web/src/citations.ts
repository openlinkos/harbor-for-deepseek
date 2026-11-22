import type { ContentBlock, TextBlock, TextCitation } from '@deepapi/types'
import type { SearchCiteCard, SearchCiteSource } from './blocks.js'

/**
 * One answer is one markdown document. Text blocks are concatenated and each
 * citation `at` (code units into its own block) is shifted onto that document.
 */
const shiftCitations = (text: string, block: TextBlock, into: TextCitation[]) => {
  const start = text.length
  for (const citation of block.citations ?? []) {
    if (typeof citation.at !== 'number' || !Number.isFinite(citation.at)) {
      into.push({ ...citation })
      continue
    }
    const local = Math.max(0, Math.min(citation.at, block.text.length))
    into.push({ ...citation, at: start + local })
  }
}

export const joinTextBlocks = (blocks: TextBlock[]): { text: string; citations: TextCitation[] } => {
  let text = ''
  const citations: TextCitation[] = []
  for (const block of blocks) {
    shiftCitations(text, block, citations)
    text += block.text
  }
  return { text, citations }
}

/** Text blocks with a thinking or tool block between them stay separate paragraphs. */
export const joinAnswerText = (blocks: ContentBlock[]): { text: string; citations: TextCitation[] } => {
  let text = ''
  const citations: TextCitation[] = []
  let seenText = false
  let gap = false
  for (const block of blocks) {
    if (block.type !== 'text') {
      if (seenText) gap = true
      continue
    }
    if (seenText && gap) text += '\n\n'
    shiftCitations(text, block, citations)
    text += block.text
    seenText = true
    gap = false
  }
  return { text, citations }
}

// Only while streaming. A finished answer may end in `[c` or `[r`.
const PARTIAL_MARKERS = ['[citation:', '[citation', '[citatio', '[citati', '[citat', '[cita', '[cit', '[ci', '[c', '[reference:', '[reference', '[referenc', '[referen', '[refere', '[refer', '[refe', '[ref', '[re', '[r']

const fenceIsOpen = (text: string): boolean => {
  let marker = ''
  for (const line of text.split('\n')) {
    const found = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line)
    if (!found) continue
    const token = found[2] ?? ''
    const rest = found[3] ?? ''
    if (!marker) {
      marker = token
      continue
    }
    if (token[0] === marker[0] && token.length >= marker.length && rest.trim() === '') marker = ''
  }
  return marker.length > 0
}

// While streaming, an unclosed `\(` / `\[` is closed so KaTeX can draw the partial formula the way an unclosed `$$` already does.
// A bare opener with no body is dropped, so the raw delimiter does not flash before the formula arrives.
const closePartialTex = (text: string): string => {
  if (fenceIsOpen(text)) return text
  let fence = ''
  let ticks = 0
  const stack: { at: number; close: string }[] = []
  for (let i = 0; i < text.length; i++) {
    const lineStart = i === 0 || text[i - 1] === '\n'
    if (fence) {
      if (!lineStart) continue
      const found = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(text.slice(i).split('\n')[0] ?? '')
      if (found && found[2]?.[0] === fence[0] && (found[2]?.length ?? 0) >= fence.length && (found[3] ?? '').trim() === '') {
        fence = ''
        i += (found[1]?.length ?? 0) + (found[2]?.length ?? 0) - 1
      }
      continue
    }
    if (ticks) {
      if (text.startsWith('`'.repeat(ticks), i)) {
        i += ticks - 1
        ticks = 0
      }
      continue
    }
    if (lineStart) {
      const found = /^( {0,3})(`{3,}|~{3,})/.exec(text.slice(i))
      if (found?.[2]) {
        fence = found[2]
        i += found[0].length - 1
        continue
      }
    }
    if (text[i] === '`') {
      let n = 1
      while (text[i + n] === '`') n++
      ticks = n
      i += n - 1
      continue
    }
    const next = text[i + 1]
    if (text[i] !== '\\' || (next !== '(' && next !== '[' && next !== ')' && next !== ']')) continue
    if (text[i - 1] === '\\') {
      i += 1
      continue
    }
    if (next === '(' || next === '[') stack.push({ at: i, close: next === '(' ? '\\)' : '\\]' })
    else {
      const want = next === ')' ? '\\)' : '\\]'
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s]?.close === want) {
          stack.splice(s, 1)
          break
        }
      }
    }
    i += 1
  }
  const opener = stack[0]
  if (!opener) return text
  const body = text.slice(opener.at + 2)
  if (!body.trim()) return text.slice(0, opener.at)
  return text + opener.close
}

/** Keep `[citation:N]` inside `\(...\)` and `\[...\]` literal. CommonMark would otherwise drop the backslash before we see the text node. */
export const holdDelimitedMath = (text: string, streaming = false): string => {
  const prepared = streaming ? closePartialTex(text) : text
  return prepared.replace(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g, (full) => full.replace(/\[(citation|reference):(\d+)\]/g, 'CITEHOLD$2'))
}

const restoreHeld = (node: MdNode) => {
  const put = (value: string) => value.replace(/CITEHOLD(\d+)/g, '[citation:$1]')
  if (typeof node.value === 'string') node.value = put(node.value)
  node.data?.hChildren?.forEach((child) => {
    if (typeof child.value === 'string') child.value = put(child.value)
  })
  node.children?.forEach(restoreHeld)
}

export const stripPartialCitation = (text: string, streaming = false): string => {
  if (!streaming || fenceIsOpen(text)) return text
  const body = text.trimEnd()
  const trail = text.slice(body.length)
  if (/\[(?:citation|reference):\d*$/.test(body)) return body.replace(/\[(?:citation|reference):\d*$/, '') + trail
  const marker = PARTIAL_MARKERS.find((prefix) => body.endsWith(prefix))
  if (!marker) return text
  return body.slice(0, -marker.length) + trail
}

const rawAt = (text: string, citation: TextCitation): number => {
  if (typeof citation.at === 'number' && Number.isFinite(citation.at)) {
    return Math.max(0, Math.min(Math.floor(citation.at), text.length))
  }
  const needle = citation.cited_text.trim()
  if (needle) {
    const found = text.indexOf(needle)
    if (found >= 0) return Math.min(text.length, found + needle.length)
  }
  return text.length
}

const rewriteLegacyMarks = (text: string, citations: TextCitation[]): string => {
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part
      return part.replace(/〔(\d+)〕/g, (full, raw: string) => {
        const n = Number(raw)
        return citations[n - 1] ? `[citation:${n}]` : full
      })
    })
    .join('')
}

export type ComposedCitations = {
  text: string
  citations: TextCitation[]
  cards: SearchCiteCard[]
}

/**
 * Insert `[citation:N]` for search hits (N is the 1-based result index).
 * Without search results, only an existing 〔n〕 becomes `[citation:n]`;
 * plain "(1)" and "[2]" are left alone.
 */
export const composeCitationMarkdown = (
  text: string,
  citations: TextCitation[] | undefined,
  sources: SearchCiteSource[],
  streaming = false,
): ComposedCitations => {
  const cleaned = stripPartialCitation(text, streaming)
  const list = citations ?? []
  if (!list.length || sources.length === 0) {
    return {
      text: list.length ? rewriteLegacyMarks(cleaned, list) : cleaned,
      citations: list,
      cards: [],
    }
  }
  const aligned: TextCitation[] = []
  const cards: SearchCiteCard[] = []
  const inserts: { at: number; n: number }[] = []
  for (const citation of list) {
    const index = sources.findIndex((item) => item.url === citation.url)
    if (index < 0) continue
    const source = sources[index]
    if (!source) continue
    const title = source.title || citation.title || citation.url
    aligned[index] = { ...citation, title }
    cards[index] = {
      title,
      site: source.site,
      snippet: source.snippet ?? '',
      date: source.date,
      icon: source.icon ?? null,
      url: source.url,
    }
    inserts.push({ at: rawAt(cleaned, citation), n: index + 1 })
  }
  inserts.sort((a, b) => a.at - b.at || a.n - b.n)
  const unique: { at: number; n: number }[] = []
  for (const insert of inserts) {
    const previous = unique.at(-1)
    if (previous && previous.at === insert.at && previous.n === insert.n) continue
    unique.push(insert)
  }
  let marked = cleaned
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const insert = unique[index]
    if (!insert) continue
    marked = `${marked.slice(0, insert.at)}[citation:${insert.n}]${marked.slice(insert.at)}`
  }
  return { text: marked, citations: aligned, cards }
}

export const citationNumbers = (citations?: TextCitation[]): Set<number> => {
  const valid = new Set<number>()
  citations?.forEach((item, index) => {
    if (item) valid.add(index + 1)
  })
  return valid
}

type MdNode = {
  type: string
  value?: string
  n?: number
  children?: MdNode[]
  data?: { hName?: string; hProperties?: Record<string, string>; hChildren?: Array<{ type?: string; value?: string }> }
}

const CONTAINERS = new Set(['paragraph', 'heading', 'tableCell'])
const OPAQUE = new Set(['code', 'inlineCode', 'math', 'inlineMath', 'html', 'yaml'])
const MARK = /\[(?:citation|reference):(\d+)\]/g

const citationNode = (n: number): MdNode => ({
  type: 'citation',
  n,
  children: [],
  data: { hName: 'citation', hProperties: { n: String(n) } },
})

const groupNode = (children: MdNode[]): MdNode => ({
  type: 'citationGroup',
  children,
  data: { hName: 'citation-group' },
})

const dedupe = (nodes: MdNode[]): MdNode[] => {
  const seen = new Set<number>()
  const out: MdNode[] = []
  for (const node of nodes) {
    const n = node.n ?? -1
    if (seen.has(n)) continue
    seen.add(n)
    out.push(node)
  }
  return out
}

const mathSpans = (value: string): Array<[number, number]> => {
  const spans: Array<[number, number]> = []
  const re = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(value))) spans.push([match.index, match.index + match[0].length])
  return spans
}

const inSpan = (spans: Array<[number, number]>, index: number) => spans.some(([start, end]) => index >= start && index < end)

const replaceDirectMarkers = (node: MdNode, allowed?: ReadonlySet<number>) => {
  if (!node.children) return
  const next: MdNode[] = []
  for (const child of node.children) {
    if (child.type !== 'text' || !child.value || !/\[(?:citation|reference):\d+\]/.test(child.value)) {
      next.push(child)
      continue
    }
    const spans = mathSpans(child.value)
    const re = new RegExp(MARK.source, 'g')
    let last = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(child.value))) {
      const n = Number(match[1])
      const keep = inSpan(spans, match.index) || (allowed && !allowed.has(n))
      if (match.index > last) next.push({ type: 'text', value: child.value.slice(last, match.index) })
      if (keep) next.push({ type: 'text', value: match[0] })
      else next.push(citationNode(n))
      last = match.index + match[0].length
    }
    if (last < child.value.length) next.push({ type: 'text', value: child.value.slice(last) })
  }
  node.children = next
}

type Piece =
  | { kind: 'cite'; node: MdNode; parent: MdNode }
  | { kind: 'bound'; node: MdNode; parent: MdNode }
  | { kind: 'other' }

const splitNewlines = (node: MdNode) => {
  if (!node.children || OPAQUE.has(node.type)) return
  const next: MdNode[] = []
  for (const child of node.children) {
    splitNewlines(child)
    if (child.type === 'text' && child.value?.includes('\n')) {
      const parts = child.value.split('\n')
      parts.forEach((part, index) => {
        if (index > 0) next.push({ type: 'text', value: '\n' })
        if (part) next.push({ type: 'text', value: part })
      })
      continue
    }
    next.push(child)
  }
  node.children = next
}

const linearize = (node: MdNode, parent: MdNode | null, out: Piece[]) => {
  if (node.type === 'text' && node.value === '\n' && parent) {
    out.push({ kind: 'bound', node, parent })
    return
  }
  if ((node.type === 'break' || node.type === 'officialBreak') && parent) {
    out.push({ kind: 'bound', node, parent })
    return
  }
  if (node.type === 'citation' && parent) {
    out.push({ kind: 'cite', node, parent })
    return
  }
  if (!node.children || OPAQUE.has(node.type) || node.type === 'citationGroup') return
  if (parent && CONTAINERS.has(node.type)) return
  for (const child of node.children) linearize(child, node, out)
}

const removeNode = (parent: MdNode, node: MdNode) => {
  const index = parent.children?.indexOf(node) ?? -1
  if (index >= 0) parent.children?.splice(index, 1)
}

const insertBefore = (parent: MdNode, before: MdNode, node: MdNode) => {
  const index = parent.children?.indexOf(before) ?? -1
  if (!parent.children) return
  if (index >= 0) parent.children.splice(index, 0, node)
  else parent.children.push(node)
}

const prune = (node: MdNode) => {
  if (!node.children || OPAQUE.has(node.type)) return
  const next: MdNode[] = []
  for (const child of node.children) {
    if (child.type !== 'text' && child.type !== 'citation' && child.type !== 'citationGroup' && child.type !== 'break') prune(child)
    const prev = next.at(-1)
    if (child.type === 'text' && prev?.type === 'text' && prev.value !== '\n' && child.value !== '\n') {
      prev.value = `${prev.value ?? ''}${child.value ?? ''}`
      continue
    }
    if (child.type === 'text' && !child.value) continue
    if ((child.type === 'strong' || child.type === 'emphasis' || child.type === 'delete') && !child.children?.length) continue
    next.push(child)
  }
  node.children = next
}

/** One line, one group. A break keeps the group in front of it; the last line ends the block. */
const aggregateContainer = (container: MdNode) => {
  if (!container.children) return
  splitNewlines(container)
  const pieces: Piece[] = []
  linearize(container, null, pieces)
  const lines: Array<{ cites: Extract<Piece, { kind: 'cite' }>[]; bound: Extract<Piece, { kind: 'bound' }> | null }> = []
  let cites: Extract<Piece, { kind: 'cite' }>[] = []
  for (const piece of pieces) {
    if (piece.kind === 'bound') {
      lines.push({ cites, bound: piece })
      cites = []
      continue
    }
    if (piece.kind === 'cite') cites.push(piece)
  }
  lines.push({ cites, bound: null })
  for (const line of lines) {
    if (!line.cites.length) continue
    const unique = dedupe(line.cites.map((item) => item.node))
    for (const item of line.cites) removeNode(item.parent, item.node)
    const group = groupNode(unique)
    if (line.bound) insertBefore(line.bound.parent, line.bound.node, group)
    else container.children.push(group)
  }
  prune(container)
}

const visit = (node: MdNode, allowed?: ReadonlySet<number>) => {
  if (!node.children || OPAQUE.has(node.type) || node.type === 'citationGroup') return
  for (const child of [...node.children]) visit(child, allowed)
  replaceDirectMarkers(node, allowed)
  if (CONTAINERS.has(node.type)) aggregateContainer(node)
  if (node.type === 'root') restoreHeld(node)
}

/** `[citation:N]` / `[reference:N]` in text nodes become inline citations, then one group per line. */
export function remarkCitations(valid?: ReadonlySet<number>) {
  return () => (tree: unknown) => {
    visit(tree as MdNode, valid)
  }
}
