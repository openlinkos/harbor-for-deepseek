import { createServer, type Server } from 'node:http'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer as createHarbor, type HarborServer } from './app.js'
import { applyMigrations } from './schema.js'

const configuredUrl = process.env.DATABASE_URL
const databaseUrl = configuredUrl ?? 'postgres://harbor:harbor@127.0.0.1:5432/harbor'

const postgresReady = await (async () => {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 2 })
  try {
    await sql`select 1`
    return true
  } catch (error) {
    if (configuredUrl) {
      throw error
    }
    return false
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined)
  }
})()
const masterKey = Buffer.alloc(32, 9)

const sse = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"req-1","model":"deepseek-flash","usage":{"input_tokens":49,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"service_tier":"standard"}}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"8"}}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null,"title":"简单加法"},"usage":{"input_tokens":41,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":33,"service_tier":"standard","server_tool_use":{"web_search_requests":1,"web_fetch_requests":4,"tool_search":2,"tool_fetch":0,"tool_image_search":0},"output_tokens_details":{"thinking_tokens":31}}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
  '',
].join('\n')

describe.skipIf(!postgresReady)('harbor server', () => {
  let harbor!: HarborServer
  let mock!: Server
  let upstream: string
  const seen: string[] = []
  const bodies: string[] = []
  let fileBody = ''
  let releaseHold: (() => void) | null = null
  let releaseRun: (() => void) | null = null
  let holdRun: Promise<void> | null = null

  beforeAll(async () => {
    mock = createServer(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk))
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      const key = String(request.headers['x-api-key'] ?? request.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
      seen.push(`${request.url} ${key}`)
      if (request.url?.startsWith('/user/balance')) {
        if (key.includes('bad')) {
          response.writeHead(401, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ error: { message: 'unauthorized' } }))
          return
        }
        const low = key.includes('low')
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(
          JSON.stringify({
            is_available: true,
            balance_infos: [
              {
                currency: 'CNY',
                total_balance: low ? '10.00' : '317.22',
                granted_balance: '0.00',
                topped_up_balance: low ? '10.00' : '317.22',
              },
            ],
          }),
        )
        return
      }
      if (request.url?.includes('/messages')) {
        try {
          const parsed = JSON.parse(raw) as { system?: string }
          seen.push(`system:${parsed.system ?? ''}`)
        } catch {
          seen.push('system:')
        }
        if (key.includes('slow-stream')) {
          await new Promise((resolve) => setTimeout(resolve, 90))
        }
        if (key.includes('hold-stream')) {
          await new Promise<void>((resolve) => {
            releaseHold = resolve
          })
        }
        let upstreamBody: { messages?: Array<{ role?: string }> } = {}
        try {
          upstreamBody = JSON.parse(raw) as { messages?: Array<{ role?: string }> }
        } catch {
          upstreamBody = {}
        }
        if (request.url?.includes('/messages')) bodies.push(raw)
        if (upstreamBody.messages?.at(-1)?.role === 'assistant') {
          const encoded = JSON.stringify(upstreamBody)
          const thinkingRejected = key.includes('reject-thinking') && encoded.includes('"type":"thinking"')
          if (thinkingRejected || key.includes('reject-continue')) {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ error: { message: 'rejected' } }))
            return
          }
          response.writeHead(200, { 'content-type': 'text/event-stream' })
          response.end([
            'event: content_block_start',
            'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
            '',
            'event: content_block_delta',
            'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"续写乙"}}',
            '',
            'event: content_block_stop',
            'data: {"type":"content_block_stop","index":0}',
            '',
            'event: message_delta',
            'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"input_tokens":1,"output_tokens":2}}',
            '',
            'event: message_stop',
            'data: {"type":"message_stop"}',
            '',
            '',
          ].join('\n'))
          return
        }
        if (key.includes('think-open')) {
          response.writeHead(200, { 'content-type': 'text/event-stream' })
          const frame = (event: string, data: unknown) => {
            response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          }
          frame('message_start', { type: 'message_start', message: { id: 'open', model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 } } })
          frame('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
          frame('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '还在想' } })
          await new Promise<void>((resolve) => {
            releaseHold = resolve
          })
          frame('content_block_stop', { type: 'content_block_stop', index: 0 })
          frame('content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })
          frame('content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '想完了' } })
          frame('content_block_stop', { type: 'content_block_stop', index: 1 })
          frame('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 2 } })
          frame('message_stop', { type: 'message_stop' })
          response.end()
          return
        }
        if (key.includes('partial-stream')) {
          response.writeHead(200, { 'content-type': 'text/event-stream' })
          const frame = (event: string, data: unknown) => {
            response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          }
          frame('message_start', { type: 'message_start', message: { id: 'part', model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 } } })
          frame('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
          frame('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先想' } })
          await new Promise((resolve) => setTimeout(resolve, 1200))
          frame('content_block_stop', { type: 'content_block_stop', index: 0 })
          frame('content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })
          frame('content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '原文甲' } })
          frame('content_block_stop', { type: 'content_block_stop', index: 1 })
          await new Promise<void>((resolve) => {
            releaseHold = resolve
          })
          response.end()
          return
        }
        if (key.includes('think-pause')) {
          response.writeHead(200, { 'content-type': 'text/event-stream' })
          const frame = (event: string, data: unknown) => {
            response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          }
          frame('message_start', { type: 'message_start', message: { id: 'slow', model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 } } })
          frame('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
          frame('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '想了很久' } })
          await new Promise((resolve) => setTimeout(resolve, 2500))
          frame('content_block_stop', { type: 'content_block_stop', index: 0 })
          frame('content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })
          frame('content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '想完了' } })
          frame('content_block_stop', { type: 'content_block_stop', index: 1 })
          frame('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 2 } })
          frame('message_stop', { type: 'message_stop' })
          response.end()
          return
        }
        if (key.includes('search-fold') || key.includes('reject-continue') || key.includes('reject-thinking')) {
          response.writeHead(200, { 'content-type': 'text/event-stream' })
          const frame = (event: string, data: unknown) => {
            response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          }
          frame('message_start', { type: 'message_start', message: { id: 'held', model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 } } })
          frame('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
          frame('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先想' } })
          frame('content_block_stop', { type: 'content_block_stop', index: 0 })
          if (!key.includes('reject-thinking')) {
            frame('content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 's1', name: 'deepseek_web_search', input: { action: 'search', queries: ['上海天气'] } } })
            frame('content_block_stop', { type: 'content_block_stop', index: 1 })
            frame('content_block_start', { type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', title: '天气来源', url: 'https://weather.example/a', snippet: '晴' }] } })
            frame('content_block_stop', { type: 'content_block_stop', index: 2 })
            frame('content_block_start', { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } })
            frame('content_block_delta', { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: '原文甲' } })
            frame('content_block_stop', { type: 'content_block_stop', index: 3 })
          } else {
            frame('content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })
            frame('content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '原文甲' } })
            frame('content_block_stop', { type: 'content_block_stop', index: 1 })
          }
          await new Promise<void>((resolve) => {
            releaseHold = resolve
          })
          response.end()
          return
        }
        if (key.includes('fail-chat')) {
          response.writeHead(401, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ error: { message: 'unauthorized' } }))
          return
        }
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.end(sse)
        return
      }
      if (request.url === '/models') {
        if (key.includes('boom')) {
          response.writeHead(500, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ error: { message: `rejected ${key}` } }))
          return
        }
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ echoed: key, data: [{ id: 'deepseek-flash' }] }))
        return
      }
      if (request.url === '/files') {
        fileBody = raw
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(
          JSON.stringify({
            id: 'file-api-00000000-0000-4000-8000-000000000009',
            bytes: 5,
            created_at: 1794936646,
            expires_at: 1794940246,
            filename: 'note.txt',
            purpose: 'user_data',
          }),
        )
        return
      }
      response.writeHead(404)
      response.end()
    })
    await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', resolve))
    const address = mock.address()
    const port = typeof address === 'object' && address ? address.port : 0
    upstream = `http://127.0.0.1:${port}`
    harbor = await createHarbor({
      databaseUrl,
      masterKey,
      upstream,
      eventPingMs: 40,
      trustProxy: true,
      allowOpenSetup: true,
      beforeRunCommit: () => holdRun ?? Promise.resolve(),
    })
  })

  afterAll(async () => {
    await harbor?.close().catch(() => undefined)
    if (!mock?.listening) {
      return
    }
    await new Promise<void>((resolve) => mock?.close(() => resolve()))
  })

  beforeEach(async () => {
    seen.length = 0
    bodies.length = 0
    fileBody = ''
    releaseHold?.()
    releaseHold = null
    releaseRun?.()
    releaseRun = null
    holdRun = null
    await harbor.sql`
      truncate table
        run_events, chat_runs, usage_events, usage_daily, alerts, balance_snapshots,
        messages, tombstones, conversations, files, auth_sessions, invite_codes,
        api_keys, user_counters, users
      restart identity cascade
    `
    await harbor.sql`delete from app_settings where key like 'bootstrap:%'`
  })

  const resetData = async () => {
    await harbor.sql`
      truncate table
        run_events, chat_runs, usage_events, usage_daily, alerts, balance_snapshots,
        messages, tombstones, conversations, files, auth_sessions, invite_codes,
        api_keys, user_counters, users
      restart identity cascade
    `
  }

  const sessionOf = (response: Response) => {
    const raw = response.headers.get('set-cookie') ?? ''
    return /harbor_session=([^;]+)/.exec(raw)?.[1] ?? ''
  }

  const authed = (session: string, csrf: string, write = false): HeadersInit => ({
    cookie: `harbor_session=${session}`,
    ...(write ? { 'x-harbor-csrf': csrf } : {}),
  })

  it('creates the admin once and keeps the key encrypted', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    expect(setup.status).toBe(200)
    const cookie = setup.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie.toLowerCase()).not.toContain('secure')
    const created = (await setup.json()) as { csrf: string; user: { role: string } }
    expect(created.user.role).toBe('admin')
    const again = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    expect(again.status).toBe(403)

    const session = sessionOf(setup)
    const added = await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authed(session, created.csrf, true) },
      body: JSON.stringify({ label: 'main', secret: 'demo-pool-key', priority: 10 }),
    })
    expect(added.status).toBe(200)
    const listed = await harbor.app.request('/api/admin/keys', { headers: authed(session, created.csrf) })
    const body = await listed.text()
    expect(body).not.toContain('demo-pool-key')
    expect(body).toContain('317.22')
    expect(body).toContain(String('demo-pool-key'.slice(-4)))
    const stored = await harbor.sql<{ ciphertext: Buffer }[]>`select ciphertext from api_keys`
    expect(Buffer.from(stored[0]?.ciphertext ?? []).toString('utf8')).not.toContain('demo-pool-key')
  })

  it('fails over to a healthy key and records billed tool counts from message_delta', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ label: 'bad', secret: 'fail-chat-key', priority: 1, accountGroup: 'broken' }),
    })
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ label: 'good', secret: 'good-pool-key', priority: 5, accountGroup: 'healthy' }),
    })
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ label: 'low', secret: 'low-balance-key', priority: 9, accountGroup: 'low-account' }),
    })
    const alerts = await harbor.app.request('/api/admin/alerts', { headers: authed(session, created.csrf) })
    expect(await alerts.text()).toContain('below 50 CNY')

    const conversation = await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'chat-1', model: 'deepseek-flash' }),
    })
    expect(conversation.status).toBe(200)
    const run = await harbor.app.request('/api/conversations/chat-1/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: '3+5', thinking: true, search: false }),
    })
    expect(run.status).toBe(200)
    const started = (await run.json()) as { runId: string }
    const events = await harbor.app.request(`/api/runs/${started.runId}/events?after=0`, {
      headers: authed(session, created.csrf),
    })
    const stream = await events.text()
    expect(stream).toContain('简单加法')
    expect(stream).toContain('message_stop')
    expect(stream).toContain('"status":"complete"')
    const usage = await harbor.sql<{ tool_search: number; tool_fetch: number; input_tokens: number }[]>`
      select tool_search, tool_fetch, input_tokens from usage_events
    `
    expect(usage[0]?.tool_search).toBe(2)
    expect(usage[0]?.tool_fetch).toBe(0)
    expect(usage[0]?.input_tokens).toBe(41)
    const bad = await harbor.sql<{ status: string }[]>`select status from api_keys where label = 'bad'`
    expect(bad[0]?.status).toBe('error')
    expect(seen.some((line) => line.includes('/messages') && line.includes('good-pool-key'))).toBe(true)
    expect(seen.some((line) => line.startsWith('system:') && line.slice('system:'.length).trim() !== '')).toBe(false)
    const ledger = await harbor.app.request('/api/admin/usage', { headers: authed(session, created.csrf) })
    const ledgerBody = (await ledger.json()) as { daily: Array<{ day: string; username: string; keyLabel: string }> }
    expect(ledgerBody.daily[0]?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(ledgerBody.daily[0]?.username).toBe('ada')
    expect(ledgerBody.daily[0]?.keyLabel).toBe('good')

    const health = await harbor.app.request('http://127.0.0.1/api/health')
    expect(health.headers.get('x-content-type-options')).toBe('nosniff')
    expect(health.headers.get('x-frame-options')).toBe('DENY')
    expect(health.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(health.headers.get('strict-transport-security')).toBeNull()
    const secure = await harbor.app.request('https://harbor.example/api/health')
    expect(secure.headers.get('strict-transport-security')).toContain('max-age=31536000')
    const forwarded = await harbor.app.request('http://127.0.0.1/api/health', { headers: { 'x-forwarded-proto': 'https' } })
    expect(forwarded.headers.get('strict-transport-security')).toContain('max-age=31536000')

    const replay = await harbor.app.request(`/api/runs/${started.runId}/events?after=1`, {
      headers: authed(session, created.csrf),
    })
    const tail = await replay.text()
    expect(tail).toContain('message_stop')
    expect(tail.startsWith('id: 1\n')).toBe(false)
  })

  it('reports a live run while the upstream stream is still open', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'hold-stream-key', accountGroup: 'hold' }),
    })
    await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'live-chat' }),
    })
    const run = await harbor.app.request('/api/conversations/live-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'hello' }),
    })
    const started = (await run.json()) as { runId: string; assistantMessageId: string }
    const during = await harbor.app.request('/api/conversations/live-chat/messages', { headers: authed(session, created.csrf) })
    const open = (await during.json()) as { liveRun: { id: string; messageId: string } | null; messages: Array<{ id: string; status: string }> }
    expect(open.liveRun).toEqual({ id: started.runId, messageId: started.assistantMessageId })
    expect(open.messages.find((item) => item.id === started.assistantMessageId)?.status).toBe('streaming')
    for (let i = 0; i < 50 && !releaseHold; i += 1) await new Promise((resolve) => setTimeout(resolve, 20))
    releaseHold?.()
    releaseHold = null
    const events = await harbor.app.request(`/api/runs/${started.runId}/events`, { headers: authed(session, created.csrf) })
    expect(await events.text()).toContain('"status":"complete"')
    const after = await harbor.app.request('/api/conversations/live-chat/messages', { headers: authed(session, created.csrf) })
    const done = (await after.json()) as { liveRun: { id: string } | null; messages: Array<{ status: string }> }
    expect(done.liveRun).toBeNull()
    expect(done.messages.some((item) => item.status === 'streaming')).toBe(false)
  })

  it('does not leak a live run, its events, or abort to another user', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const admin = (await setup.json()) as { csrf: string }
    const adminSession = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(adminSession, admin.csrf, true) }
    const invite = await harbor.app.request('/api/admin/invites', {
      method: 'POST',
      headers,
      body: JSON.stringify({ maxUses: 1 }),
    })
    const { code } = (await invite.json()) as { code: string }
    const registered = await harbor.app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, username: 'other', password: 'another-pass' }),
    })
    const member = (await registered.json()) as { csrf: string }
    const memberSession = sessionOf(registered)
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'hold-stream-key', accountGroup: 'hold' }),
    })
    await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'private-chat' }),
    })
    const run = await harbor.app.request('/api/conversations/private-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'secret thought' }),
    })
    const started = (await run.json()) as { runId: string }
    const outsider = authed(memberSession, member.csrf, true)
    const messages = await harbor.app.request('/api/conversations/private-chat/messages', { headers: outsider })
    const leaked = (await messages.json()) as { liveRun: unknown; messages: unknown[] }
    expect(JSON.stringify(leaked)).not.toContain(started.runId)
    expect(leaked.liveRun ?? null).toBeNull()
    const events = await harbor.app.request(`/api/runs/${started.runId}/events`, { headers: outsider })
    expect(events.status).toBe(404)
    const abort = await harbor.app.request(`/api/runs/${started.runId}/abort`, { method: 'POST', headers: outsider })
    expect(abort.status).toBe(404)
    releaseHold?.()
    releaseHold = null
  })

  it('keeps a streaming message invisible until its run row commits', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'hold-stream-key', accountGroup: 'hold' }),
    })
    await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'race-chat' }),
    })
    holdRun = new Promise<void>((resolve) => {
      releaseRun = resolve
    })
    try {
      const pending = harbor.app.request('/api/conversations/race-chat/runs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: 'race' }),
      })
      await new Promise((resolve) => setTimeout(resolve, 80))
      const during = await harbor.app.request('/api/conversations/race-chat/messages', { headers: authed(session, created.csrf) })
      const mid = (await during.json()) as { liveRun: { id: string } | null; messages: Array<{ status: string }> }
      expect(mid.messages.some((item) => item.status === 'streaming' && !mid.liveRun)).toBe(false)
      releaseRun?.()
      releaseRun = null
      holdRun = null
      const started = (await (await pending).json()) as { runId: string }
      for (let i = 0; i < 50 && !releaseHold; i += 1) await new Promise((resolve) => setTimeout(resolve, 20))
      const after = await harbor.app.request('/api/conversations/race-chat/messages', { headers: authed(session, created.csrf) })
      const open = (await after.json()) as { liveRun: { id: string } | null; messages: Array<{ status: string }> }
      expect(open.liveRun?.id).toBe(started.runId)
      expect(open.messages.some((item) => item.status === 'streaming')).toBe(true)
    } finally {
      releaseRun?.()
      releaseRun = null
      holdRun = null
      releaseHold?.()
      releaseHold = null
    }
  })

  it('stores thinking duration on the server and keeps it across reads', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'think-pause-key', accountGroup: 'pause' }),
    })
    await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'think-chat' }),
    })
    const run = await harbor.app.request('/api/conversations/think-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: '想一想', thinking: true }),
    })
    const started = (await run.json()) as { runId: string }
    const events = await harbor.app.request(`/api/runs/${started.runId}/events`, { headers: authed(session, created.csrf) })
    const stream = await events.text()
    expect(stream).toContain('想完了')
    const end = stream.slice(stream.lastIndexOf('event: end'))
    const first = await harbor.app.request('/api/conversations/think-chat/messages', { headers: authed(session, created.csrf) })
    const again = await harbor.app.request('/api/conversations/think-chat/messages', { headers: authed(session, created.csrf) })
    const read = async (response: Response) => ((await response.json()) as { messages: Array<{ thinkingSeconds?: number }> }).messages.find((item) => item.thinkingSeconds)
    const a = await read(first)
    const b = await read(again)
    expect(a?.thinkingSeconds).toBeGreaterThanOrEqual(2)
    expect(a?.thinkingSeconds).toBeLessThanOrEqual(4)
    expect(b?.thinkingSeconds).toBe(a?.thinkingSeconds)
    expect(end).toContain(String(a?.thinkingSeconds))
    await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'other-chat' }),
    })
    const switched = await harbor.app.request('/api/conversations/think-chat/messages', { headers: authed(session, created.csrf) })
    expect((await read(switched))?.thinkingSeconds).toBe(a?.thinkingSeconds)
  })

  it('does not publish a partial thinking duration while thinking is still open', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'think-open-key', accountGroup: 'open' }),
    })
    await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'open-chat' }),
    })
    const startedAt = Date.now()
    const run = await harbor.app.request('/api/conversations/open-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: '慢思考', thinking: true }),
    })
    expect(run.status).toBe(200)
    await new Promise((resolve) => setTimeout(resolve, 1600))
    const midResponse = await harbor.app.request('/api/conversations/open-chat/messages', { headers: authed(session, created.csrf) })
    const mid = (await midResponse.json()) as { messages: Array<{ status: string; thinkingSeconds?: number; thinkingStartedAt?: string }> }
    const streaming = mid.messages.find((item) => item.status === 'streaming')
    expect(streaming?.thinkingStartedAt).toBeTruthy()
    expect(streaming?.thinkingSeconds).toBeUndefined()
    const openFor = Date.now() - startedAt
    releaseHold?.()
    releaseHold = null
    const events = await harbor.app.request(`/api/runs/${((await run.json()) as { runId: string }).runId}/events`, { headers: authed(session, created.csrf) })
    const stream = await events.text()
    expect(stream).toContain('想完了')
    const doneResponse = await harbor.app.request('/api/conversations/open-chat/messages', { headers: authed(session, created.csrf) })
    const done = (await doneResponse.json()) as { messages: Array<{ thinkingSeconds?: number }> }
    const seconds = done.messages.find((item) => item.thinkingSeconds)?.thinkingSeconds
    const elapsed = Math.round(openFor / 1000)
    expect(seconds).toBeGreaterThanOrEqual(Math.max(1, elapsed - 1))
    expect(seconds).toBeLessThanOrEqual(elapsed + 1)
    const again = await harbor.app.request('/api/conversations/open-chat/messages', { headers: authed(session, created.csrf) })
    const stable = (await again.json()) as { messages: Array<{ thinkingSeconds?: number }> }
    expect(stable.messages.find((item) => item.thinkingSeconds)?.thinkingSeconds).toBe(seconds)
    expect(stream.slice(stream.lastIndexOf('event: end'))).toContain(String(seconds))
  })

  it('keeps the stopped text on the same message when a reply continues', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'partial-stream-key', accountGroup: 'partial' }),
    })
    await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'partial-chat' }),
    })
    const run = await harbor.app.request('/api/conversations/partial-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: '分段', thinking: true }),
    })
    const started = (await run.json()) as { runId: string; assistantMessageId: string }
    await new Promise((resolve) => setTimeout(resolve, 2200))
    const abort = await harbor.app.request(`/api/runs/${started.runId}/abort`, { method: 'POST', headers })
    expect(abort.status).toBe(200)
    releaseHold?.()
    releaseHold = null
    await new Promise((resolve) => setTimeout(resolve, 300))
    const stoppedResponse = await harbor.app.request('/api/conversations/partial-chat/messages', { headers: authed(session, created.csrf) })
    const stopped = (await stoppedResponse.json()) as { messages: Array<{ id: string; role: string; status: string; blocks: Array<{ type: string; text?: string }>; thinkingSeconds?: number }> }
    const assistant = stopped.messages.find((item) => item.role === 'assistant')
    expect(assistant?.status).toBe('aborted')
    expect(JSON.stringify(assistant?.blocks)).toContain('原文甲')
    expect(stopped.messages.filter((item) => item.role === 'user')).toHaveLength(1)
    const seconds = assistant?.thinkingSeconds
    expect(seconds).toBeGreaterThanOrEqual(1)
    const continued = await harbor.app.request('/api/conversations/partial-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ continueMessageId: started.assistantMessageId, thinking: true }),
    })
    expect(continued.status).toBe(200)
    const continuedBody = (await continued.json()) as { runId: string }
    const events = await harbor.app.request(`/api/runs/${continuedBody.runId}/events`, { headers: authed(session, created.csrf) })
    expect(await events.text()).toContain('续写乙')
    const afterResponse = await harbor.app.request('/api/conversations/partial-chat/messages', { headers: authed(session, created.csrf) })
    const after = (await afterResponse.json()) as { messages: Array<{ id: string; role: string; status: string; blocks: unknown; thinkingSeconds?: number }> }
    expect(after.messages.filter((item) => item.role === 'user')).toHaveLength(1)
    expect(after.messages.filter((item) => item.role === 'assistant')).toHaveLength(1)
    expect(JSON.stringify(after.messages.find((item) => item.role === 'assistant')?.blocks)).toContain('原文甲')
    expect(JSON.stringify(after.messages.find((item) => item.role === 'assistant')?.blocks)).toContain('续写乙')
    expect(after.messages.find((item) => item.role === 'assistant')?.thinkingSeconds).toBe(seconds)
  })

  const heldReply = async (keyName: string, chatId: string) => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: `${keyName}-key`, accountGroup: keyName }),
    })
    await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: chatId }),
    })
    const run = await harbor.app.request(`/api/conversations/${chatId}/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: '先停一下', thinking: true, search: true }),
    })
    const started = (await run.json()) as { runId: string; assistantMessageId: string }
    await new Promise((resolve) => setTimeout(resolve, 400))
    const abort = await harbor.app.request(`/api/runs/${started.runId}/abort`, { method: 'POST', headers })
    expect(abort.status).toBe(200)
    releaseHold?.()
    releaseHold = null
    await new Promise((resolve) => setTimeout(resolve, 200))
    return { created, session, headers, started }
  }

  const continuationBodies = () =>
    bodies.flatMap((raw) => {
      try {
        const parsed = JSON.parse(raw) as { messages?: Array<{ role?: string; content?: unknown }>; tools?: Array<{ type?: string }> }
        return parsed.messages?.at(-1)?.role === 'assistant' ? [parsed] : []
      } catch {
        return []
      }
    })

  it('retries a continuation without thinking after upstream returns 400', async () => {
    const { created, session, headers, started } = await heldReply('reject-thinking', 'retry-chat')
    const continued = await harbor.app.request('/api/conversations/retry-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ continueMessageId: started.assistantMessageId, thinking: true, search: true }),
    })
    expect(continued.status).toBe(200)
    const continuedBody = (await continued.json()) as { runId: string; assistantMessageId: string }
    const events = await harbor.app.request(`/api/runs/${continuedBody.runId}/events`, { headers: authed(session, created.csrf) })
    expect(await events.text()).toContain('续写乙')
    const requests = continuationBodies()
    expect(requests.length).toBeGreaterThanOrEqual(2)
    expect(JSON.stringify(requests[0]?.messages?.at(-1)?.content)).toContain('"type":"thinking"')
    expect(JSON.stringify(requests[1]?.messages?.at(-1)?.content)).not.toContain('"type":"thinking"')
    expect(JSON.stringify(requests[1]?.messages?.at(-1)?.content)).toContain('原文甲')
    const afterResponse = await harbor.app.request('/api/conversations/retry-chat/messages', { headers: authed(session, created.csrf) })
    const after = (await afterResponse.json()) as { messages: Array<{ id: string; role: string; status: string; blocks: Array<{ type: string; text?: string }> }> }
    const assistants = after.messages.filter((item) => item.role === 'assistant')
    expect(assistants).toHaveLength(1)
    expect(assistants[0]?.id).toBe(started.assistantMessageId)
    expect(assistants[0]?.status).toBe('complete')
    const text = assistants[0]?.blocks.filter((block) => block.type === 'text').map((block) => block.text).join('\n')
    expect(text).toContain('原文甲')
    expect(text).toContain('续写乙')
  })

  it('keeps search blocks in storage and drops web search from the folded continuation request', async () => {
    const { created, session, headers, started } = await heldReply('search-fold', 'fold-chat')
    const beforeResponse = await harbor.app.request('/api/conversations/fold-chat/messages', { headers: authed(session, created.csrf) })
    const before = (await beforeResponse.json()) as { messages: Array<{ role: string; status: string; blocks: Array<{ type: string; text?: string }> }> }
    const stopped = before.messages.find((item) => item.role === 'assistant')
    expect(stopped?.status).toBe('aborted')
    expect(stopped?.blocks.map((block) => block.type)).toEqual(['thinking', 'server_tool_use', 'web_search_tool_result', 'text'])
    const continued = await harbor.app.request('/api/conversations/fold-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ continueMessageId: started.assistantMessageId, thinking: true, search: true }),
    })
    expect(continued.status).toBe(200)
    const continuedBody = (await continued.json()) as { runId: string }
    const events = await harbor.app.request(`/api/runs/${continuedBody.runId}/events`, { headers: authed(session, created.csrf) })
    expect(await events.text()).toContain('续写乙')
    const requests = continuationBodies()
    expect(requests.length).toBeGreaterThan(0)
    expect(JSON.stringify(requests[0]?.tools ?? [])).not.toContain('deepseek_web_search')
    const sentContent = requests[0]?.messages?.at(-1)?.content
    const sent = JSON.stringify(sentContent)
    expect(sent).not.toContain('server_tool_use')
    expect(sent).not.toContain('web_search_tool_result')
    expect(sent).toContain('天气来源')
    expect(sent).toContain('https://weather.example/a')
    expect(Array.isArray(sentContent)).toBe(true)
    const sentBlocks = sentContent as Array<{ type?: string; text?: string }>
    expect(sentBlocks.at(-1)).toEqual({ type: 'text', text: '原文甲' })
    const partialAt = sentBlocks.findIndex((block) => block.type === 'text' && block.text === '原文甲')
    expect(partialAt).toBe(sentBlocks.length - 1)
    expect(sentBlocks.slice(0, partialAt).some((block) => block.type === 'text' && (block.text ?? '').includes('https://weather.example/a'))).toBe(true)
    expect(sentBlocks.slice(partialAt + 1).some((block) => block.type === 'text' && (block.text ?? '').includes('https://weather.example/a'))).toBe(false)
    const afterResponse = await harbor.app.request('/api/conversations/fold-chat/messages', { headers: authed(session, created.csrf) })
    const after = (await afterResponse.json()) as { messages: Array<{ role: string; status: string; blocks: Array<{ type: string; text?: string }> }> }
    expect(after.messages.filter((item) => item.role === 'assistant')).toHaveLength(1)
    const blocks = after.messages.find((item) => item.role === 'assistant')?.blocks ?? []
    expect(blocks.map((block) => block.type).slice(0, 4)).toEqual(['thinking', 'server_tool_use', 'web_search_tool_result', 'text'])
    const text = blocks.filter((block) => block.type === 'text').map((block) => block.text).join('\n')
    expect(text).toContain('原文甲')
    expect(text).toContain('续写乙')
    expect(text).not.toContain('https://weather.example/a')
    expect(text).not.toContain('天气来源')
  })

  it('keeps the stopped reply aborted when a continuation is still rejected', async () => {
    const { created, session, headers, started } = await heldReply('reject-continue', 'fallback-chat')
    const continued = await harbor.app.request('/api/conversations/fallback-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ continueMessageId: started.assistantMessageId, thinking: true, search: true }),
    })
    expect(continued.status).toBe(200)
    const continuedBody = (await continued.json()) as { runId: string }
    const events = await harbor.app.request(`/api/runs/${continuedBody.runId}/events`, { headers: authed(session, created.csrf) })
    expect(await events.text()).toContain('"status":"error"')
    const requests = continuationBodies()
    expect(requests.length).toBeGreaterThanOrEqual(2)
    expect(JSON.stringify(requests[0]?.messages?.at(-1)?.content)).toContain('"type":"thinking"')
    expect(JSON.stringify(requests.at(-1)?.messages?.at(-1)?.content)).not.toContain('"type":"thinking"')
    const afterResponse = await harbor.app.request('/api/conversations/fallback-chat/messages', { headers: authed(session, created.csrf) })
    const after = (await afterResponse.json()) as { messages: Array<{ id: string; role: string; status: string; errorMessage?: string | null; blocks: Array<{ type: string; text?: string }> }> }
    const assistant = after.messages.find((item) => item.role === 'assistant')
    expect(after.messages.filter((item) => item.role === 'assistant')).toHaveLength(1)
    expect(assistant?.id).toBe(started.assistantMessageId)
    expect(assistant?.status).toBe('aborted')
    expect(assistant?.errorMessage ?? null).toBeNull()
    expect(assistant?.blocks.some((block) => block.type === 'server_tool_use')).toBe(true)
    expect(assistant?.blocks.some((block) => block.type === 'web_search_tool_result')).toBe(true)
    const text = assistant?.blocks.filter((block) => block.type === 'text').map((block) => block.text).join('\n')
    expect(text).toContain('原文甲')
    expect(text).not.toContain('续写乙')
    expect(text).not.toContain('https://weather.example/a')
  })

  it('does not write to a closed run stream after the ping interval', async () => {
    const errors: string[] = []
    const onError = (error: Error) => {
      errors.push(error.name)
    }
    process.on('uncaughtException', onError)
    try {
      const setup = await harbor.app.request('/api/setup/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
      })
      const created = (await setup.json()) as { csrf: string }
      const session = sessionOf(setup)
      const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
      await harbor.app.request('/api/admin/keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({ secret: 'slow-stream-key', accountGroup: 'slow' }),
      })
      await harbor.app.request('/api/conversations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: 'slow-chat' }),
      })
      const run = await harbor.app.request('/api/conversations/slow-chat/runs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: 'hello' }),
      })
      const started = (await run.json()) as { runId: string }
      const events = await harbor.app.request(`/api/runs/${started.runId}/events`, {
        headers: authed(session, created.csrf),
      })
      expect(await events.text()).toContain('"status":"complete"')
      await new Promise((resolve) => setTimeout(resolve, 120))
      expect(errors).toEqual([])
      const stillUp = await harbor.app.request('/api/health')
      expect(stillUp.status).toBe(200)
    } finally {
      process.off('uncaughtException', onError)
    }
  })

  it('enforces the daily quota and merges a local import without overwriting', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const admin = (await setup.json()) as { csrf: string; user: { id: string } }
    const adminSession = sessionOf(setup)
    const adminHeaders = { 'content-type': 'application/json', ...authed(adminSession, admin.csrf, true) }
    const invite = await harbor.app.request('/api/admin/invites', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ maxUses: 2 }),
    })
    const { code } = (await invite.json()) as { code: string }
    const registered = await harbor.app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, username: 'friend', password: 'another-pass' }),
    })
    expect(registered.status).toBe(200)
    const member = (await registered.json()) as { csrf: string; user: { id: string } }
    const memberSession = sessionOf(registered)
    await harbor.app.request(`/api/admin/users/${member.user.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ tokenQuota: 10, searchQuota: 100, pageQuota: 80 }),
    })
    await harbor.sql`
      insert into usage_events (
        id, user_id, taken_at, is_peak, input_tokens, cache_read_input_tokens, output_tokens, tool_search, tool_fetch
      ) values (
        ${crypto.randomUUID()}, ${member.user.id}, now(), false, 10, 0, 0, 0, 0
      )
    `
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ secret: 'good-pool-key', accountGroup: 'healthy' }),
    })
    const blocked = await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authed(memberSession, member.csrf, true) },
      body: JSON.stringify({ id: 'quota-chat' }),
    })
    expect(blocked.status).toBe(200)
    const denied = await harbor.app.request('/api/conversations/quota-chat/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authed(memberSession, member.csrf, true) },
      body: JSON.stringify({ text: 'hello' }),
    })
    expect(denied.status).toBe(429)
    const deniedBody = await denied.json()
    expect(deniedBody.error.reset_at).toContain('+08:00')

    const imported = await harbor.app.request('/api/migrations/local', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authed(memberSession, member.csrf, true) },
      body: JSON.stringify({
        conversations: [
          {
            id: 'local-1',
            title: 'from this device',
            messages: [
              {
                id: 'm1',
                parentId: null,
                role: 'user',
                status: 'complete',
                blocks: [{ type: 'text', text: 'hello' }],
                createdAt: '2026-11-18T00:00:00.000Z',
              },
            ],
          },
        ],
      }),
    })
    expect(await imported.json()).toMatchObject({ added: 1, skipped: 0 })
    const again = await harbor.app.request('/api/migrations/local', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authed(memberSession, member.csrf, true) },
      body: JSON.stringify({ conversations: [{ id: 'local-1', title: 'changed', messages: [] }] }),
    })
    expect(await again.json()).toMatchObject({ added: 0, skipped: 1 })
    const sync = await harbor.app.request('/api/sync?cursor=0', {
      headers: authed(memberSession, member.csrf),
    })
    const payload = await sync.json()
    expect(payload.conversations.some((item: { title: string }) => item.title === 'from this device')).toBe(true)
  })

  it('allows Capacitor origins with a bearer token and refuses other origins', async () => {
    await harbor.sql`
      insert into app_settings (key, value)
      values ('cors_origins', '["capacitor://localhost","https://localhost","http://localhost"]'::jsonb)
      on conflict (key) do update set value = excluded.value
    `
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { token: string; csrf: string }
    expect(created.token.length).toBeGreaterThan(20)
    const preflight = await harbor.app.request('/api/me', {
      method: 'OPTIONS',
      headers: { origin: 'https://localhost', 'access-control-request-method': 'GET' },
    })
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://localhost')
    const me = await harbor.app.request('/api/me', {
      headers: { origin: 'capacitor://localhost', authorization: `Bearer ${created.token}` },
    })
    expect(me.status).toBe(200)
    expect(me.headers.get('access-control-allow-origin')).toBe('capacitor://localhost')
    const blocked = await harbor.app.request('/api/me', {
      headers: { origin: 'https://evil.example', authorization: `Bearer ${created.token}` },
    })
    expect(blocked.status).toBe(200)
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull()
    const session = sessionOf(setup)
    const updated = await harbor.app.request('/api/admin/cors', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...authed(session, created.csrf, true) },
      body: JSON.stringify({ origins: ['https://localhost', 'https://evil.example'] }),
    })
    expect(updated.status).toBe(200)
    const nowAllowed = await harbor.app.request('/api/me', {
      headers: { origin: 'https://evil.example', authorization: `Bearer ${created.token}` },
    })
    expect(nowAllowed.headers.get('access-control-allow-origin')).toBe('https://evil.example')
    await harbor.sql`
      insert into app_settings (key, value)
      values ('cors_origins', '["capacitor://localhost","https://localhost","http://localhost"]'::jsonb)
      on conflict (key) do update set value = excluded.value
    `
  })

  it('rejects a cookie write without the csrf header and stores an uploaded file', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const logout = await harbor.app.request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie: `harbor_session=${session}` },
    })
    expect(logout.status).toBe(403)
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authed(session, created.csrf, true) },
      body: JSON.stringify({ secret: 'good-pool-key', accountGroup: 'healthy' }),
    })
    const form = new FormData()
    form.set('purpose', 'user_data')
    form.set('file', new File(['hello'], 'note.txt', { type: 'text/plain' }))
    const uploaded = await harbor.app.request('/api/files', {
      method: 'POST',
      headers: authed(session, created.csrf, true),
      body: form,
    })
    expect(uploaded.status).toBe(200)
    const saved = await harbor.sql<{ expires_at: Date | null }[]>`select expires_at from files`
    expect(saved[0]?.expires_at).toBeTruthy()
  })

  it('uploads to the Files API without expires_after even when the client sends one', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authed(session, created.csrf, true) },
      body: JSON.stringify({ secret: 'good-pool-key', accountGroup: 'healthy' }),
    })
    const form = new FormData()
    form.set('purpose', 'user_data')
    form.set('expires_after[anchor]', 'created_at')
    form.set('expires_after[seconds]', '3600')
    form.set('expires_at', '1794940246')
    form.set('file', new File(['hello'], 'note.txt', { type: 'text/plain' }))
    const uploaded = await harbor.app.request('/api/files', {
      method: 'POST',
      headers: authed(session, created.csrf, true),
      body: form,
    })
    expect(uploaded.status).toBe(200)
    expect(fileBody).toContain('user_data')
    expect(fileBody).toContain('note.txt')
    expect(fileBody.toLowerCase()).not.toContain('expir')
    const payload = (await uploaded.json()) as { id?: string; defaultExpireSeconds?: number }
    expect(payload.id).toBeTruthy()
    expect(payload).not.toHaveProperty('defaultExpireSeconds')
  })

  it('sends the file reference and the web search tool on the same upstream request', async () => {
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const created = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, created.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'good-pool-key', accountGroup: 'healthy' }),
    })
    const conversation = await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'file-search', model: 'deepseek-flash' }),
    })
    expect(conversation.status).toBe(200)
    const fileId = 'file-api-00000000-0000-4000-8000-0000000000a1'
    const run = await harbor.app.request('/api/conversations/file-search/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: '文件里写了什么？顺便搜一下',
        thinking: true,
        search: true,
        files: [{ fileId, filename: 'note.txt', media: 'document', purpose: 'user_data', bytes: 12, expiresAt: null }],
      }),
    })
    expect(run.status).toBe(200)
    const started = (await run.json()) as { runId: string }
    const events = await harbor.app.request(`/api/runs/${started.runId}/events?after=0`, {
      headers: authed(session, created.csrf),
    })
    expect(await events.text()).toContain('message_stop')
    expect(bodies).toHaveLength(1)
    const sent = JSON.parse(bodies[0] ?? '{}') as {
      tools?: Array<{ type?: string; name?: string }>
      messages?: Array<{ content?: unknown }>
    }
    expect(sent.tools).toEqual([{ type: 'deepseek_web_search', name: 'deepseek_web_search' }])
    const content = JSON.stringify(sent.messages ?? [])
    expect(content).toContain(fileId)
    expect(content).toContain('"type":"document"')
    expect(content).toContain('"file_id"')
  })

  it('applies migrations once and serves health checks', async () => {
    const before = await harbor.sql<{ id: string }[]>`select id from schema_migrations order by id`
    expect(before.map((row) => row.id)).toEqual(['001_init', '002_invite_expiry', '003_thinking_seconds', '004_thinking_started'])
    await applyMigrations(harbor.sql)
    const after = await harbor.sql<{ id: string }[]>`select id from schema_migrations order by id`
    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id))
    expect((await harbor.app.request('/healthz')).status).toBe(200)
    expect((await harbor.app.request('/readyz')).status).toBe(200)
    const secure = await harbor.app.request('https://harbor.example/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    expect(secure.headers.get('set-cookie')).toContain('Secure')
  })

  it('requires a one-time bootstrap token, expires invites, and hides upstream keys', async () => {
    const blocked = await createHarbor({ databaseUrl, masterKey, upstream, allowOpenSetup: false })
    const open = await blocked.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    expect(open.status).toBe(403)
    const config = (await (await blocked.app.request('/api/config')).json()) as { bootstrap: string }
    expect(config.bootstrap).toBe('blocked')
    await blocked.close()

    const tokenServer = await createHarbor({
      databaseUrl,
      masterKey,
      upstream,
      bootstrapToken: 'one-time-token-value',
    })
    const missing = await tokenServer.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    expect(missing.status).toBe(403)
    const setup = await tokenServer.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse', token: 'one-time-token-value' }),
    })
    expect(setup.status).toBe(200)
    const again = await tokenServer.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'bea', password: 'correct-horse', token: 'one-time-token-value' }),
    })
    expect(again.status).toBe(403)
    await tokenServer.close()

    await resetData()
    const envServer = await createHarbor({
      databaseUrl,
      masterKey,
      upstream,
      bootstrapAdmin: { username: 'root', password: 'correct-horse' },
    })
    const ready = (await (await envServer.app.request('/api/config')).json()) as { setup_required: boolean }
    expect(ready.setup_required).toBe(false)
    const login = await envServer.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'root', password: 'correct-horse' }),
    })
    expect(login.status).toBe(200)
    await envServer.close()

    await resetData()
    const setupMain = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const admin = (await setupMain.json()) as { csrf: string }
    const session = sessionOf(setupMain)
    const headers = { 'content-type': 'application/json', ...authed(session, admin.csrf, true) }
    const invite = await harbor.app.request('/api/admin/invites', {
      method: 'POST',
      headers,
      body: JSON.stringify({ maxUses: 1, expiresInHours: 24 }),
    })
    const inviteBody = (await invite.json()) as { code: string; expiresAt: string }
    expect(Date.parse(inviteBody.expiresAt)).toBeGreaterThan(Date.now())
    await harbor.sql`update invite_codes set expires_at = now() - interval '1 hour' where code = ${inviteBody.code}`
    const expired = await harbor.app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: inviteBody.code, username: 'late', password: 'another-pass' }),
    })
    expect(expired.status).toBe(400)

    const echo = await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ label: 'echo', secret: 'sk-echopoolsecretvalue', accountGroup: 'echo' }),
    })
    expect(echo.status).toBe(200)
    const listed = await harbor.app.request('/api/admin/keys', { headers: authed(session, admin.csrf) })
    expect(await listed.text()).not.toContain('sk-echopoolsecretvalue')
    const models = await harbor.app.request('/models', { headers: authed(session, admin.csrf) })
    const modelsBody = await models.text()
    expect(models.status).toBe(200)
    expect(modelsBody).not.toContain('sk-echopoolsecretvalue')
    expect(modelsBody).toContain('[redacted]')

    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ label: 'boom', secret: 'sk-boompoolsecretvalue', accountGroup: 'boom', priority: 1 }),
    })
    await harbor.sql`update api_keys set priority = 0 where label = 'boom'`
    await harbor.sql`update api_keys set status = 'error' where label = 'echo'`
    const leaked = await harbor.app.request('/models', { headers: authed(session, admin.csrf) })
    const leakedBody = await leaked.text()
    expect(leaked.status).toBe(502)
    expect(leakedBody).not.toContain('sk-boompoolsecretvalue')
    expect(leakedBody).toContain('upstream 500')
  })

  it('rate limits auth and chat, and keeps CORS on the configured origin', async () => {
    const limited = await createHarbor({
      databaseUrl,
      masterKey,
      upstream,
      allowOpenSetup: true,
      authRateLimit: 2,
      chatRateLimit: 1,
    })
    const postSetup = () =>
      limited.app.request('/api/setup/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'no', password: 'no' }),
      })
    expect((await postSetup()).status).toBe(400)
    expect((await postSetup()).status).toBe(400)
    const blockedAuth = await postSetup()
    expect(blockedAuth.status).toBe(429)
    expect(blockedAuth.headers.get('retry-after')).toBe('60')

    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    const admin = (await setup.json()) as { csrf: string }
    const session = sessionOf(setup)
    const headers = { 'content-type': 'application/json', ...authed(session, admin.csrf, true) }
    await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'good-pool-key', accountGroup: 'healthy' }),
    })
    const tight = await createHarbor({
      databaseUrl,
      masterKey,
      upstream,
      allowOpenSetup: true,
      chatRateLimit: 1,
    })
    const moved = await tight.sql`select id from users where username = 'ada'`
    expect(moved.length).toBe(1)
    await tight.app.request('/api/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'rate-chat' }),
    })
    const first = await tight.app.request('/api/conversations/rate-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'hello from the test' }),
    })
    expect(first.status).toBe(200)
    const started = (await first.json()) as { runId: string }
    const events = await tight.app.request(`/api/runs/${started.runId}/events`, {
      headers: authed(session, admin.csrf),
    })
    expect(await events.text()).toContain('"status":"complete"')
    const second = await tight.app.request('/api/conversations/rate-chat/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'hello again' }),
    })
    expect(second.status).toBe(429)
    await tight.close()
    await limited.close()

    const cors = await createHarbor({
      databaseUrl,
      masterKey,
      upstream,
      allowOpenSetup: true,
      corsOrigins: ['https://app.example'],
    })
    const corsSetup = await cors.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    expect(corsSetup.status).toBe(200)
    const corsAdmin = (await corsSetup.json()) as { csrf: string; token: string }
    const allowed = await cors.app.request('/api/me', {
      headers: { origin: 'https://app.example', authorization: `Bearer ${corsAdmin.token}` },
    })
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.example')
    const denied = await cors.app.request('/api/me', {
      headers: { origin: 'https://evil.example', authorization: `Bearer ${corsAdmin.token}` },
    })
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
    const widened = await cors.app.request('/api/admin/cors', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...authed(sessionOf(corsSetup), corsAdmin.csrf, true),
      },
      body: JSON.stringify({ origins: ['https://evil.example'] }),
    })
    expect(widened.status).toBe(403)
    await cors.close()
  })

  it('reports not ready when the database connection is closed', async () => {
    const extra = await createHarbor({ databaseUrl, masterKey, upstream, allowOpenSetup: true })
    expect((await extra.app.request('/healthz')).status).toBe(200)
    await extra.sql.end({ timeout: 1 })
    const ready = await extra.app.request('/readyz')
    expect(ready.status).toBe(503)
    expect(await ready.text()).not.toContain('postgres')
    await extra.close().catch(() => undefined)
  })
})
