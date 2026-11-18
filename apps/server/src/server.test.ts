import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer as createHarbor, type HarborServer } from './app.js'

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://harbor:harbor@127.0.0.1:5432/harbor'
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

describe('harbor server', () => {
  let harbor: HarborServer
  let mock: Server
  let upstream: string
  const seen: string[] = []
  let fileBody = ''

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
        if (key.includes('fail-chat')) {
          response.writeHead(401, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ error: { message: 'unauthorized' } }))
          return
        }
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.end(sse)
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
    harbor = await createHarbor({ databaseUrl, masterKey, upstream })
  })

  afterAll(async () => {
    await harbor.close()
    await new Promise<void>((resolve, reject) => mock.close((error) => (error ? reject(error) : resolve())))
  })

  beforeEach(async () => {
    seen.length = 0
    fileBody = ''
    await harbor.sql`
      truncate table
        run_events, chat_runs, usage_events, usage_daily, alerts, balance_snapshots,
        messages, tombstones, conversations, files, auth_sessions, invite_codes,
        api_keys, user_counters, users
      restart identity cascade
    `
  })

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

    const replay = await harbor.app.request(`/api/runs/${started.runId}/events?after=1`, {
      headers: authed(session, created.csrf),
    })
    const tail = await replay.text()
    expect(tail).toContain('message_stop')
    expect(tail.startsWith('id: 1\n')).toBe(false)
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

  it('rejects a cookie write without the csrf header and uploads files with a 7 day expiry', async () => {
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
    expect(fileBody).toContain('expires_after[anchor]')
    expect(fileBody).toContain('604800')
    const saved = await harbor.sql<{ expires_at: Date | null }[]>`select expires_at from files`
    expect(saved[0]?.expires_at).toBeTruthy()
  })
})
