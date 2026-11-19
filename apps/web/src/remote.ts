import { readStreamEvent, ServerSentEventDecoder } from '@deepapi/sse'
import type { StreamEvent } from '@deepapi/types'

let csrf = ''
let remoteBase = ''
let bearer = ''

export const setCsrf = (value: string) => {
  csrf = value
}

export const setRemoteSession = (base: string, token: string) => {
  remoteBase = base.replace(/\/$/, '')
  bearer = token
  csrf = ''
}

export const clearRemoteSession = () => {
  remoteBase = ''
  bearer = ''
}

const endpoint = (path: string) => (remoteBase && path.startsWith('/') ? `${remoteBase}${path}` : path)

const headers = (jsonBody: boolean) => {
  const result = new Headers()
  if (jsonBody) {
    result.set('content-type', 'application/json')
  }
  if (bearer) {
    result.set('authorization', `Bearer ${bearer}`)
  } else if (csrf) {
    result.set('x-harbor-csrf', csrf)
  }
  return result
}

export const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(endpoint(path), {
    ...init,
    credentials: bearer ? 'omit' : 'include',
    headers: headers(typeof init.body === 'string'),
  })
  const text = await response.text()
  const data = text ? (JSON.parse(text) as T & { error?: { message?: string } }) : ({} as T)
  if (!response.ok) {
    throw new Error((data as { error?: { message?: string } }).error?.message || `HTTP ${response.status}`)
  }
  return data
}

export const hostedPage = () =>
  typeof document !== 'undefined' && document.querySelector('meta[name="deepapi-server"]') !== null

export type ServerUser = { id: string; username: string; role: 'admin' | 'member' }

export const readRun = async (
  runId: string,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
): Promise<string> => {
  let after = 0
  while (!signal.aborted) {
    const response = await fetch(endpoint(`/api/runs/${runId}/events?after=${after}`), {
      credentials: bearer ? 'omit' : 'include',
      headers: headers(false),
      signal,
    })
    if (!response.ok || !response.body) {
      throw new Error('events failed')
    }
    const decoder = new ServerSentEventDecoder()
    const textDecoder = new TextDecoder()
    const reader = response.body.getReader()
    let ended = ''
    while (!ended) {
      const { done, value } = await reader.read()
      const frames = decoder.push(textDecoder.decode(value ?? new Uint8Array(), { stream: !done }))
      if (done) {
        frames.push(...decoder.end())
      }
      for (const frame of frames) {
        if (frame.lastEventId) {
          after = Number(frame.lastEventId)
        }
        if (frame.event === 'end') {
          ended = JSON.parse(frame.data).status ?? 'complete'
          break
        }
        try {
          const event = readStreamEvent(JSON.parse(frame.data) as unknown)
          if (event) {
            onEvent(event)
          }
        } catch {
          // Ignore a malformed frame and keep the connection.
        }
      }
      if (done) {
        break
      }
    }
    if (ended) {
      return ended
    }
  }
  return 'aborted'
}
