const base = process.env.HARBOR_URL ?? 'http://127.0.0.1:8080'
const bootstrap = process.env.BOOTSTRAP_TOKEN ?? ''
const upstreamKey = 'sk-mockpoolsecretvalue'
const adminPassword = 'correct-horse-e2e'
const memberPassword = 'member-password-e2e'

if (bootstrap.length < 16) {
  console.error('BOOTSTRAP_TOKEN is required')
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const redact = (text) => text.split(upstreamKey).join('[redacted]').split(bootstrap).join('[redacted]')

const waitReady = async () => {
  const started = Date.now()
  while (Date.now() - started < 120_000) {
    try {
      const response = await fetch(`${base}/readyz`)
      if (response.ok) {
        return
      }
    } catch {
      // The process is still starting.
    }
    await sleep(1000)
  }
  throw new Error('readyz did not succeed')
}

const call = async (path, { method = 'GET', cookie, csrf, body } = {}) => {
  const headers = {}
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
  }
  if (cookie) {
    headers.cookie = `harbor_session=${cookie}`
  }
  if (csrf) {
    headers['x-harbor-csrf'] = csrf
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = null
  }
  return { status: response.status, text, body: parsed, response }
}

const must = (result, status) => {
  if (result.status !== status) {
    throw new Error(`expected ${status}, got ${result.status}: ${redact(result.text)}`)
  }
  if (result.text.includes(upstreamKey) || result.text.includes(bootstrap)) {
    throw new Error(`response leaked a secret on status ${status}`)
  }
  return result
}

const sessionOf = (response) => {
  const lines = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  const line = lines.find((item) => item.startsWith('harbor_session=')) ?? response.headers.get('set-cookie') ?? ''
  const value = /harbor_session=([^;]+)/.exec(line)?.[1] ?? ''
  if (!value) {
    throw new Error('missing session cookie')
  }
  if (!/HttpOnly/i.test(line) || !/SameSite=Lax/i.test(line)) {
    throw new Error('session cookie is missing HttpOnly or SameSite=Lax')
  }
  return value
}

const main = async () => {
  await waitReady()
  must(await call('/healthz'), 200)
  const version = await call('/version.json')
  must(version, 200)
  const cache = version.response.headers.get('cache-control') ?? ''
  if (!/no-store/i.test(cache)) {
    throw new Error(`version.json cache-control is ${cache || 'missing'}`)
  }
  const doc = version.body
  if (!doc || !/^\d+\.\d+\.\d+$/.test(doc.version)) {
    throw new Error(`version.json version is ${JSON.stringify(doc?.version)}`)
  }
  if (typeof doc.commit !== 'string' || !/^(?:[0-9a-f]{40}|unknown)$/.test(doc.commit)) {
    throw new Error(`version.json commit is ${JSON.stringify(doc?.commit)}`)
  }
  if (typeof doc.builtAt !== 'string' || Number.isNaN(Date.parse(doc.builtAt))) {
    throw new Error(`version.json builtAt is ${JSON.stringify(doc?.builtAt)}`)
  }
  if (process.env.DEEPAPI_VERSION && doc.version !== process.env.DEEPAPI_VERSION) {
    throw new Error(`version.json version ${doc.version} != ${process.env.DEEPAPI_VERSION}`)
  }
  if (process.env.SOURCE_COMMIT && doc.commit !== process.env.SOURCE_COMMIT.toLowerCase()) {
    throw new Error(`version.json commit ${doc.commit} != ${process.env.SOURCE_COMMIT}`)
  }
  must(await call('/readyz'), 200)

  const setup = must(
    await call('/api/setup/admin', {
      method: 'POST',
      body: { username: 'ada', password: adminPassword, token: bootstrap },
    }),
    200,
  )
  const adminCookie = sessionOf(setup.response)
  const admin = setup.body
  const adminHeaders = { cookie: adminCookie, csrf: admin.csrf }

  const reused = await call('/api/setup/admin', {
    method: 'POST',
    body: { username: 'bea', password: adminPassword, token: bootstrap },
  })
  if (reused.status !== 403) {
    throw new Error(`bootstrap token was accepted twice (${reused.status})`)
  }

  const added = must(
    await call('/api/admin/keys', {
      method: 'POST',
      ...adminHeaders,
      body: { label: 'mock', secret: upstreamKey, accountGroup: 'mock' },
    }),
    200,
  )
  if (!JSON.stringify(added.body).includes('42.50')) {
    throw new Error(`balance was not the mock value: ${redact(added.text)}`)
  }

  const invite = must(
    await call('/api/admin/invites', {
      method: 'POST',
      ...adminHeaders,
      body: { maxUses: 1 },
    }),
    200,
  )
  if (!invite.body?.code || !invite.body.expiresAt || Date.parse(invite.body.expiresAt) <= Date.now()) {
    throw new Error('invite did not expire in the future')
  }

  const registered = must(
    await call('/api/auth/register', {
      method: 'POST',
      body: { code: invite.body.code, username: 'mina', password: memberPassword },
    }),
    200,
  )
  const firstCookie = sessionOf(registered.response)
  const first = { cookie: firstCookie, csrf: registered.body.csrf }

  must(
    await call('/api/conversations', {
      method: 'POST',
      ...first,
      body: { id: 'e2e-chat', model: 'deepseek-flash' },
    }),
    200,
  )
  const run = must(
    await call('/api/conversations/e2e-chat/runs', {
      method: 'POST',
      ...first,
      body: { text: 'sync-check-phrase', thinking: false, search: false },
    }),
    200,
  )
  const events = must(await call(`/api/runs/${run.body.runId}/events`, first), 200)
  if (!events.text.includes('"status":"complete"') || !events.text.includes('简单加法')) {
    throw new Error(`chat did not finish: ${redact(events.text.slice(0, 400))}`)
  }

  const secondLogin = must(
    await call('/api/auth/login', {
      method: 'POST',
      body: { username: 'mina', password: memberPassword },
    }),
    200,
  )
  const secondCookie = sessionOf(secondLogin.response)
  if (secondCookie === firstCookie) {
    throw new Error('second session reused the first cookie')
  }
  const sync = must(await call('/api/sync?cursor=0', { cookie: secondCookie }), 200)
  const synced = JSON.stringify(sync.body)
  if (!synced.includes('sync-check-phrase') || !synced.includes('简单加法')) {
    throw new Error('second session did not see the chat')
  }
  const devices = must(await call('/api/auth/devices', { cookie: secondCookie }), 200)
  if (!Array.isArray(devices.body.devices) || devices.body.devices.length < 2) {
    throw new Error('expected two sessions')
  }
  console.log('server e2e ok')
}

await main()
