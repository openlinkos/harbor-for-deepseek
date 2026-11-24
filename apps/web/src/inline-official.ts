// Official inline renderers from main.5a15ff2247.js.
// Emphasis guard iZ (offset 325531): a `*` span whose text looks like a formula
// is echoed as literal asterisks, not <em>. SP-MD-424 family, md-0019..md-0026.
// Delete renderer lA (offset 351450) echoes the opening /^~+/ run and does not
// emit <del>. SP-MD-408.

type Node = {
  type: string
  value?: string
  children?: Node[]
  data?: { hName?: string; hChildren?: unknown[] }
  position?: { start?: { offset?: number }; end?: { offset?: number } }
}

const OPS = ['+', '-', '*', '/', '=']

const plain = (node: Node): string => {
  if (node.type === 'text') return node.value ?? ''
  if (node.type === 'emphasis' || node.type === 'strong') return (node.children ?? []).map(plain).join('')
  return ''
}

// Verbatim guard body: digits at both ends, a single lowercase letter, or mostly operators and digits.
const emphasisBlocked = (value: string): boolean => {
  if ((/^\d/.test(value) && /\d$/.test(value)) || /^[a-z]$/.test(value)) return true
  if (!OPS.some((op) => value.includes(op))) return false
  const tally = value.split('').reduce(
    (acc, ch) => {
      if (OPS.includes(ch)) return { op: acc.op + 1, digit: acc.digit }
      if (/\d/.test(ch)) return { op: acc.op, digit: acc.digit + 1 }
      return acc
    },
    { op: 0, digit: 0 },
  )
  return value.length - tally.op <= tally.op + tally.digit + 1
}

const markerAt = (node: Node, source: string) => {
  const offset = node.position?.start?.offset
  return offset === undefined ? '*' : (source[offset] ?? '*')
}

const tildes = (node: Node, source: string) => {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  if (start === undefined || end === undefined) return ''
  return /^~+/.exec(source.slice(start, end))?.[0] ?? ''
}

const text = (value: string): Node => ({ type: 'text', value })

// mdast-util-to-hast's `break` handler appends a `\n` text node after every <br>.
// Official text rendering (md-0491) is <br> with no extra whitespace, so this is
// a custom node that becomes <br> through data.hName.
const lineBreak = (): Node => ({ type: 'officialBreak', data: { hName: 'br', hChildren: [] } })

const splitBreaks = (node: Node) => {
  if (!node.children) return
  const next: Node[] = []
  for (const child of node.children) {
    splitBreaks(child)
    if (child.type === 'text' && child.value?.includes('\n')) {
      const parts = child.value.split('\n')
      parts.forEach((part, index) => {
        if (index) next.push(lineBreak())
        if (part) next.push(text(part))
      })
      continue
    }
    next.push(child)
  }
  node.children = next
}

const rewrite = (node: Node, source: string) => {
  if (!node.children) return
  for (const child of node.children) rewrite(child, source)
  for (let index = node.children.length - 1; index >= 0; index -= 1) {
    const child = node.children[index]
    if (!child) continue
    if (child.type === 'emphasis' && markerAt(child, source) === '*' && emphasisBlocked(plain(child))) {
      node.children.splice(index, 1, text('*'), ...(child.children ?? []), text('*'))
      continue
    }
    if (child.type === 'delete') {
      const marks = tildes(child, source)
      node.children.splice(index, 1, text(marks), ...(child.children ?? []), text(marks))
    }
  }
}

/** Run after the markdown tree is built and before citation nodes are split out. */
export const applyOfficialInline = (tree: Node, source: string) => {
  rewrite(tree, source)
  splitBreaks(tree)
}
