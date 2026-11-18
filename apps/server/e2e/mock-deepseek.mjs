import { createServer } from 'node:http'

const expected = 'sk-mockpoolsecretvalue'

const sse = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"req-1","model":"deepseek-flash","usage":{"input_tokens":49,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"service_tier":"standard"}}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"8"}}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null,"title":"简单加法"},"usage":{"input_tokens":41,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":33,"service_tier":"standard","server_tool_use":{"web_search_requests":0,"web_fetch_requests":0,"tool_search":0,"tool_fetch":0,"tool_image_search":0},"output_tokens_details":{"thinking_tokens":0}}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
  '',
].join('\n')

const balance = JSON.stringify({
  is_available: true,
  balance_infos: [
    {
      currency: 'CNY',
      total_balance: '42.50',
      granted_balance: '0.00',
      topped_up_balance: '42.50',
    },
  ],
})

const server = createServer((request, response) => {
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    const path = request.url ?? '/'
    if (path === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{"ok":true}')
      return
    }
    const header = String(request.headers['x-api-key'] ?? request.headers.authorization ?? '')
    const key = header.replace(/^Bearer\s+/i, '')
    const status = key === expected ? 200 : 401
    console.log(JSON.stringify({ message: 'mock', method: request.method, path: path.split('?')[0], status }))
    if (status !== 200) {
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end('{"error":{"message":"unauthorized"}}')
      return
    }
    if (path.startsWith('/user/balance')) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(balance)
      return
    }
    if (path.includes('/messages')) {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end(sse)
      return
    }
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end('{"error":{"message":"not found"}}')
  })
})

server.listen(8081, '0.0.0.0')
