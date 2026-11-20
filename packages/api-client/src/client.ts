import { readApiError, readStreamEvent, ServerSentEventDecoder } from '@deepapi/sse'
import type { Balance, CreateMessageBody, ModelInfo, StreamEvent, UploadedFile } from '@deepapi/types'
import { API_ORIGIN, FILES_BETA } from './request.js'

export class ApiClientError extends Error {
  constructor(
    readonly kind: 'http' | 'network' | 'interrupted' | 'protocol' | 'stream',
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export type ClientOptions = {
  origin?: string
  fetch?: FetchLike
}

const isAbort = (error: unknown): boolean =>
  (error instanceof DOMException && error.name === 'AbortError') ||
  (error instanceof Error && error.name === 'AbortError')

const request = async (
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<Response> => {
  let response: Response
  try {
    response = await fetchImpl(url, { ...init, credentials: 'omit' })
  } catch (error) {
    if (isAbort(error) || init.signal?.aborted) {
      throw error
    }
    throw new ApiClientError('network', error instanceof Error ? error.message : 'network')
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let message = text || response.statusText || 'request failed'
    try {
      const parsed = readApiError(JSON.parse(text) as unknown)
      if (parsed) {
        message = parsed.message
      }
    } catch {
      // Keep the raw body.
    }
    throw new ApiClientError('http', message, response.status)
  }
  return response
}

export const createClient = (options: ClientOptions = {}) => {
  const origin = options.origin ?? API_ORIGIN
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init))

  const authHeaders = (apiKey: string, extra?: Record<string, string>): HeadersInit => ({
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  })

  return {
    origin,

    async verifyKey(apiKey: string, signal?: AbortSignal): Promise<ModelInfo[]> {
      const response = await request(fetchImpl, `${origin}/models`, {
        method: 'GET',
        headers: authHeaders(apiKey),
        signal,
      })
      const body = (await response.json()) as { data?: ModelInfo[] }
      return Array.isArray(body.data) ? body.data : []
    },

    async getBalance(apiKey: string, signal?: AbortSignal): Promise<Balance> {
      const response = await request(fetchImpl, `${origin}/user/balance`, {
        method: 'GET',
        headers: authHeaders(apiKey),
        signal,
      })
      return (await response.json()) as Balance
    },

    async uploadFile(
      apiKey: string,
      file: Blob,
      filename: string,
      purpose: string,
      signal?: AbortSignal,
    ): Promise<UploadedFile> {
      const form = new FormData()
      form.append('purpose', purpose)
      form.append('file', file, filename)
      const response = await request(fetchImpl, `${origin}/files`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: form,
        signal,
      })
      const raw = (await response.json()) as Record<string, unknown>
      return {
        id: String(raw.id ?? ''),
        bytes: typeof raw.bytes === 'number' ? raw.bytes : file.size,
        created_at: typeof raw.created_at === 'number' ? raw.created_at : 0,
        filename: typeof raw.filename === 'string' ? raw.filename : filename,
        purpose: typeof raw.purpose === 'string' ? raw.purpose : purpose,
        expires_at: typeof raw.expires_at === 'number' ? raw.expires_at : null,
      }
    },

    async deleteFile(apiKey: string, fileId: string, signal?: AbortSignal): Promise<void> {
      await request(fetchImpl, `${origin}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: authHeaders(apiKey),
        signal,
      })
    },

    async *streamMessage(
      apiKey: string,
      body: CreateMessageBody,
      signal: AbortSignal,
    ): AsyncGenerator<StreamEvent> {
      const hasFile = body.messages.some(
        (message) =>
          Array.isArray(message.content) &&
          message.content.some((block) => block.type === 'image' || block.type === 'document'),
      )
      const response = await request(fetchImpl, `${origin}/anthropic/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(hasFile ? { 'anthropic-beta': FILES_BETA } : {}),
        },
        body: JSON.stringify(body),
        signal,
      })
      const contentType = response.headers.get('Content-Type') ?? ''
      if (!response.body || !contentType.includes('text/event-stream')) {
        throw new ApiClientError('protocol', 'expected a server-sent event stream', response.status)
      }
      const decoder = new ServerSentEventDecoder()
      const reader = response.body.getReader()
      const textDecoder = new TextDecoder()
      let stopped = false
      const pump = function* (chunk: string, flush: boolean): Generator<StreamEvent> {
        const frames = decoder.push(chunk)
        if (flush) {
          frames.push(...decoder.end())
        }
        for (const frame of frames) {
          let payload: unknown
          try {
            payload = JSON.parse(frame.data)
          } catch {
            continue
          }
          const apiError = readApiError(payload)
          if (apiError) {
            throw new ApiClientError('stream', apiError.message)
          }
          const event = readStreamEvent(payload)
          if (!event || event.type === 'ping') {
            continue
          }
          yield event
          if (event.type === 'message_stop') {
            stopped = true
          }
        }
      }
      try {
        while (!stopped) {
          const { done, value } = await reader.read()
          if (done) {
            yield* pump(textDecoder.decode(), true)
            break
          }
          yield* pump(textDecoder.decode(value, { stream: true }), false)
        }
      } catch (error) {
        if (isAbort(error) || signal.aborted) {
          throw error
        }
        if (error instanceof ApiClientError) {
          throw error
        }
        throw new ApiClientError('network', error instanceof Error ? error.message : 'stream')
      }
      if (!stopped) {
        throw new ApiClientError('interrupted', 'stream ended before message_stop')
      }
    },
  }
}

export type HarborClient = ReturnType<typeof createClient>
