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
        try {
          const parsed = JSON.parse(raw) as { system?: string }
          seen.push(`system:${parsed.system ?? ''}`)
        } catch {
          seen.push('system:')
        }
        if (key.includes('slow-stream')) {
          await new Promise((resolve) => setTimeout(resolve, 90))
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
    fileBody = ''
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

  it('applies migrations once and serves health checks', async () => {
    const before = await harbor.sql<{ id: string }[]>`select id from schema_migrations order by id`
    expect(before.map((row) => row.id)).toEqual(['001_init', '002_invite_expiry'])
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
