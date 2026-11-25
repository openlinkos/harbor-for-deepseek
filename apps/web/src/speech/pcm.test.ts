import { describe, expect, it } from 'vitest'
import { consumePcm, takePcm } from './pcm.js'

const bytes = (...values: number[]) => new Uint8Array(values)

const collect = async (stream: ReadableStream<Uint8Array>, signal?: AbortSignal) => {
  const frames = []
  for await (const frame of consumePcm(stream, signal)) frames.push(frame)
  return frames
}

const streamOf = (chunks: Uint8Array[], fail?: Error) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      if (fail) controller.error(fail)
      else controller.close()
    },
  })

describe('pcm frames', () => {
  it('carries an odd byte into the next chunk', () => {
    const first = takePcm(new Uint8Array(0), bytes(0x00, 0x10, 0xff))
    expect(Array.from(first.samples)).toEqual([0x1000 / 0x8000])
    expect(Array.from(first.carried)).toEqual([0xff])
    const second = takePcm(first.carried, bytes(0x7f, 0x00, 0x00))
    expect(second.samples.length).toBe(2)
    expect(second.samples[0]).toBeCloseTo(0x7fff / 0x8000, 5)
    expect(second.samples[1]).toBe(0)
    expect(second.carried.length).toBe(0)
  })

  it('reports a final odd byte and does not treat it as success', async () => {
    const frames = await collect(streamOf([bytes(0x00, 0x00, 0x01)]))
    expect(frames.map((frame) => frame.kind)).toEqual(['samples', 'dangling-byte'])
  })

  it('ends a clean stream as unproven completeness', async () => {
    const frames = await collect(streamOf([bytes(0x00, 0x00), bytes(0x00, 0x00)]))
    expect(frames.at(-1)).toEqual({ kind: 'eof', danglingByte: false, completeness: 'unproven' })
  })

  it('surfaces a read error and an abort without calling the error an abort', async () => {
    const failed = await collect(streamOf([bytes(0x00)], new Error('broken')))
    expect(failed.at(-1)?.kind).toBe('error')
    const signal = AbortSignal.abort()
    const aborted = await collect(streamOf([bytes(0x00, 0x00)]), signal)
    expect(aborted).toEqual([{ kind: 'aborted' }])
  })
})
