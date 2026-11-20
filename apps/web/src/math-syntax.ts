// Micromark math for chat.deepseek.com: block `$$` / `\[`, inline `$` / `$$` / `\(` / `\[`.
// A closing single `$` followed by a digit does not close, so "$5 和 $10" stays text.
// Token names match mdast-util-math so the from-markdown handlers below can read them.

type Code = number | null
type State = (code: Code) => State | void
type Token = { type: string; start?: unknown; end?: unknown; _rejected?: boolean }
type Event = ['enter' | 'exit', Token, { sliceSerialize: (token: Token, expand?: boolean) => string }]
type Ctx = {
  events: Event[]
  previous: Code
  interrupt?: boolean
  parser: { lazy: Record<number, boolean | undefined>; constructs: { disable: { null: string[] } } }
  now: () => { line: number }
}
type Effects = {
  enter: (type: string, fields?: Record<string, unknown>) => Token
  exit: (type: string) => Token
  consume: (code: Code) => void
  attempt: (construct: Construct, ok: State, nok: State) => State
}
type Construct = {
  tokenize: (this: Ctx, effects: Effects, ok: State, nok: State) => State
  partial?: boolean
  concrete?: boolean
  resolve?: (events: Event[]) => Event[]
  previous?: (this: Ctx, code: Code) => boolean
  name?: string
}
type Compile = {
  enter: (node: Mdast, token: unknown) => void
  exit: (token: unknown) => void
  buffer: () => void
  resume: () => string
  stack: Mdast[]
  data: { mathFlowInside?: boolean }
  config: {
    enter: { data: (this: Compile, token: unknown) => void }
    exit: { data: (this: Compile, token: unknown) => void }
  }
}
type Mdast = {
  type: string
  meta?: string | null
  value?: string
  data?: { hName?: string; hChildren?: Array<{ type: string; value: string }> }
  children?: Mdast[]
}

const DOLLAR = 36
const BACKSLASH = 92
const LBRACK = 91
const RBRACK = 93
const LPAREN = 40
const RPAREN = 41
const SPACE = 32

const lineEnding = (code: Code) => code !== null && code < -2
const markdownSpace = (code: Code) => code === -2 || code === -1 || code === SPACE
const digit = (code: Code) => code !== null && code >= 48 && code <= 57

const factorySpace = (effects: Effects, ok: State, type: string, max?: number): State => {
  const limit = max ? max - 1 : Infinity
  let size = 0
  return start
  function start(code: Code) {
    if (markdownSpace(code)) {
      effects.enter(type)
      return prefix(code)
    }
    return ok(code)
  }
  function prefix(code: Code): State | void {
    if (markdownSpace(code) && size++ < limit) {
      effects.consume(code)
      return prefix
    }
    effects.exit(type)
    return ok(code)
  }
}

const prefixMax = (self: Ctx) => (self.parser.constructs.disable.null.includes('codeIndented') ? undefined : 4)

const nonLazy = (self: Ctx): Construct => ({
  partial: true,
  tokenize(effects, ok, nok) {
    return start
    function start(code: Code) {
      if (code === null) return ok(code)
      effects.enter('lineEnding')
      effects.consume(code)
      effects.exit('lineEnding')
      return lineStart
    }
    function lineStart(code: Code) {
      return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
    }
  },
})

// `$$` … `$$` at the start of a line, same shape as micromark-extension-math.
const mathFlow: Construct = { tokenize: tokenizeMathFlow, concrete: true, name: 'mathFlow' }

function tokenizeMathFlow(this: Ctx, effects: Effects, ok: State, nok: State): State {
  return tokenizeMathFlowBody(this, effects, ok, nok)
}

function tokenizeMathFlowBody(self: Ctx, effects: Effects, ok: State, nok: State): State {
  const tail = self.events[self.events.length - 1]
  const initial = tail && tail[1].type === 'linePrefix' ? tail[2].sliceSerialize(tail[1], true).length : 0
  let sizeOpen = 0
  return start

  function start(code: Code) {
    effects.enter('mathFlow')
    effects.enter('mathFlowFence')
    effects.enter('mathFlowFenceSequence')
    return sequenceOpen(code)
  }
  function sequenceOpen(code: Code): State | void {
    if (code === DOLLAR) {
      effects.consume(code)
      sizeOpen++
      return sequenceOpen
    }
    if (sizeOpen < 2) return nok(code)
    effects.exit('mathFlowFenceSequence')
    return factorySpace(effects, metaBefore, 'whitespace')(code)
  }
  function metaBefore(code: Code) {
    if (code === null || lineEnding(code)) return metaAfter(code)
    effects.enter('mathFlowFenceMeta')
    effects.enter('chunkString', { contentType: 'string' })
    return meta(code)
  }
  function meta(code: Code): State | void {
    if (code === null || lineEnding(code)) {
      effects.exit('chunkString')
      effects.exit('mathFlowFenceMeta')
      return metaAfter(code)
    }
    if (code === DOLLAR) return nok(code)
    effects.consume(code)
    return meta
  }
  function metaAfter(code: Code) {
    effects.exit('mathFlowFence')
    if (self.interrupt) return ok(code)
    return effects.attempt(nonLazy(self), beforeContinuation, after)(code)
  }
  function beforeContinuation(code: Code) {
    return effects.attempt({ tokenize: tokenizeClosing, partial: true }, after, contentStart)(code)
  }
  function contentStart(code: Code) {
    return (initial ? factorySpace(effects, beforeChunk, 'linePrefix', initial + 1) : beforeChunk)(code)
  }
  function beforeChunk(code: Code): State | void {
    if (code === null) return after(code)
    if (lineEnding(code)) return effects.attempt(nonLazy(self), beforeContinuation, after)(code)
    effects.enter('mathFlowValue')
    return chunk(code)
  }
  function chunk(code: Code): State | void {
    if (code === null || lineEnding(code)) {
      effects.exit('mathFlowValue')
      return beforeChunk(code)
    }
    effects.consume(code)
    return chunk
  }
  function after(code: Code) {
    effects.exit('mathFlow')
    return ok(code)
  }
  function tokenizeClosing(effects: Effects, ok: State, nok: State): State {
    let size = 0
    return factorySpace(effects, beforeClose, 'linePrefix', prefixMax(self))
    function beforeClose(code: Code) {
      effects.enter('mathFlowFence')
      effects.enter('mathFlowFenceSequence')
      return sequenceClose(code)
    }
    function sequenceClose(code: Code): State | void {
      if (code === DOLLAR) {
        size++
        effects.consume(code)
        return sequenceClose
      }
      if (size < sizeOpen) return nok(code)
      effects.exit('mathFlowFenceSequence')
      return factorySpace(effects, afterClose, 'whitespace')(code)
    }
    function afterClose(code: Code) {
      if (code === null || lineEnding(code)) {
        effects.exit('mathFlowFence')
        return ok(code)
      }
      return nok(code)
    }
  }
}

// `$…$` and `$$…$$`. A one-dollar close followed by a digit is rejected back into text.
function mathText(): Construct {
  return { tokenize: tokenizeMathText, resolve: resolveMathText, previous: previousDollar, name: 'mathText' }

  function tokenizeMathText(this: Ctx, effects: Effects, ok: State, nok: State): State {
    let sizeOpen = 0
    let size = 0
    let marker: Token | undefined
    let mathToken: Token | undefined
    return start

    function start(code: Code) {
      mathToken = effects.enter('mathText')
      effects.enter('mathTextSequence')
      return sequenceOpen(code)
    }
    function sequenceOpen(code: Code): State | void {
      if (code === DOLLAR) {
        effects.consume(code)
        sizeOpen++
        return sequenceOpen
      }
      // singleDollarTextMath is on, so one `$` is enough to open.
      effects.exit('mathTextSequence')
      return between(code)
    }
    function between(code: Code) {
      if (code === null) return nok(code)
      if (code === DOLLAR) {
        marker = effects.enter('mathTextSequence')
        size = 0
        return sequenceClose(code)
      }
      if (code === SPACE) {
        effects.enter('space')
        effects.consume(code)
        effects.exit('space')
        return between
      }
      if (lineEnding(code)) {
        effects.enter('lineEnding')
        effects.consume(code)
        effects.exit('lineEnding')
        return between
      }
      effects.enter('mathTextData')
      return data(code)
    }
    function data(code: Code): State | void {
      if (code === null || code === SPACE || code === DOLLAR || lineEnding(code)) {
        effects.exit('mathTextData')
        return between(code)
      }
      effects.consume(code)
      return data
    }
    function sequenceClose(code: Code): State | void {
      if (code === DOLLAR) {
        effects.consume(code)
        size++
        return sequenceClose
      }
      if (size === sizeOpen) {
        if (sizeOpen === 1 && digit(code) && mathToken) mathToken._rejected = true
        effects.exit('mathTextSequence')
        effects.exit('mathText')
        return ok(code)
      }
      if (marker) marker.type = 'mathTextData'
      return data(code)
    }
  }
}

function previousDollar(this: Ctx, code: Code) {
  return code !== DOLLAR || this.events[this.events.length - 1]?.[1].type === 'characterEscape'
}

function resolveMathText(events: Event[]) {
  const first = events[0]?.[1]
  if (first?._rejected) {
    const inner = events.slice(1, -1)
    for (const event of inner) {
      const token = event[1]
      if (token.type === 'mathTextSequence' || token.type === 'mathTextData' || token.type === 'space') token.type = 'data'
    }
    return inner
  }
  let tail = events.length - 4
  let head = 3
  const opening = events[head]?.[1]
  const closing = events[tail]?.[1]
  if (opening && closing && (opening.type === 'lineEnding' || opening.type === 'space') && (closing.type === 'lineEnding' || closing.type === 'space')) {
    for (let index = head + 1; index < tail; index++) {
      if (events[index]?.[1].type === 'mathTextData') {
        closing.type = 'mathTextPadding'
        opening.type = 'mathTextPadding'
        head += 2
        tail -= 2
        break
      }
    }
  }
  let enter: number | undefined
  tail++
  for (let index = head; index <= tail; index++) {
    const atEnd = index === tail || events[index]?.[1].type === 'lineEnding'
    if (enter === undefined) {
      if (!atEnd) enter = index
      continue
    }
    if (!atEnd) continue
    const token = events[enter]?.[1]
    if (!token) continue
    token.type = 'mathTextData'
    if (index !== enter + 2) {
      const previous = events[index - 1]?.[1]
      if (previous) token.end = previous.end
      events.splice(enter + 2, index - enter - 2)
      tail -= index - enter - 2
      index = enter + 2
    }
    enter = undefined
  }
  return events
}

// `\[` … `\]` as a block, one line or many. An unclosed tail runs to EOF, like `$$`.
const mathTexFlow: Construct = { tokenize: tokenizeMathTexFlow, concrete: true, name: 'mathTexFlow' }

function tokenizeMathTexFlow(this: Ctx, effects: Effects, ok: State, nok: State): State {
  return tokenizeMathTexFlowBody(this, effects, ok, nok)
}

function tokenizeMathTexFlowBody(self: Ctx, effects: Effects, ok: State, nok: State): State {
  const tail = self.events[self.events.length - 1]
  const initial = tail && tail[1].type === 'linePrefix' ? tail[2].sliceSerialize(tail[1], true).length : 0
  let clean = true
  return start

  function start(code: Code) {
    effects.enter('mathFlow')
    effects.enter('mathFlowFence')
    effects.enter('mathFlowFenceSequence')
    effects.consume(code)
    return afterSlash
  }
  function afterSlash(code: Code) {
    if (code !== LBRACK) return nok(code)
    effects.consume(code)
    effects.exit('mathFlowFenceSequence')
    return factorySpace(effects, afterOpen, 'whitespace')
  }
  function afterOpen(code: Code) {
    effects.exit('mathFlowFence')
    if (self.interrupt) return ok(code)
    if (lineEnding(code)) return effects.attempt(texContinuation(self), beforeCloseOrContent, after)(code)
    return beforeCloseOrContent(code)
  }
  function beforeCloseOrContent(code: Code) {
    if (code === null) return after(code)
    return effects.attempt({ tokenize: tokenizeTexClose, partial: true }, after, contentStart)(code)
  }
  function contentStart(code: Code) {
    return (initial ? factorySpace(effects, beforeChunk, 'linePrefix', initial + 1) : beforeChunk)(code)
  }
  function beforeChunk(code: Code): State | void {
    if (code === null) return after(code)
    if (code === BACKSLASH) return effects.attempt({ tokenize: tokenizeBackslash, partial: true }, chunk, backslashWasCloser)(code)
    if (lineEnding(code)) return effects.attempt(texContinuation(self), beforeCloseOrContent, after)(code)
    effects.enter('mathFlowValue')
    return chunk(code)
  }
  function backslashWasCloser(code: Code) {
    return effects.attempt({ tokenize: tokenizeTexClose, partial: true }, after, takeBackslash)(code)
  }
  function takeBackslash(code: Code) {
    effects.enter('mathFlowValue')
    effects.consume(code)
    return chunk
  }
  function chunk(code: Code): State | void {
    if (code === null || code === BACKSLASH || lineEnding(code)) {
      effects.exit('mathFlowValue')
      return beforeChunk(code)
    }
    effects.consume(code)
    return chunk
  }
  function after(code: Code) {
    effects.exit('mathFlow')
    return clean ? ok(code) : nok(code)
  }
  function tokenizeTexClose(effects: Effects, ok: State, nok: State): State {
    return factorySpace(effects, beforeMark, 'linePrefix', prefixMax(self))
    function beforeMark(code: Code) {
      if (code === null) return nok(code)
      effects.enter('mathFlowFence')
      effects.enter('mathFlowFenceSequence')
      effects.consume(code)
      return afterMark
    }
    function afterMark(code: Code) {
      if (code !== RBRACK) return nok(code)
      effects.consume(code)
      effects.exit('mathFlowFenceSequence')
      return factorySpace(effects, afterFence, 'whitespace')
    }
    function afterFence(code: Code) {
      if (code === null || lineEnding(code)) {
        effects.exit('mathFlowFence')
        return ok(code)
      }
      clean = false
      return nok(code)
    }
  }
}

// Continuation that also accepts "still on this line" so `\[ x \]` can be one line.
function texContinuation(self: Ctx): Construct {
  return {
    partial: true,
    tokenize(effects, ok, nok) {
      return start
      function start(code: Code) {
        if (code === null) return ok(code)
        if (!lineEnding(code)) return lineStart(code)
        effects.enter('lineEnding')
        effects.consume(code)
        effects.exit('lineEnding')
        return lineStart
      }
      function lineStart(code: Code) {
        return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
      }
    },
  }
}

// A `\` that is not the start of `\]` belongs to the formula.
function tokenizeBackslash(this: Ctx, effects: Effects, ok: State, nok: State): State {
  return start
  function start(code: Code) {
    effects.enter('mathFlowValue')
    effects.consume(code)
    return after
  }
  function after(code: Code) {
    if (code === RBRACK) return nok(code)
    return ok(code)
  }
}

const dollarText = mathText()

const mathTexText: Construct = {
  tokenize: tokenizeMathTexText,
  resolve: dollarText.resolve,
  previous: previousTex,
  name: 'mathTexText',
}

function previousTex(this: Ctx, code: Code) {
  return code !== BACKSLASH
}

function tokenizeMathTexText(this: Ctx, effects: Effects, ok: State, nok: State): State {
  let closer = RPAREN
  let marker: Token | undefined
  return start

  function start(code: Code) {
    effects.enter('mathText')
    effects.enter('mathTextSequence')
    effects.consume(code)
    return kind
  }
  function kind(code: Code) {
    if (code !== LPAREN && code !== LBRACK) return nok(code)
    closer = code === LPAREN ? RPAREN : RBRACK
    effects.consume(code)
    effects.exit('mathTextSequence')
    return between
  }
  function between(code: Code): State | void {
    if (code === null) return nok(code)
    if (code === BACKSLASH) {
      marker = effects.enter('mathTextSequence')
      effects.consume(code)
      return maybeClose
    }
    if (code === SPACE) {
      effects.enter('space')
      effects.consume(code)
      effects.exit('space')
      return between
    }
    if (lineEnding(code)) {
      effects.enter('lineEnding')
      effects.consume(code)
      effects.exit('lineEnding')
      return between
    }
    effects.enter('mathTextData')
    return data(code)
  }
  function data(code: Code): State | void {
    if (code === null || code === SPACE || code === BACKSLASH || lineEnding(code)) {
      effects.exit('mathTextData')
      return between(code)
    }
    effects.consume(code)
    return data
  }
  function maybeClose(code: Code): State | void {
    if (code === closer) {
      effects.consume(code)
      effects.exit('mathTextSequence')
      effects.exit('mathText')
      return ok(code)
    }
    if (marker) marker.type = 'mathTextData'
    if (code === BACKSLASH) {
      effects.consume(code)
      return data
    }
    return data(code)
  }
}

export const deepseekMath = () => ({
  flow: { [DOLLAR]: mathFlow, [BACKSLASH]: mathTexFlow },
  text: { [DOLLAR]: dollarText, [BACKSLASH]: mathTexText },
})

const textChild = (value: string) => ({ type: 'text', value })

export function deepseekMathFromMarkdown() {
  return {
    enter: { mathFlow: enterMathFlow, mathFlowFenceMeta: enterMathFlowMeta, mathText: enterMathText },
    exit: {
      mathFlow: exitMathFlow,
      mathFlowFence: exitMathFlowFence,
      mathFlowFenceMeta: exitMathFlowMeta,
      mathFlowValue: exitMathData,
      mathText: exitMathText,
      mathTextData: exitMathData,
    },
  }

  function enterMathFlow(this: Compile, token: unknown) {
    this.enter({ type: 'math', meta: null, value: '', data: { hName: 'math-block', hChildren: [] } }, token)
  }
  function enterMathFlowMeta(this: Compile) {
    this.buffer()
  }
  function exitMathFlowMeta(this: Compile) {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    if (node) node.meta = data
  }
  function exitMathFlowFence(this: Compile) {
    if (this.data.mathFlowInside) return
    this.buffer()
    this.data.mathFlowInside = true
  }
  function exitMathFlow(this: Compile, token: unknown) {
    const data = this.resume().replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, '')
    const node = this.stack[this.stack.length - 1]
    this.exit(token)
    if (!node?.data) return
    node.value = data
    node.data.hChildren = [textChild(data)]
    this.data.mathFlowInside = undefined
  }
  function enterMathText(this: Compile, token: unknown) {
    this.enter({ type: 'inlineMath', value: '', data: { hName: 'math-inline', hChildren: [] } }, token)
    this.buffer()
  }
  function exitMathText(this: Compile, token: unknown) {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    this.exit(token)
    if (!node?.data) return
    node.value = data
    node.data.hChildren = [textChild(data)]
  }
  function exitMathData(this: Compile, token: unknown) {
    this.config.enter.data.call(this, token)
    this.config.exit.data.call(this, token)
  }
}
