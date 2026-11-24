import { ASR_MAX_SECONDS, ASR_SAMPLE_RATE } from '@deepapi/types'
import { encodeWav, resampleLinear } from './wav.js'

export type LevelAnalyser = {
  fftSize: number
  smoothingTimeConstant: number
  frequencyBinCount: number
  getFloatFrequencyData(array: Float32Array): void
  context?: { sampleRate: number }
}

type ProcessorEvent = { inputBuffer: { getChannelData(channel: number): Float32Array } }

/**
 * Anything the recording graph can connect to. Real AudioNodes and the test
 * doubles both satisfy this; connect() must not require a full AudioNode.
 */
type GraphNode = object

type ProcessorLike = {
  onaudioprocess: ((event: ProcessorEvent) => void) | null
  connect(destination: GraphNode): void
  disconnect(): void
}

type NodeLike = {
  connect(destination: GraphNode): void
  disconnect(): void
}

export type RecordingContext = {
  sampleRate: number
  destination: AudioNode
  createMediaStreamSource(stream: MediaStream): NodeLike
  createAnalyser(): LevelAnalyser & NodeLike
  createScriptProcessor(bufferSize: number, inputs: number, outputs: number): ProcessorLike
  close(): void | Promise<void>
}

export type RecordingHost = {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
  createContext(sampleRate: number): RecordingContext
}

export type Recording = {
  analyser: LevelAnalyser
  stop(): Promise<Blob | null>
  cancel(): void
}

const BUFFER_SIZE = 4096

const wrapProcessor = (node: ScriptProcessorNode): ProcessorLike => ({
  get onaudioprocess() {
    return node.onaudioprocess as ProcessorLike['onaudioprocess']
  },
  set onaudioprocess(handler) {
    node.onaudioprocess = handler as ScriptProcessorNode['onaudioprocess']
  },
  connect(destination) {
    node.connect(destination as AudioNode)
  },
  disconnect() {
    node.disconnect()
  },
})

export const browserRecordingHost = (): RecordingHost => ({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createContext(sampleRate) {
    const context = new AudioContext({ sampleRate })
    return {
      get sampleRate() {
        return context.sampleRate
      },
      destination: context.destination,
      createMediaStreamSource: (stream) => context.createMediaStreamSource(stream),
      createAnalyser: () => context.createAnalyser(),
      createScriptProcessor: (bufferSize, inputs, outputs) =>
        wrapProcessor(context.createScriptProcessor(bufferSize, inputs, outputs)),
      close: () => context.close(),
    }
  },
})

const stopTracks = (stream: MediaStream) => {
  for (const track of stream.getTracks()) track.stop()
}

/**
 * Records mono float audio and encodes a 16 kHz WAV.
 * The processor stays connected so the callback runs, and its output is left silent.
 */
export const startRecording = async (onLimit: () => void, host: RecordingHost = browserRecordingHost()): Promise<Recording> => {
  const stream = await host.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  let context: RecordingContext
  try {
    context = host.createContext(ASR_SAMPLE_RATE)
  } catch (error) {
    stopTracks(stream)
    throw error
  }
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.2
  const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1)
  const chunks: Float32Array[] = []
  let length = 0
  let limited = false
  let released = false
  const actualRate = context.sampleRate || ASR_SAMPLE_RATE

  const release = () => {
    if (released) return
    released = true
    processor.onaudioprocess = null
    try { processor.disconnect() } catch { /* already disconnected */ }
    try { analyser.disconnect() } catch { /* already disconnected */ }
    try { source.disconnect() } catch { /* already disconnected */ }
    stopTracks(stream)
    void context.close()
  }

  processor.onaudioprocess = (event) => {
    if (released || limited) return
    const input = event.inputBuffer.getChannelData(0)
    const copy = new Float32Array(input.length)
    copy.set(input)
    chunks.push(copy)
    length += copy.length
    if (length / actualRate >= ASR_MAX_SECONDS) {
      limited = true
      onLimit()
    }
  }
  source.connect(analyser)
  analyser.connect(processor)
  processor.connect(context.destination)

  return {
    analyser,
    async stop() {
      release()
      if (length === 0) return null
      const merged = new Float32Array(length)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      const resampled = actualRate === ASR_SAMPLE_RATE ? merged : resampleLinear(merged, actualRate, ASR_SAMPLE_RATE)
      return encodeWav(resampled, ASR_SAMPLE_RATE)
    },
    cancel() {
      release()
    },
  }
}
