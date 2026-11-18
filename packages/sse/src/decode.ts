/** WHATWG server-sent events decoder. Comment lines, including keep-alives, are ignored. */

export type ServerSentEvent = {
  event: string
  data: string
  lastEventId: string
}

export class ServerSentEventDecoder {
  private buffer = ''
  private data = ''
  private hasData = false
  private eventType = ''
  private lastEventId = ''

  push(text: string): ServerSentEvent[] {
    this.buffer += text
    const events: ServerSentEvent[] = []
    let start = 0
    for (let i = 0; i < this.buffer.length; i += 1) {
      const char = this.buffer[i]
      if (char !== '\n' && char !== '\r') {
        continue
      }
      if (char === '\r' && i === this.buffer.length - 1) {
        break
      }
      const line = this.buffer.slice(start, i)
      const dispatched = this.consume(line)
      if (dispatched) {
        events.push(dispatched)
      }
      if (char === '\r' && this.buffer[i + 1] === '\n') {
        i += 1
      }
      start = i + 1
    }
    this.buffer = this.buffer.slice(start)
    return events
  }

  end(): ServerSentEvent[] {
    if (!this.buffer) {
      return []
    }
    const trailing = this.buffer.endsWith('\r') ? this.consume(this.buffer.slice(0, -1)) : null
    this.buffer = ''
    return trailing ? [trailing] : []
  }

  private consume(line: string): ServerSentEvent | null {
    if (line === '') {
      return this.dispatch()
    }
    if (line.startsWith(':')) {
      return null
    }
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) {
      value = value.slice(1)
    }
    if (field === 'data') {
      this.data = this.hasData ? `${this.data}\n${value}` : value
      this.hasData = true
    } else if (field === 'event') {
      this.eventType = value
    } else if (field === 'id' && !value.includes('\0')) {
      this.lastEventId = value
    }
    return null
  }

  private dispatch(): ServerSentEvent | null {
    if (!this.hasData) {
      this.eventType = ''
      return null
    }
    const event: ServerSentEvent = {
      event: this.eventType || 'message',
      data: this.data,
      lastEventId: this.lastEventId,
    }
    this.data = ''
    this.hasData = false
    this.eventType = ''
    return event
  }
}
