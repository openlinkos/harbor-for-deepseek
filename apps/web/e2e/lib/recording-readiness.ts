import { expect, type Page } from '@playwright/test'

/** Review-only proposal: delegates the production handler, then counts its real input frames. */
export const observeRecorderSamples = async (page: Page) => {
  await page.addInitScript(() => {
    type Probe = { id: number; active: boolean; callbacks: number; frames: number }
    const mark = window as unknown as { __recorderSamples?: Probe }
    const NativeContext = window.AudioContext
    let nextId = 0
    window.AudioContext = class extends NativeContext {
      createScriptProcessor(bufferSize: number, inputs: number, outputs: number) {
        const node = super.createScriptProcessor(bufferSize, inputs, outputs)
        const descriptor = Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype, 'onaudioprocess')!
        const probe: Probe = { id: ++nextId, active: false, callbacks: 0, frames: 0 }
        mark.__recorderSamples = probe
        let handler: ((this: ScriptProcessorNode, event: AudioProcessingEvent) => unknown) | null = null
        Object.defineProperty(node, 'onaudioprocess', {
          configurable: true,
          get: () => handler,
          set: (next: typeof handler) => {
            handler = next
            probe.active = next !== null
            descriptor.set!.call(node, next === null ? null : (event: AudioProcessingEvent) => {
              next.call(node, event)
              probe.callbacks += 1
              probe.frames += event.inputBuffer.getChannelData(0).length
            })
          },
        })
        return node
      }
    } as typeof AudioContext
  })
}

/** Call only after the current operation has reached recording; never reuse an old probe. */
export const waitForRecorderSamples = async (page: Page) => {
  const id = await page.evaluate(() => (window as unknown as {
    __recorderSamples?: { id: number }
  }).__recorderSamples?.id)
  expect(id, 'current recorder node must exist').toBeDefined()
  await expect.poll(() => page.evaluate((expectedId) => {
    const current = (window as unknown as {
      __recorderSamples?: { id: number; active: boolean; frames: number }
    }).__recorderSamples
    return current?.id === expectedId && current.active && current.frames > 0
  }, id), { message: 'current production recorder handler has received actual PCM frames' }).toBe(true)
}
