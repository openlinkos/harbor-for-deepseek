import { TTS_SAMPLE_RATE } from '@deepapi/types'

const START_DELAY = 0.1

export type ScheduledClip = {
  stop(): void
  disconnect(): void
  onended: (() => void) | null
}

export type PcmAudioHost = {
  readonly currentTime: number
  resume(): void
  close(): void
  play(samples: Float32Array, when: number): ScheduledClip
}

/**
 * Schedules 24 kHz PCM. The host is created by the caller inside the user gesture.
 * Each clip's end handler is armed when the clip is scheduled. A listener installed
 * only after the stream EOF can miss an end that already ran, and the session would
 * stay in `playing`.
 */
export const createPcmPlayer = (host: PcmAudioHost) => {
  let nextTime = 0
  let started = false
  let closed = false
  let streamEnded = false
  let lastEnded = false
  const clips: ScheduledClip[] = []
  let resolveDrain: (() => void) | null = null

  const ready = () => streamEnded && (clips.length === 0 || lastEnded)

  const settle = () => {
    if (closed || !ready() || !resolveDrain) return
    const resolve = resolveDrain
    resolveDrain = null
    resolve()
  }

  return {
    schedule(samples: Float32Array) {
      if (closed || samples.length === 0) return
      const when = Math.max(nextTime, host.currentTime + (started ? 0 : START_DELAY))
      const clip = host.play(samples, when)
      nextTime = when + samples.length / TTS_SAMPLE_RATE
      started = true
      lastEnded = false
      clips.push(clip)
      clip.onended = () => {
        if (closed || clip !== clips[clips.length - 1]) return
        lastEnded = true
        settle()
      }
    },
    /** The PCM stream has ended. Playback is finished only once the last clip ends. */
    endStream() {
      if (closed) return
      streamEnded = true
      settle()
    },
    stop() {
      if (closed) return
      closed = true
      for (const clip of clips) {
        try { clip.stop() } catch { /* already stopped */ }
        try { clip.disconnect() } catch { /* already disconnected */ }
      }
      clips.length = 0
      const resolve = resolveDrain
      resolveDrain = null
      resolve?.()
      host.close()
    },
    whenDrained() {
      if (closed || ready()) return Promise.resolve()
      return new Promise<void>((resolve) => {
        resolveDrain = resolve
        if (ready()) settle()
      })
    },
  }
}

export const hostFromAudioContext = (context: AudioContext): PcmAudioHost => ({
  get currentTime() {
    return context.currentTime
  },
  resume() {
    void context.resume()
  },
  close() {
    void context.close()
  },
  play(samples, when) {
    const buffer = context.createBuffer(1, samples.length, TTS_SAMPLE_RATE)
    buffer.copyToChannel(samples, 0)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start(when)
    const clip: ScheduledClip = {
      stop() {
        source.stop()
      },
      disconnect() {
        source.disconnect()
      },
      onended: null,
    }
    // Read the clip handler at fire time so schedule() can replace it.
    source.onended = () => {
      clip.onended?.()
    }
    return clip
  },
})
