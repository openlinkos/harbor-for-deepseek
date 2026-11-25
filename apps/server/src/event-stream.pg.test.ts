import { createServer as createHttp, type Server } from 'node:http'
import net from 'node:net'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer as createHarbor, type HarborServer } from './app.js'
import { pumpRunEvents } from './event-stream.js'
import { applyMigrations } from './schema.js'

const configuredUrl = process.env.DATABASE_URL
const databaseUrl = configuredUrl ?? 'postgres://harbor:harbor@127.0.0.1:5432/harbor'
const directUrl = 'postgres://box@127.0.0.1:55439/synthetic_fix239'

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

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const deadline = async (work: Promise<void>, ms: number): Promise<'settled' | 'pending'> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const result = await Promise.race([
    work.then(() => 'settled' as const),
    new Promise<'pending'>((resolve) => {
      timer = setTimeout(() => resolve('pending'), ms)
    }),
  ])
  if (timer !== undefined) {
    clearTimeout(timer)
  }
  return result
}

const waitFor = async (label: string, pred: () => Promise<boolean>, ms = 4000) => {
  const started = Date.now()
  while (Date.now() - started < ms) {
    if (await pred()) {
      return
    }
    await sleep(15)
  }
  throw new Error(`setup timeout: ${label}`)
}

type HoldProxy = {
  port: number
  arm: (runId: string) => { held: Promise<void>; release: () => void }
  close: () => Promise<void>
  trace: string[]
}

const streamingStatusRow = (frame: Buffer): boolean =>
  frame[0] === 0x44 && frame.length === 20 && frame.readInt16BE(5) === 1 && frame.subarray(11).toString() === 'streaming'

const startHoldProxy = async (targetPort: number): Promise<HoldProxy> => {
  const trace: string[] = []
  let armed: { runId: string; held: () => void; release: Promise<void> } | null = null
  const server = net.createServer((client) => {
    client.setNoDelay(true)
    const upstream = net.connect(targetPort, '127.0.0.1')
    upstream.setNoDelay(true)
    let bindId = ''
    let buf = Buffer.alloc(0)
    let out = Buffer.alloc(0)
    let startup = true
    let chain = Promise.resolve()
    const fail = (error: Error) => {
      trace.push(`socket ${error.message}`)
      client.destroy()
      upstream.destroy()
    }
    client.on('error', fail)
    upstream.on('error', fail)
    client.on('data', (chunk) => {
      upstream.write(chunk)
      buf = Buffer.concat([buf, chunk])
      if (startup) {
        if (buf.length < 4) {
          return
        }
        const length = buf.readInt32BE(0)
        if (buf.length < length) {
          return
        }
        buf = buf.subarray(length)
        startup = false
      }
      while (buf.length >= 5) {
        const length = buf.readInt32BE(1)
        if (length < 4 || buf.length < length + 1) {
          break
        }
        const frame = buf.subarray(0, length + 1)
        buf = buf.subarray(length + 1)
        if (frame[0] === 0x42) {
          const text = frame.toString('utf8')
          const match = /[0-9a-f]{8}-[0-9a-f-]{27}/.exec(text)
          if (match) {
            bindId = match[0]
          }
        }
      }
    })
    upstream.on('data', (chunk) => {
      out = Buffer.concat([out, chunk])
      while (out.length >= 5) {
        const length = out.readInt32BE(1)
        if (length < 4 || out.length < length + 1) {
          break
        }
        const frame = out.subarray(0, length + 1)
        out = out.subarray(length + 1)
        const holdThis = streamingStatusRow(frame) && armed !== null && armed.runId === bindId
        if (frame[0] === 0x44 && trace.length < 40) {
          trace.push(`D bind=${bindId} len=${frame.length} hold=${holdThis}`)
        }
        const pending = armed
        if (holdThis && pending) {
          armed = null
        }
        chain = chain.then(async () => {
          if (holdThis && pending) {
            pending.held()
            await pending.release
          }
          if (!client.destroyed) {
            client.write(frame)
          }
        })
      }
    })
    client.on('close', () => upstream.destroy())
    upstream.on('close', () => {
      void chain.finally(() => client.end())
    })
  })
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        resolve(address.port)
      } else {
        reject(new Error('proxy has no port'))
      }
    })
  })
  return {
    port,
    trace,
    arm: (runId) => {
      let held!: () => void
      const heldPromise = new Promise<void>((resolve) => {
        held = resolve
      })
      let release!: () => void
      const releasePromise = new Promise<void>((resolve) => {
        release = resolve
      })
      armed = { runId, held, release: releasePromise }
      return { held: heldPromise, release }
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
      }),
  }
}

describe.skipIf(!postgresReady)('run event pump against postgres', () => {
  const sql = postgres(databaseUrl, { max: 4, onnotice: () => undefined })

  beforeAll(async () => {
    await applyMigrations(sql)
  })

  afterAll(async () => {
    await sql.end({ timeout: 1 }).catch(() => undefined)
  })

  const insertStreamingRun = async () => {
    const userId = crypto.randomUUID()
    const runId = crypto.randomUUID()
    const messageId = crypto.randomUUID()
    const conversationId = crypto.randomUUID()
    const username = `u${userId.replaceAll('-', '').slice(0, 20)}`
    await sql`
      insert into users (id, username, password_hash, role)
      values (${userId}, ${username}, 'x', 'member')
    `
    await sql`insert into user_counters (user_id, next_rev) values (${userId}, 0)`
    await sql`
      insert into conversations (id, user_id, rev)
      values (${conversationId}, ${userId}, 1)
    `
    await sql`
      insert into messages (id, user_id, conversation_id, role, status, rev)
      values (${messageId}, ${userId}, ${conversationId}, 'assistant', 'streaming', 1)
    `
    await sql`
      insert into chat_runs (id, user_id, conversation_id, message_id, status)
      values (${runId}, ${userId}, ${conversationId}, ${messageId}, 'streaming')
    `
    return { userId, runId }
  }

  const removeUser = async (userId: string) => {
    await sql`delete from users where id = ${userId}`
  }

  const readEvents = async (runId: string, cursor: number) => {
    const rows = await sql<{ seq: number; payload: unknown }[]>`
      select seq, payload from run_events where run_id = ${runId} and seq > ${cursor} order by seq
    `
    return rows.map((row) => ({ seq: Number(row.seq), payload: row.payload }))
  }

  const readStatus = async (runId: string) => {
    const rows = await sql<{ status: string }[]>`select status from chat_runs where id = ${runId}`
    return rows[0]?.status
  }

  it('returns the terminal frame when a real streaming snapshot is delivered after finish', async () => {
    const { userId, runId } = await insertStreamingRun()
    const entered = deferred()
    const gate = deferred()
    const listeners = new Set<() => void>()
    const output: string[] = []
    let first = true
    const controller = new AbortController()
    const done = pumpRunEvents({
      initialCursor: 0,
      pingMs: 15_000,
      signal: controller.signal,
      send: (chunk) => output.push(chunk),
      isClosed: () => false,
      close: () => undefined,
      onCancel: () => undefined,
      subscribe: (wake) => {
        listeners.add(wake)
        return () => listeners.delete(wake)
      },
      readEvents: async () => [],
      readStatus: async () => {
        const snapshot = await readStatus(runId)
        if (first) {
          first = false
          entered.resolve()
          await gate.promise
          return snapshot
        }
        return readStatus(runId)
      },
      readThinkingSeconds: async () => null,
    })
    try {
      await entered.promise
      await sql`
        update chat_runs set status = 'error', finished_at = now(), error = 'upstream 400' where id = ${runId}
      `
      const subscribersAtNotify = listeners.size
      for (const wake of [...listeners]) {
        wake()
      }
      gate.resolve()
      const outcome = await deadline(done, 800)
      const text = output.join('')
      expect(outcome).toBe('settled')
      expect(subscribersAtNotify).toBe(1)
      expect(text).toContain('event: end\ndata: {"status":"error"}\n\n')
      expect(text).not.toContain(': ping')
      expect(listeners.size).toBe(0)
    } finally {
      gate.resolve()
      controller.abort()
      await Promise.race([done.catch(() => undefined), sleep(50)])
      await removeUser(userId)
    }
  })

  it('sends a tail row committed after the events snapshot once the status read shows the terminal commit', async () => {
    const { userId, runId } = await insertStreamingRun()
    const entered = deferred()
    const gate = deferred()
    const listeners = new Set<() => void>()
    const output: string[] = []
    let first = true
    const done = pumpRunEvents({
      initialCursor: 0,
      pingMs: 15_000,
      signal: new AbortController().signal,
      send: (chunk) => output.push(chunk),
      isClosed: () => false,
      close: () => undefined,
      onCancel: () => undefined,
      subscribe: (wake) => {
        listeners.add(wake)
        return () => listeners.delete(wake)
      },
      readEvents: async (cursor) => {
        const snapshot = await readEvents(runId, cursor)
        if (first) {
          first = false
          entered.resolve()
          await gate.promise
          return snapshot
        }
        return readEvents(runId, cursor)
      },
      readStatus: async () => readStatus(runId),
      readThinkingSeconds: async () => null,
    })
    try {
      await entered.promise
      await sql`
        insert into run_events (run_id, seq, payload)
        values (${runId}, 1, ${sql.json({ text: 'tail-final' })})
      `
      await sql`
        update chat_runs set status = 'error', finished_at = now(), error = 'upstream 400' where id = ${runId}
      `
      for (const wake of [...listeners]) {
        wake()
      }
      gate.resolve()
      await done
      const text = output.join('')
      expect(text).toContain('"text":"tail-final"')
      expect(text.indexOf('"text":"tail-final"')).toBeLessThan(text.indexOf('event: end'))
      expect(text).toContain('event: end\ndata: {"status":"error"}\n\n')
      expect(text.match(/event: end/g)).toHaveLength(1)
      expect(listeners.size).toBe(0)
    } finally {
      gate.resolve()
      await Promise.race([done.catch(() => undefined), sleep(50)])
      await removeUser(userId)
    }
  })
})

describe.skipIf(!postgresReady)('GET /api/runs/:id/events through a held status row', () => {
  let proxy: HoldProxy | undefined
  let mock: Server | undefined
  let harbor: HarborServer | undefined
  let releaseUpstream: (() => void) | undefined
  let upstreamReleased = false
  const direct = postgres(directUrl, { max: 1, onnotice: () => undefined })

  const sessionOf = (response: Response) => {
    const raw = response.headers.get('set-cookie') ?? ''
    return /harbor_session=([^;]+)/.exec(raw)?.[1] ?? ''
  }
  let session = ''
  let csrf = ''

  beforeAll(async () => {
    proxy = await startHoldProxy(55439)
    mock = createHttp((request, response) => {
      request.resume()
      if (!request.url?.includes('/messages')) {
        response.writeHead(404)
        response.end()
        return
      }
      let sent = false
      const send = () => {
        if (sent) {
          return
        }
        sent = true
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: { message: 'rejected' } }))
      }
      if (upstreamReleased) {
        send()
        return
      }
      releaseUpstream = send
    })
    await new Promise<void>((resolve) => mock?.listen(0, '127.0.0.1', () => resolve()))
    const address = mock.address()
    const port = address && typeof address === 'object' ? address.port : 0
    harbor = await createHarbor({
      databaseUrl: `postgres://box@127.0.0.1:${proxy.port}/synthetic_fix239`,
      masterKey: Buffer.alloc(32, 9),
      upstream: `http://127.0.0.1:${port}`,
      eventPingMs: 15_000,
      allowOpenSetup: true,
    })
    await direct`
      truncate table
        run_events, chat_runs, usage_events, usage_daily, alerts, balance_snapshots,
        messages, tombstones, conversations, files, auth_sessions, invite_codes,
        api_keys, user_counters, users
      restart identity cascade
    `
    const setup = await harbor.app.request('/api/setup/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'correct-horse' }),
    })
    if (setup.status !== 200) {
      throw new Error(`setup failed: ${setup.status} ${await setup.text()}`)
    }
    const created = (await setup.json()) as { csrf: string }
    session = sessionOf(setup)
    csrf = created.csrf
    const headers = {
      'content-type': 'application/json',
      cookie: `harbor_session=${session}`,
      'x-harbor-csrf': csrf,
    }
    const key = await harbor.app.request('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret: 'hold-400-key', accountGroup: 'held' }),
    })
    if (key.status !== 200) {
      throw new Error(`key failed: ${key.status} ${await key.text()}`)
    }
  })

  afterAll(async () => {
    releaseUpstream?.()
    await harbor?.close().catch(() => undefined)
    if (mock?.listening) {
      await new Promise<void>((resolve) => mock?.close(() => resolve()))
    }
    await proxy?.close()
    await direct.end({ timeout: 1 }).catch(() => undefined)
  })

  const writeHeaders = () => ({
    'content-type': 'application/json',
    cookie: `harbor_session=${session}`,
    'x-harbor-csrf': csrf,
  })

  it('keeps authentication on the events route', async () => {
    if (!harbor) {
      throw new Error('server missing')
    }
    const anon = await harbor.app.request('/api/runs/00000000-0000-4000-8000-000000000099/events')
    expect(anon.status).toBe(401)
    const missing = await harbor.app.request('/api/runs/00000000-0000-4000-8000-000000000099/events', {
      headers: { cookie: `harbor_session=${session}` },
    })
    expect(missing.status).toBe(404)
  })

  it('delivers upstream 400 when the streaming status row is held across finishRun', async () => {
    if (!harbor || !proxy) {
      throw new Error('server missing')
    }
    upstreamReleased = false
    const conversation = await harbor.app.request('/api/conversations', {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ id: 'held-chat' }),
    })
    expect(conversation.status).toBe(200)
    const run = await harbor.app.request('/api/conversations/held-chat/runs', {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ text: '仍要400', thinking: false, search: false }),
    })
    expect(run.status).toBe(200)
    const started = (await run.json()) as { runId: string }
    const hold = proxy.arm(started.runId)
    const controller = new AbortController()
    const response = await harbor.app.request(`/api/runs/${started.runId}/events`, {
      headers: { cookie: `harbor_session=${session}` },
      signal: controller.signal,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('missing body')
    }
    let text = ''
    const collect = (async () => {
      const decoder = new TextDecoder()
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) {
          return
        }
        text += decoder.decode(chunk.value, { stream: true })
        if (text.includes('event: end')) {
          return
        }
      }
    })().catch(() => undefined)
    try {
      await Promise.race([
        hold.held,
        sleep(3000).then(() => {
          throw new Error(`proxy did not hold the streaming status row: ${proxy?.trace.join(' | ')}`)
        }),
      ])
      upstreamReleased = true
      releaseUpstream?.()
      await waitFor('terminal status', async () => {
        const rows = await direct<{ status: string }[]>`select status from chat_runs where id = ${started.runId}`
        return rows[0]?.status === 'error'
      })
      hold.release()
      const outcome = await Promise.race([
        collect.then(() => 'end' as const),
        sleep(800).then(() => 'timeout' as const),
      ])
      expect(outcome).toBe('end')
      expect(text).toContain('{"status":"error"')
      expect(text).not.toContain(': ping')
    } finally {
      upstreamReleased = true
      releaseUpstream?.()
      hold.release()
      controller.abort()
      await reader.cancel().catch(() => undefined)
      await Promise.race([collect, sleep(50)])
    }
  })
})
