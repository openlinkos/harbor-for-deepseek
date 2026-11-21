import { createServer as createHttp, type IncomingMessage, type ServerResponse } from 'node:http'
import { serve } from '@hono/node-server'
import { createServer } from '../src/app.ts'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const frame = (response: ServerResponse, event: string, data: unknown) => {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

const finishText = (response: ServerResponse, text: string) => {
  frame(response, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
  frame(response, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })
  frame(response, 'content_block_stop', { type: 'content_block_stop', index: 0 })
  frame(response, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 2 } })
  frame(response, 'message_stop', { type: 'message_stop' })
  response.end()
}

const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw) as { messages?: Array<{ role?: string; content?: unknown }> }
  } catch {
    return {}
  }
}

let still400 = 0

const openSearchReply = (response: ServerResponse, id: string) => {
  frame(response, 'message_start', { type: 'message_start', message: { id, model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 } } })
  frame(response, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
  frame(response, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先想' } })
  frame(response, 'content_block_stop', { type: 'content_block_stop', index: 0 })
  frame(response, 'content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 's1', name: 'deepseek_web_search', input: { action: 'search', queries: ['上海天气'] } } })
  frame(response, 'content_block_stop', { type: 'content_block_stop', index: 1 })
  frame(response, 'content_block_start', { type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', title: '天气来源', url: 'https://weather.example/a', snippet: '晴' }] } })
  frame(response, 'content_block_stop', { type: 'content_block_stop', index: 2 })
  frame(response, 'content_block_start', { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } })
  frame(response, 'content_block_delta', { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: '原文甲' } })
  frame(response, 'content_block_stop', { type: 'content_block_stop', index: 3 })
}

const upstream = createHttp(async (request, response) => {
  const url = request.url ?? ''
  if (url.startsWith('/user/balance')) {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] }))
    return
  }
  if (url === '/models') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ data: [{ id: 'deepseek-flash' }] }))
    return
  }
  const body = await readBody(request)
  const encoded = JSON.stringify(body)
  const last = body.messages?.at(-1)
  if (encoded.includes('仍要400') && last?.role === 'assistant') {
    response.writeHead(400, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { message: 'rejected' } }))
    return
  }
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  if (last?.role === 'assistant') {
    finishText(response, '续写乙')
    return
  }
  if (encoded.includes('仍要400')) {
    still400 += 1
    if (still400 > 1) {
      finishText(response, '重新生成')
      return
    }
    openSearchReply(response, 'reject')
    await new Promise(() => undefined)
    return
  }
  if (encoded.includes('接回用时')) {
    frame(response, 'message_start', { type: 'message_start', message: { id: 'clock', model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 } } })
    frame(response, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
    const thinkingStarted = Date.now()
    let drip = 0
    while (Date.now() - thinkingStarted < 12000) {
      frame(response, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: `想${drip}` } })
      drip += 1
      await delay(400)
    }
    frame(response, 'content_block_stop', { type: 'content_block_stop', index: 0 })
    frame(response, 'content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })
    for (let i = 0; i < 8; i += 1) {
      frame(response, 'content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: i === 7 ? '正文完' : `段${i}` } })
      await delay(500)
    }
    frame(response, 'content_block_stop', { type: 'content_block_stop', index: 1 })
    frame(response, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 2 } })
    frame(response, 'message_stop', { type: 'message_stop' })
    response.end()
    return
  }
  if (encoded.includes('搜索续写')) {
    openSearchReply(response, 'fold')
    await new Promise(() => undefined)
    return
  }
  if (encoded.includes('慢思考')) {
    frame(response, 'message_start', { type: 'message_start', message: { id: 'slow', model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 } } })
    frame(response, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
    frame(response, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '慢慢想' } })
    await delay(3400)
    frame(response, 'content_block_stop', { type: 'content_block_stop', index: 0 })
    frame(response, 'content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })
    frame(response, 'content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '想完了' } })
    frame(response, 'content_block_stop', { type: 'content_block_stop', index: 1 })
    frame(response, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 2 } })
    frame(response, 'message_stop', { type: 'message_stop' })
    response.end()
    return
  }
  if (encoded.includes('分段')) {
    frame(response, 'message_start', { type: 'message_start', message: { id: 'part', model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 } } })
    frame(response, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
    frame(response, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先想' } })
    await delay(1100)
    frame(response, 'content_block_stop', { type: 'content_block_stop', index: 0 })
    frame(response, 'content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })
    frame(response, 'content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '原文甲' } })
    frame(response, 'content_block_stop', { type: 'content_block_stop', index: 1 })
    await new Promise(() => undefined)
    return
  }
  finishText(response, '好')
})

const address = await new Promise<import('node:net').AddressInfo>((resolve) => {
  upstream.listen(0, '127.0.0.1', () => resolve(upstream.address() as import('node:net').AddressInfo))
})

const harbor = await createServer({
  databaseUrl: process.env.DATABASE_URL ?? '',
  masterKey: Buffer.alloc(32, 7),
  upstream: `http://127.0.0.1:${address.port}`,
  staticDir: process.env.STATIC_DIR,
  allowOpenSetup: true,
  cookieSecure: false,
})
await harbor.sql`
  truncate table
    run_events, chat_runs, usage_events, usage_daily, alerts, balance_snapshots,
    messages, tombstones, conversations, files, auth_sessions, invite_codes,
    api_keys, user_counters, users
  restart identity cascade
`
await harbor.sql`delete from app_settings where key like 'bootstrap:%'`

serve({ fetch: harbor.app.fetch, hostname: '127.0.0.1', port: 0 }, (info) => {
  process.stderr.write(`READY ${info.port}\n`)
})
