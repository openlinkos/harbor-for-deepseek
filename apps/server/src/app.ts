import { buildRequest, clampExpireSeconds, DEFAULT_FILE_EXPIRE_SECONDS } from '@harbor/api-client'
import { estimateCost } from '@harbor/pricing'
import { createDraft, readStreamEvent, reduceEvent, ServerSentEventDecoder } from '@harbor/sse'
import type { ContentBlock, Message, Usage } from '@harbor/types'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createReadStream, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, sep } from 'node:path'
import { Readable } from 'node:stream'
import postgres from 'postgres'
import { hashPassword, openSecret, randomToken, sealSecret, sha256, verifyPassword } from './crypto.js'
import { log } from './log.js'
import { SCHEMA } from './schema.js'

export type ServerOptions = {
  databaseUrl: string
  masterKey: Buffer
  upstream?: string
  staticDir?: string
  trustProxy?: boolean
}

type Role = 'admin' | 'member'

type AuthUser = {
  id: string
  username: string
  role: Role
  status: string
  tokenQuota: number
  searchQuota: number
  pageQuota: number
  csrf: string
  sessionId: string
}

type KeyRow = {
  id: string
  label: string
  ciphertext: Buffer
  nonce: Buffer
  last4: string
  priority: number
  status: string
  account_group: string
  last_balance_cny: string | null
  is_available: boolean | null
  last_error: string | null
}

const TOKEN_QUOTA = 2_000_000
const SEARCH_QUOTA = 100
const PAGE_QUOTA = 80
const LOW_BALANCE_DEFAULT = 50

const hits = new Map<string, number[]>()

const readBody = async <T>(c: { req: { json: () => Promise<T> } }): Promise<T> => {
  try {
    return await c.req.json()
  } catch {
    return {} as T
  }
}

const limited = (ip: string): boolean => {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 10 * 60 * 1000)
  if (recent.length >= 30) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

const shanghaiDay = (date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const nextShanghaiMidnight = (date = new Date()): string => {
  const start = new Date(`${shanghaiDay(date)}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(start))
  return `${parts}T00:00:00+08:00`
}

const asNumber = (value: unknown): number => Number(value ?? 0)

const publicKey = (row: KeyRow) => ({
  id: row.id,
  label: row.label,
  last4: row.last4,
  priority: row.priority,
  status: row.status,
  accountGroup: row.account_group,
  balanceCny: row.last_balance_cny,
  isAvailable: row.is_available,
  lastError: row.last_error,
})

export type HarborServer = {
  app: Hono
  sql: postgres.Sql
  close: () => Promise<void>
  checkBalances: () => Promise<void>
}

export const createServer = async (options: ServerOptions): Promise<HarborServer> => {
  const sql = postgres(options.databaseUrl, { max: 8, onnotice: () => undefined })
  await sql.unsafe(SCHEMA)
  await sql`update chat_runs set status = 'aborted', finished_at = now(), error = 'restarted' where status = 'streaming'`
  const upstream = options.upstream ?? 'https://api.deepseek.com'
  const waiters = new Map<string, Set<() => void>>()
  const aborts = new Map<string, AbortController>()

  const notify = (runId: string) => {
    for (const wake of waiters.get(runId) ?? []) {
      wake()
    }
  }

  const nextRev = async (userId: string): Promise<number> => {
    const rows = await sql<{ next_rev: string }[]>`
      update user_counters set next_rev = next_rev + 1 where user_id = ${userId} returning next_rev
    `
    return Number(rows[0]?.next_rev ?? 0)
  }

  const threshold = async (): Promise<number> => {
    const rows = await sql<{ value: unknown }[]>`select value from app_settings where key = 'low_balance_cny'`
    const value = Number(rows[0]?.value ?? LOW_BALANCE_DEFAULT)
    return Number.isFinite(value) ? value : LOW_BALANCE_DEFAULT
  }

  const pickKey = async (skipGroups: Set<string>): Promise<KeyRow | null> => {
    const rows = await sql<KeyRow[]>`
      select id, label, ciphertext, nonce, last4, priority, status, account_group,
             last_balance_cny::text, is_available, last_error
      from api_keys
      where status = 'active' and is_available is distinct from false
      order by priority asc, last_used_at asc nulls first
    `
    return rows.find((row) => !skipGroups.has(row.account_group)) ?? null
  }

  const markKey = async (id: string, status: string, error: string) => {
    await sql`update api_keys set status = ${status}, last_error = ${error} where id = ${id}`
  }

  const recordUsage = async (input: {
    userId: string
    keyId: string | null
    conversationId: string
    requestId: string | null
    model: string
    usage: Usage
    status: number
  }) => {
    const at = new Date()
    const cost = estimateCost(input.usage, at)
    const tools = input.usage.server_tool_use
    const thinking = input.usage.output_tokens_details?.thinking_tokens ?? 0
    const pages = input.usage.file_pages ?? 0
    const id = crypto.randomUUID()
    await sql`
      insert into usage_events (
        id, user_id, api_key_id, conversation_id, request_id, taken_at, is_peak, model,
        input_tokens, cache_read_input_tokens, output_tokens, thinking_tokens,
        tool_search, tool_fetch, tool_image_search, web_search_requests, web_fetch_requests,
        file_pages, estimated_cny, http_status
      ) values (
        ${id}, ${input.userId}, ${input.keyId}, ${input.conversationId}, ${input.requestId}, ${at},
        ${cost.peak}, ${input.model},
        ${input.usage.input_tokens}, ${input.usage.cache_read_input_tokens}, ${input.usage.output_tokens}, ${thinking},
        ${tools?.tool_search ?? 0}, ${tools?.tool_fetch ?? 0}, ${tools?.tool_image_search ?? 0},
        ${tools?.web_search_requests ?? 0}, ${tools?.web_fetch_requests ?? 0},
        ${pages}, ${cost.totalCny}, ${input.status}
      )
    `
    const day = shanghaiDay(at)
    const keyId = input.keyId ?? '00000000-0000-0000-0000-000000000000'
    await sql`
      insert into usage_daily (
        user_id, day, api_key_id, input_tokens, cache_read_input_tokens, output_tokens,
        tool_search, tool_fetch, tool_image_search, file_pages, estimated_cny
      ) values (
        ${input.userId}, ${day}, ${keyId},
        ${input.usage.input_tokens}, ${input.usage.cache_read_input_tokens}, ${input.usage.output_tokens},
        ${tools?.tool_search ?? 0}, ${tools?.tool_fetch ?? 0}, ${tools?.tool_image_search ?? 0},
        ${pages}, ${cost.totalCny}
      )
      on conflict (user_id, day, api_key_id) do update set
        input_tokens = usage_daily.input_tokens + excluded.input_tokens,
        cache_read_input_tokens = usage_daily.cache_read_input_tokens + excluded.cache_read_input_tokens,
        output_tokens = usage_daily.output_tokens + excluded.output_tokens,
        tool_search = usage_daily.tool_search + excluded.tool_search,
        tool_fetch = usage_daily.tool_fetch + excluded.tool_fetch,
        tool_image_search = usage_daily.tool_image_search + excluded.tool_image_search,
        file_pages = usage_daily.file_pages + excluded.file_pages,
        estimated_cny = usage_daily.estimated_cny + excluded.estimated_cny
    `
  }

  const quotaState = async (user: AuthUser) => {
    const rows = await sql<{ tokens: string; searches: string; pages: string }[]>`
      select
        coalesce(sum(input_tokens + cache_read_input_tokens + output_tokens), 0)::text as tokens,
        coalesce(sum(tool_search + tool_image_search), 0)::text as searches,
        coalesce(sum(file_pages), 0)::text as pages
      from usage_events
      where user_id = ${user.id}
        and (taken_at at time zone 'Asia/Shanghai')::date = (now() at time zone 'Asia/Shanghai')::date
    `
    return {
      tokens: Number(rows[0]?.tokens ?? 0),
      searches: Number(rows[0]?.searches ?? 0),
      pages: Number(rows[0]?.pages ?? 0),
    }
  }

  const checkOneBalance = async (row: KeyRow) => {
    let plain = ''
    try {
      plain = openSecret(row.ciphertext, row.nonce, options.masterKey)
      const response = await fetch(`${upstream}/user/balance`, {
        headers: { Authorization: `Bearer ${plain}` },
      })
      if (!response.ok) {
        await sql`update api_keys set last_error = ${`balance ${response.status}`}, last_checked_at = now() where id = ${row.id}`
        return
      }
      const body = (await response.json()) as {
        is_available?: boolean
        balance_infos?: Array<{ total_balance?: string; granted_balance?: string; topped_up_balance?: string }>
      }
      const info = body.balance_infos?.[0]
      const total = info?.total_balance ?? null
      await sql`
        update api_keys set
          last_balance_cny = ${total},
          is_available = ${body.is_available !== false},
          last_checked_at = now(),
          last_error = null,
          status = ${body.is_available === false ? 'exhausted' : 'active'}
        where id = ${row.id}
      `
      await sql`
        insert into balance_snapshots (id, api_key_id, is_available, total_cny, granted_cny, topped_up_cny)
        values (${crypto.randomUUID()}, ${row.id}, ${body.is_available !== false}, ${total}, ${info?.granted_balance ?? null}, ${info?.topped_up_balance ?? null})
      `
      const limit = await threshold()
      if (total !== null && Number(total) < limit) {
        const open = await sql`select id from alerts where api_key_id = ${row.id} and kind = 'low_balance' and read_at is null limit 1`
        if (open.length === 0) {
          await sql`
            insert into alerts (id, api_key_id, kind, message)
            values (${crypto.randomUUID()}, ${row.id}, 'low_balance', ${`Key ending ${row.last4} is below ${limit} CNY (${total}).`})
          `
        }
      }
    } catch (error) {
      log('warn', 'balance check failed', { keyId: row.id, error: error instanceof Error ? error.name : 'error' })
      await sql`update api_keys set last_error = 'balance check failed', last_checked_at = now() where id = ${row.id}`
    } finally {
      plain = ''
    }
  }

  const checkBalances = async () => {
    const rows = await sql<KeyRow[]>`
      select id, label, ciphertext, nonce, last4, priority, status, account_group,
             last_balance_cny::text, is_available, last_error
      from api_keys where status <> 'error'
    `
    for (const row of rows) {
      await checkOneBalance(row)
    }
  }

  const timer = setInterval(() => {
    void checkBalances()
  }, 10 * 60 * 1000)
  timer.unref()

  const issueSession = async (userId: string, deviceName: string) => {
    const token = randomToken()
    const csrf = randomToken()
    const id = crypto.randomUUID()
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await sql`
      insert into auth_sessions (id, user_id, token_hash, csrf, device_name, expires_at)
      values (${id}, ${userId}, ${sha256(token)}, ${csrf}, ${deviceName.slice(0, 120)}, ${expires})
    `
    await sql`update users set last_login_at = now() where id = ${userId}`
    return { token, csrf, sessionId: id }
  }

  const app = new Hono()

  app.use('*', async (c, next) => {
    const origin = c.req.header('origin')
    if (origin) {
      c.header('Access-Control-Allow-Origin', origin)
      c.header('Vary', 'Origin')
      c.header('Access-Control-Allow-Credentials', 'true')
      c.header('Access-Control-Allow-Headers', 'content-type, authorization, x-harbor-csrf')
      c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    }
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204)
    }
    const started = Date.now()
    await next()
    log('info', 'request', { method: c.req.method, path: new URL(c.req.url).pathname, status: c.res.status, ms: Date.now() - started })
  })

  const clientIp = (c: { req: { header: (name: string) => string | undefined } }) => {
    if (options.trustProxy) {
      return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    }
    return 'local'
  }

  const secureCookie = (url: string, forwarded?: string) =>
    options.trustProxy ? forwarded === 'https' : url.startsWith('https:')

  const writeSessionCookie = (c: Parameters<typeof setCookie>[0], token: string) => {
    setCookie(c, 'harbor_session', token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: secureCookie(c.req.url, c.req.header('x-forwarded-proto')),
      maxAge: 30 * 24 * 60 * 60,
    })
  }

  const auth = async (c: Parameters<typeof getCookie>[0], write: boolean): Promise<AuthUser | Response> => {
    const header = c.req.header('authorization') ?? ''
    const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
    const cookie = getCookie(c, 'harbor_session') ?? ''
    const token = bearer || cookie
    if (!token) {
      return c.json({ error: { message: 'unauthorized' } }, 401)
    }
    const rows = await sql<
      {
        session_id: string
        csrf: string
        id: string
        username: string
        role: Role
        status: string
        token_quota: string
        search_quota: number
        page_quota: number
      }[]
    >`
      select s.id as session_id, s.csrf, u.id, u.username, u.role, u.status, u.token_quota::text, u.search_quota, u.page_quota
      from auth_sessions s
      join users u on u.id = s.user_id
      where s.token_hash = ${sha256(token)} and s.expires_at > now()
    `
    const row = rows[0]
    if (!row || row.status !== 'active') {
      return c.json({ error: { message: 'unauthorized' } }, 401)
    }
    if (!bearer && write) {
      const csrf = c.req.header('x-harbor-csrf') ?? ''
      if (!csrf || csrf !== row.csrf) {
        return c.json({ error: { message: 'csrf' } }, 403)
      }
    }
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      status: row.status,
      tokenQuota: Number(row.token_quota),
      searchQuota: row.search_quota,
      pageQuota: row.page_quota,
      csrf: row.csrf,
      sessionId: row.session_id,
    }
  }

  const requireUser = async (c: Parameters<typeof getCookie>[0], write: boolean) => {
    const user = await auth(c, write)
    return user
  }

  app.get('/api/health', (c) => c.json({ ok: true }))

  app.get('/api/config', async (c) => {
    const rows = await sql`select id from users where role = 'admin' limit 1`
    return c.json({
      product_name: 'Harbor',
      setup_required: rows.length === 0,
      mode: 'server',
    })
  })

  app.post('/api/setup/admin', async (c) => {
    if (limited(clientIp(c))) {
      return c.json({ error: { message: 'rate limited' } }, 429)
    }
    const existing = await sql`select id from users where role = 'admin' limit 1`
    if (existing.length > 0) {
      return c.json({ error: { message: 'setup already finished' } }, 403)
    }
    const body = await readBody<{ username?: string; password?: string }>(c)
    const username = (body.username ?? '').trim()
    const password = body.password ?? ''
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username) || password.length < 8) {
      return c.json({ error: { message: 'username or password is not acceptable' } }, 400)
    }
    const id = crypto.randomUUID()
    await sql`
      insert into users (id, username, password_hash, role, token_quota, search_quota, page_quota)
      values (${id}, ${username}, ${await hashPassword(password)}, 'admin', ${TOKEN_QUOTA}, ${SEARCH_QUOTA}, ${PAGE_QUOTA})
    `
    await sql`insert into user_counters (user_id, next_rev) values (${id}, 0)`
    const session = await issueSession(id, c.req.header('user-agent') ?? 'web')
    writeSessionCookie(c, session.token)
    return c.json({ user: { id, username, role: 'admin' }, csrf: session.csrf })
  })

  app.post('/api/auth/register', async (c) => {
    if (limited(clientIp(c))) {
      return c.json({ error: { message: 'rate limited' } }, 429)
    }
    const body = await readBody<{ code?: string; username?: string; password?: string }>(c)
    const username = (body.username ?? '').trim()
    const password = body.password ?? ''
    const code = (body.code ?? '').trim()
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username) || password.length < 8 || !code) {
      return c.json({ error: { message: 'invite, username, or password is not acceptable' } }, 400)
    }
    const invites = await sql<{ id: string; max_uses: number; used_count: number; expires_at: Date | null; revoked: boolean }[]>`
      select id, max_uses, used_count, expires_at, revoked from invite_codes where code = ${code}
    `
    const invite = invites[0]
    if (!invite || invite.revoked || invite.used_count >= invite.max_uses || (invite.expires_at && invite.expires_at < new Date())) {
      return c.json({ error: { message: 'invite is not usable' } }, 400)
    }
    const id = crypto.randomUUID()
    try {
      await sql`
        insert into users (id, username, password_hash, role, token_quota, search_quota, page_quota)
        values (${id}, ${username}, ${await hashPassword(password)}, 'member', ${TOKEN_QUOTA}, ${SEARCH_QUOTA}, ${PAGE_QUOTA})
      `
    } catch {
      return c.json({ error: { message: 'username is taken' } }, 409)
    }
    await sql`insert into user_counters (user_id, next_rev) values (${id}, 0)`
    await sql`update invite_codes set used_count = used_count + 1 where id = ${invite.id}`
    const session = await issueSession(id, c.req.header('user-agent') ?? 'web')
    writeSessionCookie(c, session.token)
    return c.json({ user: { id, username, role: 'member' }, csrf: session.csrf })
  })

  app.post('/api/auth/login', async (c) => {
    if (limited(clientIp(c))) {
      return c.json({ error: { message: 'rate limited' } }, 429)
    }
    const body = await readBody<{ username?: string; password?: string }>(c)
    const rows = await sql<{ id: string; password_hash: string; role: Role; status: string; username: string }[]>`
      select id, username, password_hash, role, status from users where username = ${(body.username ?? '').trim()}
    `
    const row = rows[0]
    if (!row || row.status !== 'active' || !(await verifyPassword(body.password ?? '', row.password_hash))) {
      return c.json({ error: { message: 'invalid username or password' } }, 401)
    }
    const session = await issueSession(row.id, c.req.header('user-agent') ?? 'web')
    writeSessionCookie(c, session.token)
    return c.json({ user: { id: row.id, username: row.username, role: row.role }, csrf: session.csrf })
  })

  app.post('/api/auth/logout', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    await sql`delete from auth_sessions where id = ${user.sessionId}`
    deleteCookie(c, 'harbor_session', { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/me', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    return c.json({
      user: { id: user.id, username: user.username, role: user.role },
      csrf: user.csrf,
    })
  })

  app.get('/api/auth/devices', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    const rows = await sql`
      select id, device_name, created_at, expires_at from auth_sessions
      where user_id = ${user.id} order by created_at desc
    `
    return c.json({
      devices: rows.map((row) => ({
        id: row.id,
        deviceName: row.device_name,
        createdAt: row.created_at,
        current: row.id === user.sessionId,
      })),
    })
  })

  app.delete('/api/auth/devices/:id', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    await sql`delete from auth_sessions where id = ${c.req.param('id')} and user_id = ${user.id}`
    return c.json({ ok: true })
  })

  const mapConversation = (row: Record<string, unknown>) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    titleSource: row.title_source,
    model: row.model,
    thinking: row.thinking,
    search: row.search,
    readLink: row.read_link,
    effort: row.effort,
    pinned: row.pinned,
    archived: row.archived,
    activeLeafId: row.active_leaf_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rev: asNumber(row.rev),
    deletedAt: row.deleted_at,
  })

  const mapMessage = (row: Record<string, unknown>) => ({
    id: String(row.id),
    conversationId: String(row.conversation_id),
    parentId: row.parent_id,
    role: row.role,
    status: row.status,
    blocks: row.blocks_json ?? [],
    usage: row.usage_json,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rev: asNumber(row.rev),
    deletedAt: row.deleted_at,
  })

  app.get('/api/sync', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    const cursor = Number(c.req.query('cursor') ?? '0')
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '100')))
    const conversations = await sql`
      select * from conversations where user_id = ${user.id} and rev > ${cursor} and deleted_at is null
      order by rev asc limit ${limit}
    `
    const messages = await sql`
      select * from messages where user_id = ${user.id} and rev > ${cursor} and deleted_at is null
      order by rev asc limit ${limit}
    `
    const tombstones = await sql`
      select * from tombstones where user_id = ${user.id} and rev > ${cursor}
      order by rev asc limit ${limit}
    `
    const revs = [
      ...conversations.map((row) => asNumber(row.rev)),
      ...messages.map((row) => asNumber(row.rev)),
      ...tombstones.map((row) => asNumber(row.rev)),
    ]
    const next = revs.length ? Math.max(...revs) : cursor
    return c.json({
      cursor: next,
      conversations: conversations.map((row) => mapConversation(row)),
      messages: messages.map((row) => mapMessage(row)),
      tombstones: tombstones.map((row) => ({
        key: `${row.entity}:${row.entity_id}`,
        entity: row.entity,
        id: row.entity_id,
        rev: asNumber(row.rev),
        deletedAt: row.deleted_at,
      })),
    })
  })

  app.post('/api/migrations/local', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    const body = await readBody<{ conversations?: Array<Record<string, unknown>> }>(c)
    let added = 0
    let skipped = 0
    for (const incoming of body.conversations ?? []) {
      const id = String(incoming.id ?? '')
      if (!id) {
        continue
      }
      const existing = await sql`select id from conversations where id = ${id} and user_id = ${user.id}`
      if (existing.length > 0) {
        skipped += 1
        continue
      }
      const rev = await nextRev(user.id)
      const now = new Date().toISOString()
      await sql`
        insert into conversations (
          id, user_id, title, title_source, model, thinking, search, read_link, effort,
          pinned, archived, active_leaf_id, created_at, updated_at, rev
        ) values (
          ${id}, ${user.id}, ${String(incoming.title ?? '')}, ${String(incoming.titleSource ?? 'default')},
          ${String(incoming.model ?? 'deepseek-flash')}, ${incoming.thinking !== false}, ${incoming.search === true},
          ${incoming.readLink === true}, ${String(incoming.effort ?? 'high')}, ${incoming.pinned === true},
          ${incoming.archived === true}, ${incoming.activeLeafId ? String(incoming.activeLeafId) : null},
          ${String(incoming.createdAt ?? now)}, ${now}, ${rev}
        )
      `
      const messages = Array.isArray(incoming.messages) ? incoming.messages : []
      for (const message of messages) {
        if (!message || typeof message !== 'object') {
          continue
        }
        const record = message as Record<string, unknown>
        const messageId = String(record.id ?? '')
        if (!messageId) {
          continue
        }
        const messageRev = await nextRev(user.id)
        await sql`
          insert into messages (
            id, user_id, conversation_id, parent_id, role, status, blocks_json, usage_json,
            error_message, created_at, updated_at, rev
          ) values (
            ${messageId}, ${user.id}, ${id}, ${record.parentId ? String(record.parentId) : null},
            ${record.role === 'assistant' ? 'assistant' : 'user'}, ${String(record.status ?? 'complete')},
            ${sql.json((record.blocks ?? []) as postgres.JSONValue)}, ${record.usage ? sql.json(record.usage as postgres.JSONValue) : null},
            ${record.errorMessage ? String(record.errorMessage) : null},
            ${String(record.createdAt ?? now)}, ${now}, ${messageRev}
          )
        `
      }
      added += 1
    }
    return c.json({ added, skipped })
  })

  app.get('/api/conversations', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    const rows = await sql`
      select * from conversations where user_id = ${user.id} and deleted_at is null order by updated_at desc
    `
    return c.json({ conversations: rows.map((row) => mapConversation(row)) })
  })

  app.post('/api/conversations', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    const body = await readBody<Record<string, unknown>>(c)
    const id = String(body.id ?? crypto.randomUUID())
    const rev = await nextRev(user.id)
    const now = new Date().toISOString()
    await sql`
      insert into conversations (
        id, user_id, title, title_source, model, thinking, search, read_link, effort, created_at, updated_at, rev
      ) values (
        ${id}, ${user.id}, ${String(body.title ?? '')}, 'default', ${String(body.model ?? 'deepseek-flash')},
        ${body.thinking !== false}, ${body.search === true}, ${body.readLink === true}, ${String(body.effort ?? 'high')},
        ${now}, ${now}, ${rev}
      )
      on conflict (id) do nothing
    `
    const rows = await sql`select * from conversations where id = ${id} and user_id = ${user.id}`
    return c.json({ conversation: rows[0] ? mapConversation(rows[0]) : null })
  })

  app.patch('/api/conversations/:id', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    const body = await readBody<Record<string, unknown>>(c)
    const rev = await nextRev(user.id)
    const title = typeof body.title === 'string' ? body.title : null
    await sql`
      update conversations set
        title = coalesce(${title}, title),
        title_source = case when ${title} is null then title_source else 'user' end,
        pinned = coalesce(${typeof body.pinned === 'boolean' ? body.pinned : null}, pinned),
        archived = coalesce(${typeof body.archived === 'boolean' ? body.archived : null}, archived),
        model = coalesce(${typeof body.model === 'string' ? body.model : null}, model),
        thinking = coalesce(${typeof body.thinking === 'boolean' ? body.thinking : null}, thinking),
        search = coalesce(${typeof body.search === 'boolean' ? body.search : null}, search),
        read_link = coalesce(${typeof body.readLink === 'boolean' ? body.readLink : null}, read_link),
        effort = coalesce(${typeof body.effort === 'string' ? body.effort : null}, effort),
        active_leaf_id = coalesce(${typeof body.activeLeafId === 'string' ? body.activeLeafId : null}, active_leaf_id),
        rev = ${rev},
        updated_at = now()
      where id = ${c.req.param('id')} and user_id = ${user.id} and deleted_at is null
    `
    const rows = await sql`select * from conversations where id = ${c.req.param('id')} and user_id = ${user.id}`
    return c.json({ conversation: rows[0] ? mapConversation(rows[0]) : null })
  })

  app.delete('/api/conversations/:id', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    const id = c.req.param('id')
    const rev = await nextRev(user.id)
    await sql`update conversations set deleted_at = now(), rev = ${rev} where id = ${id} and user_id = ${user.id}`
    await sql`
      insert into tombstones (user_id, entity, entity_id, rev, deleted_at)
      values (${user.id}, 'conversation', ${id}, ${rev}, now())
      on conflict (user_id, entity, entity_id) do update set rev = excluded.rev, deleted_at = excluded.deleted_at
    `
    const messages = await sql<{ id: string }[]>`select id from messages where conversation_id = ${id} and user_id = ${user.id}`
    for (const message of messages) {
      const messageRev = await nextRev(user.id)
      await sql`update messages set deleted_at = now(), blocks_json = '[]'::jsonb, rev = ${messageRev} where id = ${message.id}`
      await sql`
        insert into tombstones (user_id, entity, entity_id, rev, deleted_at)
        values (${user.id}, 'message', ${message.id}, ${messageRev}, now())
        on conflict (user_id, entity, entity_id) do update set rev = excluded.rev, deleted_at = excluded.deleted_at
      `
    }
    return c.json({ ok: true })
  })

  app.get('/api/conversations/:id/messages', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    const rows = await sql`
      select * from messages
      where conversation_id = ${c.req.param('id')} and user_id = ${user.id} and deleted_at is null
      order by created_at asc
    `
    return c.json({ messages: rows.map((row) => mapMessage(row)) })
  })

  const appendEvent = async (runId: string, payload: unknown) => {
    const rows = await sql<{ last_seq: number }[]>`
      update chat_runs set last_seq = last_seq + 1 where id = ${runId} returning last_seq
    `
    const seq = rows[0]?.last_seq ?? 1
    await sql`insert into run_events (run_id, seq, payload) values (${runId}, ${seq}, ${sql.json(payload as postgres.JSONValue)})`
    notify(runId)
    return seq
  }

  const finishRun = async (runId: string, status: string, error: string | null) => {
    await sql`update chat_runs set status = ${status}, finished_at = now(), error = ${error} where id = ${runId}`
    notify(runId)
  }

  const upstreamCall = async (path: string, init: RequestInit, skipGroups: Set<string>) => {
    let lastStatus = 503
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const key = await pickKey(skipGroups)
      if (!key) {
        break
      }
      const plain = openSecret(key.ciphertext, key.nonce, options.masterKey)
      const headers = new Headers(init.headers)
      headers.set('x-api-key', plain)
      headers.delete('authorization')
      let response: Response
      try {
        response = await fetch(`${upstream}${path}`, { ...init, headers })
      } catch (error) {
        log('warn', 'upstream network', { keyId: key.id, error: error instanceof Error ? error.name : 'error' })
        skipGroups.add(key.account_group)
        continue
      }
      await sql`update api_keys set last_used_at = now() where id = ${key.id}`
      if (response.status === 401) {
        await markKey(key.id, 'error', 'unauthorized')
        skipGroups.add(key.account_group)
        lastStatus = 401
        continue
      }
      if (response.status === 402) {
        await markKey(key.id, 'exhausted', 'payment required')
        skipGroups.add(key.account_group)
        lastStatus = 402
        continue
      }
      if (response.status === 429) {
        skipGroups.add(key.account_group)
        lastStatus = 429
        continue
      }
      return { response, key }
    }
    return { response: null as Response | null, key: null as KeyRow | null, lastStatus }
  }

  const executeRun = async (runId: string, user: AuthUser, conversationId: string, messageId: string, requestMessages: Message[], prefs: {
    model: 'deepseek-flash' | 'deepseek-v4-pro'
    thinking: boolean
    search: boolean
    readLink: boolean
    effort: 'low' | 'high' | 'max'
    requestTitle: boolean
  }) => {
    const controller = new AbortController()
    aborts.set(runId, controller)
    const body = buildRequest({
      ...prefs,
      safetyLevel: 'high',
      messages: requestMessages,
    })
    try {
      const result = await upstreamCall(
        '/anthropic/v1/messages',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
        new Set(),
      )
      if (!result.response || !result.key) {
        await finishRun(runId, 'error', 'no usable key')
        await sql`update messages set status = 'error', error_message = 'no usable key', updated_at = now() where id = ${messageId}`
        return
      }
      await sql`update chat_runs set api_key_id = ${result.key.id} where id = ${runId}`
      if (!result.response.ok || !result.response.body) {
        await finishRun(runId, 'error', `upstream ${result.response.status}`)
        await sql`update messages set status = 'error', error_message = ${`upstream ${result.response.status}`}, updated_at = now() where id = ${messageId}`
        return
      }
      const decoder = new ServerSentEventDecoder()
      const textDecoder = new TextDecoder()
      const reader = result.response.body.getReader()
      let draft = createDraft()
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        const frames = decoder.push(textDecoder.decode(value ?? new Uint8Array(), { stream: !done }))
        if (done) {
          frames.push(...decoder.end())
        }
        for (const frame of frames) {
          let payload: unknown
          try {
            payload = JSON.parse(frame.data)
          } catch {
            continue
          }
          const event = readStreamEvent(payload)
          if (!event || event.type === 'ping') {
            continue
          }
          draft = reduceEvent(draft, event)
          await appendEvent(runId, event)
          if (event.type === 'message_delta' && event.delta.title) {
            const rev = await nextRev(user.id)
            await sql`
              update conversations set title = ${event.delta.title}, title_source = 'auto', rev = ${rev}, updated_at = now()
              where id = ${conversationId} and title_source <> 'user'
            `
          }
        }
        if (done) {
          break
        }
      }
      const refused = draft.stopReason === 'refusal'
      const status = controller.signal.aborted ? 'aborted' : refused ? 'refused' : draft.stopped ? 'complete' : 'error'
      const blocks = refused ? [] : draft.blocks.filter(Boolean)
      const messageRev = await nextRev(user.id)
      await sql`
        update messages set
          status = ${status},
          blocks_json = ${sql.json(blocks as postgres.JSONValue)},
          usage_json = ${draft.usage ? sql.json(draft.usage as unknown as postgres.JSONValue) : null},
          error_message = ${status === 'error' ? 'interrupted' : null},
          rev = ${messageRev},
          updated_at = now()
        where id = ${messageId}
      `
      if (draft.usage) {
        await recordUsage({
          userId: user.id,
          keyId: result.key.id,
          conversationId,
          requestId: draft.requestId,
          model: prefs.model,
          usage: draft.usage,
          status: 200,
        })
      }
      await finishRun(runId, status === 'complete' || status === 'refused' || status === 'aborted' ? status : 'error', null)
    } catch (error) {
      if (controller.signal.aborted) {
        await finishRun(runId, 'aborted', null)
        return
      }
      log('error', 'run failed', { runId, error: error instanceof Error ? error.name : 'error' })
      await finishRun(runId, 'error', 'upstream failed')
      await sql`update messages set status = 'error', error_message = 'upstream failed', updated_at = now() where id = ${messageId}`
    } finally {
      aborts.delete(runId)
    }
  }

  app.post('/api/conversations/:id/runs', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    const conversationId = c.req.param('id')
    const conversations = await sql<Record<string, unknown>[]>`
      select * from conversations where id = ${conversationId} and user_id = ${user.id} and deleted_at is null
    `
    const conversation = conversations[0]
    if (!conversation) {
      return c.json({ error: { message: 'conversation not found' } }, 404)
    }
    const used = await quotaState(user)
    if (used.tokens >= user.tokenQuota || used.searches >= user.searchQuota || used.pages >= user.pageQuota) {
      return c.json(
        {
          error: {
            type: 'rate_limited',
            message: '今天的额度已用完，将在明天 00:00（北京时间）重置',
            reset_at: nextShanghaiMidnight(),
          },
        },
        429,
      )
    }
    const keys = await sql`select id from api_keys where status = 'active' limit 1`
    if (keys.length === 0) {
      return c.json({ error: { message: 'no API key is configured' } }, 503)
    }
    const body = await readBody<Record<string, unknown>>(c)
    const now = new Date().toISOString()
    const regenerate = typeof body.parentId === 'string' && !body.text
    let parentId = regenerate ? String(body.parentId) : (conversation.active_leaf_id as string | null)
    let userMessageId = regenerate ? String(body.parentId) : crypto.randomUUID()
    if (!regenerate) {
      const rev = await nextRev(user.id)
      const blocks: ContentBlock[] = []
      if (typeof body.text === 'string' && body.text.trim()) {
        blocks.push({ type: 'text', text: body.text })
      }
      if (Array.isArray(body.files)) {
        for (const file of body.files) {
          if (!file || typeof file !== 'object') {
            continue
          }
          const record = file as Record<string, unknown>
          if (typeof record.fileId === 'string') {
            blocks.push({
              type: 'file_ref',
              fileId: record.fileId,
              filename: String(record.filename ?? 'file'),
              media: record.media === 'image' ? 'image' : 'document',
              purpose: record.purpose === 'text_recognition' || record.purpose === 'rich_layout_recognition' ? record.purpose : 'user_data',
              bytes: Number(record.bytes ?? 0),
              expiresAt: typeof record.expiresAt === 'number' ? record.expiresAt : null,
            })
          }
        }
      }
      await sql`
        insert into messages (id, user_id, conversation_id, parent_id, role, status, blocks_json, created_at, updated_at, rev)
        values (${userMessageId}, ${user.id}, ${conversationId}, ${parentId}, 'user', 'complete', ${sql.json(blocks as postgres.JSONValue)}, ${now}, ${now}, ${rev})
      `
      parentId = userMessageId
    }
    const assistantId = crypto.randomUUID()
    const assistantRev = await nextRev(user.id)
    await sql`
      insert into messages (id, user_id, conversation_id, parent_id, role, status, blocks_json, created_at, updated_at, rev)
      values (${assistantId}, ${user.id}, ${conversationId}, ${parentId}, 'assistant', 'streaming', '[]'::jsonb, ${now}, ${now}, ${assistantRev})
    `
    const leafRev = await nextRev(user.id)
    const model = body.model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-flash'
    const effort = body.effort === 'low' || body.effort === 'max' ? body.effort : 'high'
    await sql`
      update conversations set
        active_leaf_id = ${assistantId},
        model = ${model},
        thinking = ${body.thinking !== false},
        search = ${body.search === true},
        read_link = ${body.readLink === true},
        effort = ${effort},
        rev = ${leafRev},
        updated_at = now()
      where id = ${conversationId}
    `
    const historyRows = await sql<Record<string, unknown>[]>`
      select * from messages where conversation_id = ${conversationId} and user_id = ${user.id} and deleted_at is null
    `
    const history = historyRows.map((row) => mapMessage(row) as Message)
    const byId = new Map(history.map((message) => [message.id, message]))
    const path: Message[] = []
    let cursor = byId.get(userMessageId)
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id)
      path.push(cursor)
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    }
    path.reverse()
    const runId = crypto.randomUUID()
    await sql`
      insert into chat_runs (id, user_id, conversation_id, message_id, status)
      values (${runId}, ${user.id}, ${conversationId}, ${assistantId}, 'streaming')
    `
    void executeRun(runId, user, conversationId, assistantId, path, {
      model,
      thinking: body.thinking !== false,
      search: body.search === true,
      readLink: body.readLink === true,
      effort,
      requestTitle: conversation.title_source !== 'user',
    })
    return c.json({ runId, userMessageId, assistantMessageId: assistantId })
  })

  app.get('/api/runs/:id/events', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    const runId = c.req.param('id')
    const owned = await sql`select id, status from chat_runs where id = ${runId} and user_id = ${user.id}`
    if (owned.length === 0) {
      return c.json({ error: { message: 'not found' } }, 404)
    }
    let cursor = Number(c.req.query('after') ?? '0')
    const encoder = new TextEncoder()
    const signal = c.req.raw.signal
    const stream = new ReadableStream({
      async start(controller) {
        const send = (chunk: string) => controller.enqueue(encoder.encode(chunk))
        try {
          while (!signal.aborted) {
            const rows = await sql<{ seq: number; payload: unknown }[]>`
              select seq, payload from run_events where run_id = ${runId} and seq > ${cursor} order by seq
            `
            for (const row of rows) {
              cursor = row.seq
              send(`id: ${row.seq}\ndata: ${JSON.stringify(row.payload)}\n\n`)
            }
            const current = await sql<{ status: string }[]>`select status from chat_runs where id = ${runId}`
            if (current[0]?.status !== 'streaming') {
              send(`event: end\ndata: ${JSON.stringify({ status: current[0]?.status ?? 'error' })}\n\n`)
              controller.close()
              return
            }
            await new Promise<void>((resolve) => {
              const set = waiters.get(runId) ?? new Set()
              const wake = () => {
                set.delete(wake)
                resolve()
              }
              set.add(wake)
              waiters.set(runId, set)
              const timer = setTimeout(() => {
                set.delete(wake)
                send(`: ping\n\n`)
                resolve()
              }, 15000)
              signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer)
                  set.delete(wake)
                  resolve()
                },
                { once: true },
              )
            })
          }
          controller.close()
        } catch (error) {
          log('warn', 'event stream closed', { runId, error: error instanceof Error ? error.name : 'error' })
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    })
  })

  app.post('/api/runs/:id/abort', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    const runId = c.req.param('id')
    const rows = await sql<{ message_id: string }[]>`
      select message_id from chat_runs where id = ${runId} and user_id = ${user.id}
    `
    if (rows.length === 0) {
      return c.json({ error: { message: 'not found' } }, 404)
    }
    aborts.get(runId)?.abort()
    await finishRun(runId, 'aborted', null)
    await sql`update messages set status = 'aborted', updated_at = now() where id = ${rows[0]?.message_id}`
    return c.json({ ok: true })
  })

  app.post('/api/files', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    const form = await c.req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return c.json({ error: { message: 'file required' } }, 400)
    }
    const purpose = String(form.get('purpose') ?? 'user_data')
    const outgoing = new FormData()
    outgoing.set('purpose', purpose)
    outgoing.set('expires_after[anchor]', 'created_at')
    outgoing.set('expires_after[seconds]', String(clampExpireSeconds(7)))
    outgoing.set('file', file, file.name)
    const result = await upstreamCall('/files', { method: 'POST', body: outgoing }, new Set())
    if (!result.response?.ok) {
      return c.json({ error: { message: 'upload failed' } }, 502)
    }
    const raw = (await result.response.json()) as { id?: string; bytes?: number; expires_at?: number; filename?: string; purpose?: string }
    await sql`
      insert into files (id, user_id, provider_file_id, filename, purpose, bytes, expires_at)
      values (
        ${crypto.randomUUID()}, ${user.id}, ${String(raw.id ?? '')}, ${raw.filename ?? file.name},
        ${raw.purpose ?? purpose}, ${raw.bytes ?? file.size},
        ${typeof raw.expires_at === 'number' ? new Date(raw.expires_at * 1000) : null}
      )
    `
    return c.json({
      id: raw.id,
      filename: raw.filename ?? file.name,
      bytes: raw.bytes ?? file.size,
      purpose: raw.purpose ?? purpose,
      expires_at: raw.expires_at ?? null,
      defaultExpireSeconds: DEFAULT_FILE_EXPIRE_SECONDS,
    })
  })

  app.get('/models', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    const result = await upstreamCall('/models', { method: 'GET' }, new Set())
    if (!result.response) {
      return c.json({ error: { message: 'no usable key' } }, 503)
    }
    return new Response(result.response.body, { status: result.response.status, headers: { 'content-type': 'application/json' } })
  })

  app.post('/api/admin/keys', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    const body = await readBody<{ label?: string; secret?: string; priority?: number; accountGroup?: string }>(c)
    const secret = (body.secret ?? '').trim()
    if (!secret) {
      return c.json({ error: { message: 'key required' } }, 400)
    }
    const sealed = sealSecret(secret, options.masterKey)
    const id = crypto.randomUUID()
    const last4 = secret.slice(-4)
    await sql`
      insert into api_keys (id, label, ciphertext, nonce, last4, priority, account_group)
      values (
        ${id}, ${body.label?.trim() || 'key'}, ${sealed.ciphertext}, ${sealed.nonce}, ${last4},
        ${body.priority ?? 100}, ${body.accountGroup?.trim() || id}
      )
    `
    const rows = await sql<KeyRow[]>`
      select id, label, ciphertext, nonce, last4, priority, status, account_group, last_balance_cny::text, is_available, last_error
      from api_keys where id = ${id}
    `
    if (rows[0]) {
      await checkOneBalance(rows[0])
    }
    const fresh = await sql<KeyRow[]>`
      select id, label, ciphertext, nonce, last4, priority, status, account_group, last_balance_cny::text, is_available, last_error
      from api_keys where id = ${id}
    `
    return c.json({ key: fresh[0] ? publicKey(fresh[0]) : null })
  })

  app.get('/api/admin/keys', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    const rows = await sql<KeyRow[]>`
      select id, label, ciphertext, nonce, last4, priority, status, account_group, last_balance_cny::text, is_available, last_error
      from api_keys order by priority asc, created_at asc
    `
    return c.json({ keys: rows.map(publicKey) })
  })

  app.delete('/api/admin/keys/:id', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    await sql`delete from api_keys where id = ${c.req.param('id')}`
    return c.json({ ok: true })
  })

  app.post('/api/admin/invites', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    const body = await readBody<{ maxUses?: number }>(c)
    const code = randomToken().slice(0, 10)
    const id = crypto.randomUUID()
    await sql`
      insert into invite_codes (id, code, created_by, max_uses)
      values (${id}, ${code}, ${user.id}, ${Math.max(1, body.maxUses ?? 1)})
    `
    return c.json({ id, code, maxUses: Math.max(1, body.maxUses ?? 1) })
  })

  app.get('/api/admin/users', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    const rows = await sql`
      select id, username, role, status, token_quota::text, search_quota, page_quota, created_at, last_login_at
      from users order by created_at asc
    `
    return c.json({
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        role: row.role,
        status: row.status,
        tokenQuota: Number(row.token_quota),
        searchQuota: row.search_quota,
        pageQuota: row.page_quota,
      })),
    })
  })

  app.patch('/api/admin/users/:id', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    const body = await readBody<{ tokenQuota?: number; searchQuota?: number; pageQuota?: number; status?: string }>(c)
    await sql`
      update users set
        token_quota = coalesce(${body.tokenQuota ?? null}, token_quota),
        search_quota = coalesce(${body.searchQuota ?? null}, search_quota),
        page_quota = coalesce(${body.pageQuota ?? null}, page_quota),
        status = coalesce(${body.status === 'disabled' || body.status === 'active' ? body.status : null}, status)
      where id = ${c.req.param('id')}
    `
    return c.json({ ok: true })
  })

  app.get('/api/admin/usage', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    const daily = await sql`
      select user_id, day, input_tokens::text, output_tokens::text, cache_read_input_tokens::text,
             tool_search, tool_fetch, tool_image_search, file_pages, estimated_cny::text
      from usage_daily order by day desc limit 100
    `
    return c.json({
      daily: daily.map((row) => ({
        userId: row.user_id,
        day: row.day,
        inputTokens: Number(row.input_tokens),
        outputTokens: Number(row.output_tokens),
        cacheReadTokens: Number(row.cache_read_input_tokens),
        toolSearch: row.tool_search,
        toolFetch: row.tool_fetch,
        toolImageSearch: row.tool_image_search,
        filePages: row.file_pages,
        estimatedCny: row.estimated_cny,
      })),
    })
  })

  app.get('/api/admin/alerts', async (c) => {
    const user = await requireUser(c, false)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    const rows = await sql`
      select id, api_key_id, kind, message, created_at, read_at from alerts order by created_at desc limit 50
    `
    return c.json({
      alerts: rows.map((row) => ({
        id: row.id,
        apiKeyId: row.api_key_id,
        kind: row.kind,
        message: row.message,
        createdAt: row.created_at,
        readAt: row.read_at,
      })),
    })
  })

  app.patch('/api/admin/settings', async (c) => {
    const user = await requireUser(c, true)
    if (user instanceof Response) {
      return user
    }
    if (user.role !== 'admin') {
      return c.json({ error: { message: 'forbidden' } }, 403)
    }
    const body = await readBody<{ lowBalanceCny?: number }>(c)
    if (typeof body.lowBalanceCny === 'number') {
      await sql`
        insert into app_settings (key, value) values ('low_balance_cny', ${sql.json(body.lowBalanceCny)})
        on conflict (key) do update set value = excluded.value
      `
    }
    return c.json({ lowBalanceCny: await threshold() })
  })

  const serveIndex = async (c: { html: (body: string) => Response | Promise<Response> }) => {
    if (!options.staticDir) {
      return c.html('<!doctype html><title>Harbor</title>')
    }
    const html = await readFile(`${options.staticDir}/index.html`, 'utf8')
    return c.html(html.replace('</head>', '<meta name="harbor-server" content="1"></head>'))
  }

  app.get('/', (c) => serveIndex(c))
  app.get('/index.html', (c) => serveIndex(c))
  if (options.staticDir) {
    const rootDir = options.staticDir
    const types: Record<string, string> = {
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
      '.html': 'text/html; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
    }
    app.get('/*', (c) => {
      const pathname = decodeURIComponent(new URL(c.req.url).pathname)
      if (pathname.includes('..')) {
        return c.notFound()
      }
      const filePath = join(rootDir, pathname)
      if (!filePath.startsWith(rootDir.endsWith(sep) ? rootDir : rootDir + sep) && filePath !== rootDir) {
        return c.notFound()
      }
      try {
        if (!statSync(filePath).isFile()) {
          return c.notFound()
        }
      } catch {
        return c.notFound()
      }
      const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream
      return new Response(stream, {
        headers: { 'content-type': types[extname(filePath)] ?? 'application/octet-stream' },
      })
    })
  }

  return {
    app,
    sql,
    checkBalances,
    async close() {
      clearInterval(timer)
      await sql.end({ timeout: 5 })
    },
  }
}
