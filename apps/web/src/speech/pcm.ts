export type PcmSamples = { kind: 'samples'; samples: Float32Array }
export type PcmEof = { kind: 'eof'; danglingByte: false; completeness: 'unproven' }
export type PcmDangling = { kind: 'dangling-byte' }
export type PcmAborted = { kind: 'aborted' }
export type PcmError = { kind: 'error'; error: unknown }
export type PcmRead = PcmSamples | PcmEof | PcmDangling | PcmAborted | PcmError

const isAbort = (error: unknown): boolean =>
  (error instanceof DOMException && error.name === 'AbortError') ||
  (error instanceof Error && error.name === 'AbortError')

/** Decode little-endian s16 frames. An odd trailing byte is carried, not played. */
export const takePcm = (pending: Uint8Array, chunk: Uint8Array): { samples: Float32Array; carried: Uint8Array } => {
  const merged = new Uint8Array(pending.length + chunk.length)
  merged.set(pending, 0)
  merged.set(chunk, pending.length)
  const even = merged.length - (merged.length % 2)
  const samples = new Float32Array(even / 2)
  const view = new DataView(merged.buffer, merged.byteOffset, even)
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000
  }
  const carried = even === merged.length ? new Uint8Array(0) : merged.slice(even)
  return { samples, carried }
}

/**
 * Progressive PCM. A clean EOF has no length marker, so completeness stays unproven.
 * A final odd byte and a read error are failures. Abort is not an error.
 */
export async function* consumePcm(stream: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<PcmRead> {
  const reader = stream.getReader()
  let rest = new Uint8Array(0)
  try {
    for (;;) {
      if (signal?.aborted) {
        yield { kind: 'aborted' }
        return
      }
      let next: ReadableStreamReadResult<Uint8Array>
      try {
        next = await reader.read()
      } catch (error) {
        if (signal?.aborted || isAbort(error)) {
          yield { kind: 'aborted' }
          return
        }
        yield { kind: 'error', error }
        return
      }
      if (next.done) {
        if (rest.length > 0) yield { kind: 'dangling-byte' }
        else yield { kind: 'eof', danglingByte: false, completeness: 'unproven' }
        return
      }
      if (next.value.byteLength === 0) continue
      const frame = takePcm(rest, next.value)
      rest = frame.carried
      if (frame.samples.length > 0) yield { kind: 'samples', samples: frame.samples }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // The lock is already gone when the read failed.
    }
  }
}
