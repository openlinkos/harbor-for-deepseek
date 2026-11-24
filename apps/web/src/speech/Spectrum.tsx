import { useEffect, useRef, useState } from 'react'
import type { LevelAnalyser } from './recorder.js'
import { bandTargets, BAR_MIN, barCountFor, barHeight, buildRanges, tiltFor } from './spectrum.js'

/** Live levels from the recording analyser. Heights are the signal, not a fixed loop. */
export const Spectrum = ({ analyser }: { analyser: LevelAnalyser | null }) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const analyserRef = useRef(analyser)
  analyserRef.current = analyser
  const [count, setCount] = useState(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const observer = new ResizeObserver(([entry]) => {
      setCount(barCountFor(entry?.contentRect.width ?? 0))
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || count < 1) return undefined
    const bars = [...root.querySelectorAll<HTMLElement>('.voice-bar')]
    const levels = new Float32Array(count)
    const tilts = tiltFor(count)
    let data = new Float32Array(0)
    let ranges = buildRanges(count, 16000 / 512, 256)
    let rangeKey = ''
    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const node = analyserRef.current
      if (node) {
        if (data.length !== node.frequencyBinCount) data = new Float32Array(node.frequencyBinCount)
        const rate = node.context?.sampleRate ?? 16000
        const key = `${rate}:${node.fftSize}:${data.length}`
        if (key !== rangeKey) {
          rangeKey = key
          ranges = buildRanges(count, rate / Math.max(1, node.fftSize), data.length)
        }
        node.getFloatFrequencyData(data)
        const targets = bandTargets(data, ranges, tilts)
        for (let index = 0; index < count; index += 1) {
          const prev = targets[Math.max(0, index - 1)] ?? 0
          const next = targets[Math.min(count - 1, index + 1)] ?? 0
          const target = (prev + (targets[index] ?? 0) * 2 + next) / 4
          const current = levels[index] ?? 0
          levels[index] = current + (target - current) * (target > current ? 0.8 : 0.35)
          const bar = bars[index]
          if (bar) bar.style.transform = `scaleY(${barHeight(levels[index] ?? 0) / BAR_MIN})`
        }
      }
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [count])

  return (
    <div ref={rootRef} className="voice-spectrum" data-testid="voice-spectrum" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <i key={index} className="voice-bar" />)}
    </div>
  )
}
