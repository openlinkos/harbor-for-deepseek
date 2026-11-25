import { spawnSync } from 'node:child_process'
import { createServer, type ServerResponse } from 'node:https'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

let certs: { key: Buffer; cert: Buffer } | null = null

const certificate = () => {
  if (certs) return certs
  const dir = mkdtempSync(join(tmpdir(), 'speech-pcm-'))
  const keyPath = join(dir, 'key.pem')
  const certPath = join(dir, 'cert.pem')
  const result = spawnSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', keyPath, '-out', certPath,
    '-days', '1', '-nodes', '-subj', '/CN=127.0.0.1',
  ], { stdio: 'ignore' })
  if (result.status !== 0) throw new Error('openssl could not make the loopback certificate')
  certs = { key: readFileSync(keyPath), cert: readFileSync(certPath) }
  return certs
}

/** Signed 16-bit little-endian 24 kHz mono. Non-zero so a scheduled buffer is audibly real. */
export const tonePcm = (frames: number) => {
  const bytes = Buffer.alloc(frames * 2)
  for (let index = 0; index < frames; index += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * index) / 24000) * 12000)
    bytes.writeInt16LE(sample, index * 2)
  }
  return bytes
}

export type PcmServer = {
  port: number
  bodies: string[]
  aborted: boolean[]
  finished: boolean[]
  close: () => Promise<void>
}

/**
 * Loopback HTTPS sink for POST /v1/tools/tts.
 * `eof` writes one tone and ends. `open` writes a long tone and leaves the body open
 * so the app can reach playing while the request is still in flight.
 */
export const openPcmServer = async (mode: 'eof' | 'open', frames: number): Promise<PcmServer> => {
  const pcm = tonePcm(frames)
  const bodies: string[] = []
  const aborted: boolean[] = []
  const finished: boolean[] = []
  const ended: boolean[] = []
  const finish = (res: ServerResponse, index: number) => {
    if (ended[index]) return
    ended[index] = true
    res.end()
  }
  const { key, cert } = certificate()
  const server = createServer({ key, cert }, (req, res) => {
    res.on('error', () => undefined)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': '*',
        'access-control-allow-private-network': 'true',
      })
      res.end()
      return
    }
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('error', () => undefined)
    req.on('end', () => {
      const index = bodies.length
      bodies.push(Buffer.concat(chunks).toString('utf8'))
      aborted.push(false)
      finished.push(false)
      ended.push(false)
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
        'access-control-allow-private-network': 'true',
      })
      res.write(pcm)
      res.on('close', () => {
        finished[index] = true
        if (!ended[index]) aborted[index] = true
      })
      if (mode === 'eof') finish(res, index)
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('pcm server has no port')
  return {
    port: address.port,
    bodies,
    aborted,
    finished,
    close: () => new Promise((resolve) => {
      server.closeAllConnections()
      server.close(() => resolve())
    }),
  }
}

/** Observe the real AudioContext the production player constructs. Playback itself is not stubbed. */
export const installPcmProbe = (page: Page) => page.addInitScript(() => {
  const Original = window.AudioContext
  const probe = {
    starts: 0,
    stops: 0,
    disconnects: 0,
    closes: 0,
    destinationConnects: 0,
    peak: 0,
    bufferRates: [] as number[],
    bufferFrames: [] as number[],
    contextRates: [] as number[],
  }
  const live: AudioContext[] = []
  const mark = window as unknown as { __pcm: typeof probe; __pcmLive: AudioContext[] }
  mark.__pcm = probe
  mark.__pcmLive = live
  function Wrapped(this: AudioContext, options?: AudioContextOptions) {
    const context = new Original(options)
    live.push(context)
    probe.contextRates.push(context.sampleRate)
    const createBuffer = context.createBuffer.bind(context)
    context.createBuffer = (channels: number, length: number, rate: number) => {
      const buffer = createBuffer(channels, length, rate)
      probe.bufferRates.push(buffer.sampleRate)
      probe.bufferFrames.push(buffer.length)
      const copy = buffer.copyToChannel.bind(buffer)
      buffer.copyToChannel = (source: Float32Array, channel: number, offset?: number) => {
        for (let index = 0; index < source.length; index += 1) {
          const value = Math.abs(source[index] ?? 0)
          if (value > probe.peak) probe.peak = value
        }
        return copy(source, channel, offset)
      }
      return buffer
    }
    const createSource = context.createBufferSource.bind(context)
    context.createBufferSource = () => {
      const source = createSource()
      const start = source.start.bind(source)
      const stop = source.stop.bind(source)
      const disconnect = source.disconnect.bind(source)
      const connect = source.connect.bind(source)
      source.start = ((...args: Parameters<AudioBufferSourceNode['start']>) => {
        probe.starts += 1
        return start(...args)
      }) as typeof source.start
      source.stop = ((...args: Parameters<AudioBufferSourceNode['stop']>) => {
        probe.stops += 1
        return stop(...args)
      }) as typeof source.stop
      source.disconnect = ((...args: unknown[]) => {
        probe.disconnects += 1
        return (disconnect as (...inner: unknown[]) => AudioNode)(...args)
      }) as typeof source.disconnect
      source.connect = ((dest: AudioNode, output?: number, input?: number) => {
        if (dest === context.destination) probe.destinationConnects += 1
        return connect(dest, output, input)
      }) as typeof source.connect
      return source
    }
    const close = context.close.bind(context)
    context.close = () => {
      probe.closes += 1
      try { sessionStorage.setItem('deepapi-pcm-closed', String(probe.closes)) } catch { /* leaving the page */ }
      return close()
    }
    return context
  }
  Wrapped.prototype = Original.prototype
  window.AudioContext = Wrapped as typeof AudioContext
})
