import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for the hosted end-to-end server')
  process.exit(1)
}

const sse = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"req-1","model":"deepseek-flash"}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"3+5=8"}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"8"}}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null,"title":"简单加法"},"usage":{"input_tokens":41,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":33,"service_tier":"standard","output_tokens_details":{"thinking_tokens":31},"server_tool_use":{"web_search_requests":1,"web_fetch_requests":0,"tool_search":2,"tool_fetch":0,"tool_image_search":0}}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
  '',
].join('\n')

const mock = createServer((request, response) => {
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    const key = String(request.headers['x-api-key'] ?? request.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (request.url?.startsWith('/user/balance')) {
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
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end(sse)
      return
    }
    response.writeHead(404)
    response.end()
  })
})

await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve))
const address = mock.address()
const port = typeof address === 'object' && address ? address.port : 0
const child = spawn(process.execPath, [join(root, 'apps/server/dist/server.js')], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '8080',
    STATIC_DIR: join(root, 'apps/web/dist'),
    DATA_DIR: join(root, '.tmp-e2e'),
    E2E_RESET: '1',
    ALLOW_OPEN_SETUP: '1',
    DEEPSEEK_API_ORIGIN: `http://127.0.0.1:${port}`,
    KEY_ENCRYPTION_SECRET: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
  },
})

const stop = () => {
  child.kill('SIGTERM')
  mock.close()
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
child.on('exit', (code) => {
  mock.close()
  process.exit(code ?? 0)
})
