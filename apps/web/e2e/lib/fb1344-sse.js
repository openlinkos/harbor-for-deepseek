// fb1344 staged SSE: replaces window.fetch for POST …api.deepseek.com…/messages with a ReadableStream the test feeds
// phase by phase (window.__sse.push(events), window.__sse.end()). Every other request goes to the real fetch
// (and from there to the Playwright route mock). Install with page.addInitScript before the app loads.
(() => {
  const real = window.fetch.bind(window)
  const enc = new TextEncoder()
  const streams = []
  window.__sse = {
    count: () => streams.length,
    push: (events, n = streams.length - 1) => { const c = streams[n]; for (const e of events) c.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)) },
    end: (n = streams.length - 1) => { try { streams[n].close() } catch {} },
    requests: [], aborted: [],
  }
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    if (/api\.deepseek\.com/.test(url) && /\/messages(\?|$)/.test(url) && (init?.method || 'GET').toUpperCase() === 'POST') {
      try { window.__sse.requests.push(JSON.parse(init.body)) } catch { window.__sse.requests.push(null) }
      let ctl; const body = new ReadableStream({ start: (c) => { ctl = c } }); streams.push(ctl)
      const idx = streams.length - 1; init?.signal?.addEventListener('abort', () => { window.__sse.aborted.push(idx); try { ctl.error(new DOMException('aborted', 'AbortError')) } catch {} })
      return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    }
    return real(input, init)
  }
})()
