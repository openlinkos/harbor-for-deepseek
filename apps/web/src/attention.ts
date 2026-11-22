// Official attention tokenizer (default-vendors.a63ee0213e.js t1, offset 582841).
// Stock micromark only treats a marker run as flanking when punctuation on one
// side is paired with whitespace or punctuation on the other:
//   open  = !after || (after === punct && before)
//   close = !before || (before === punct && after)
// The official patch drops the opposite-side check for `*`:
//   open  = !after || after === punct || marker
//   close = !before || before === punct || marker
// so `**50%**左右` and `**33°**C左右` close. `_` keeps the stricter rule.
// SP-MD-424.

type Code = number | null
type State = (code: Code) => State | void
type Point = { offset: number; column: number; _bufferIndex?: number }
type Token = { type: string; start?: Point; end?: Point; _open?: boolean; _close?: boolean }
type Resolve = (events: Event[], context: ResolveContext) => Event[]
type Event = ['enter' | 'exit', Token, ResolveContext]
type ResolveContext = {
  sliceSerialize: (token: Token, expand?: boolean) => string
  parser: { constructs: { insideSpan: { null: Array<{ resolveAll?: Resolve }> } } }
}
type Effects = {
  enter: (type: string) => Token
  exit: (type: string) => Token
  consume: (code: Code) => void
}
type AttentionThis = {
  previous: Code
  parser: { constructs: { attentionMarkers: { null: number[] } } }
}

type ProcessorData = { micromarkExtensions?: unknown[] }

const ASTERISK = 42
const UNDERSCORE = 95

const classify = (code: Code): 1 | 2 | undefined => {
  if (code === null || code < 0 || code === 32) return 1
  const char = String.fromCharCode(code)
  if (/\s/.test(char)) return 1
  if (/\p{P}|\p{S}/u.test(char)) return 2
  return undefined
}

const movePoint = (point: Point, offset: number) => {
  point.column += offset
  point.offset += offset
  point._bufferIndex = (point._bufferIndex ?? 0) + offset
}

const spliceEvents = (list: Event[], start: number, remove: number, items: Event[]) => {
  const end = list.length
  let at = start < 0 ? Math.max(0, end + start) : Math.min(start, end)
  const count = remove > 0 ? remove : 0
  if (items.length < 10000) {
    list.splice(at, count, ...items)
    return
  }
  if (count) list.splice(at, count)
  for (let chunk = 0; chunk < items.length; chunk += 10000) {
    const slice = items.slice(chunk, chunk + 10000)
    list.splice(at, 0, ...slice)
    at += slice.length
  }
}

const pushEvents = (list: Event[], items: Event[]) => {
  if (!list.length) return items
  spliceEvents(list, list.length, 0, items)
  return list
}

const callResolve = (constructs: Array<{ resolveAll?: Resolve }>, events: Event[], context: ResolveContext) => {
  const called: Resolve[] = []
  let index = -1
  while (++index < constructs.length) {
    const resolve = constructs[index]?.resolveAll
    if (resolve && !called.includes(resolve)) {
      events = resolve(events, context)
      called.push(resolve)
    }
  }
  return events
}

function resolveAllAttention(events: Event[], context: ResolveContext) {
  let index = -1
  while (++index < events.length) {
    const closer = events[index]
    if (!closer || closer[0] !== 'enter' || closer[1].type !== 'attentionSequence' || !closer[1]._close) continue
    let open = index
    while (open--) {
      const opener = events[open]
      if (!opener || opener[0] !== 'exit' || opener[1].type !== 'attentionSequence' || !opener[1]._open) continue
      if (context.sliceSerialize(opener[1]).charCodeAt(0) !== context.sliceSerialize(closer[1]).charCodeAt(0)) continue
      const openSize = (opener[1].end?.offset ?? 0) - (opener[1].start?.offset ?? 0)
      const closeSize = (closer[1].end?.offset ?? 0) - (closer[1].start?.offset ?? 0)
      if ((opener[1]._close || closer[1]._open) && closeSize % 3 && !((openSize + closeSize) % 3)) continue
      const use = openSize > 1 && closeSize > 1 ? 2 : 1
      const openingEnd = opener[1].end
      const closingStart = closer[1].start
      if (!openingEnd || !closingStart) continue
      const start = { ...openingEnd }
      const end = { ...closingStart }
      movePoint(start, -use)
      movePoint(end, use)
      const sequence = use > 1 ? 'strongSequence' : 'emphasisSequence'
      const textType = use > 1 ? 'strongText' : 'emphasisText'
      const groupType = use > 1 ? 'strong' : 'emphasis'
      const openingSequence: Token = { type: sequence, start, end: { ...openingEnd } }
      const closingSequence: Token = { type: sequence, start: { ...closingStart }, end }
      const text: Token = { type: textType, start: { ...openingEnd }, end: { ...closingStart } }
      const group: Token = { type: groupType, start: { ...openingSequence.start }, end: { ...closingSequence.end } }
      opener[1].end = { ...start }
      closer[1].start = { ...end }
      let next: Event[] = []
      if ((opener[1].end?.offset ?? 0) - (opener[1].start?.offset ?? 0)) {
        next = pushEvents(next, [['enter', opener[1], context], ['exit', opener[1], context]])
      }
      next = pushEvents(next, [
        ['enter', group, context],
        ['enter', openingSequence, context],
        ['exit', openingSequence, context],
        ['enter', text, context],
      ])
      next = pushEvents(next, callResolve(context.parser.constructs.insideSpan.null, events.slice(open + 1, index), context))
      next = pushEvents(next, [
        ['exit', text, context],
        ['enter', closingSequence, context],
        ['exit', closingSequence, context],
        ['exit', group, context],
      ])
      let offset = 0
      if ((closer[1].end?.offset ?? 0) - (closer[1].start?.offset ?? 0)) {
        offset = 2
        next = pushEvents(next, [['enter', closer[1], context], ['exit', closer[1], context]])
      }
      spliceEvents(events, open - 1, index - open + 3, next)
      index = open + next.length - offset - 2
      break
    }
  }
  let left = -1
  while (++left < events.length) {
    const event = events[left]
    if (event && event[1].type === 'attentionSequence') event[1].type = 'data'
  }
  return events
}

function tokenizeAttention(this: AttentionThis, effects: Effects, ok: State): State {
  const markers = this.parser.constructs.attentionMarkers.null
  const previous = this.previous
  const before = classify(previous)
  let marker = 0
  return start

  function start(code: Code): State | void {
    marker = code ?? 0
    effects.enter('attentionSequence')
    return inside(code)
  }

  function inside(code: Code): State | void {
    if (code === marker) {
      effects.consume(code)
      return inside
    }
    const token = effects.exit('attentionSequence')
    const after = classify(code)
    // vendors t1: punctuation on the inside is enough. `*` and `_` stay attention markers.
    const open = !after || after === 2 || (code !== null && markers.includes(code))
    const close = !before || before === 2 || (previous !== null && markers.includes(previous))
    token._open = Boolean(marker === ASTERISK ? open : open && (before || !close))
    token._close = Boolean(marker === ASTERISK ? close : close && (after || !open))
    return ok(code)
  }
}

const deepseekAttentionConstruct = {
  name: 'deepseekAttention',
  tokenize: tokenizeAttention,
  resolveAll: resolveAllAttention,
}

export function remarkDeepseekAttention(this: { data: () => unknown }) {
  const data = this.data() as ProcessorData
  const micromarkExtensions = data.micromarkExtensions ?? []
  data.micromarkExtensions = micromarkExtensions
  micromarkExtensions.push({
    text: { [ASTERISK]: deepseekAttentionConstruct, [UNDERSCORE]: deepseekAttentionConstruct },
  })
}
