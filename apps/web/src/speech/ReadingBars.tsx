import { Fragment, useEffect, useRef, useState } from 'react'

/** Four 2px bars. Playing uses SMIL so height and y stay centered. Loading is a 4px sweep. */
const BAR_XS = [1, 5, 9, 13]
const WAVE_BEGINS = ['0s', '-1.2s', '-0.8s', '-0.4s']
const STATIC_PLAYING_HEIGHTS = [7, 14, 4, 10]
const EASE_IN_OUT = '0.42 0 0.58 1'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return reduced
}

export const ReadingBars = ({ mode }: { mode: 'loading' | 'playing' }) => {
  const reducedMotion = usePrefersReducedMotion()
  const playing = mode === 'playing'
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    svgRef.current?.unpauseAnimations()
  }, [])
  return (
    <svg
      ref={svgRef}
      className={`read-bars ${playing ? 'playing' : 'loading'}`}
      data-mode={mode}
      data-testid="reading-bars"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      {BAR_XS.map((x, index) => {
        const height = playing ? (reducedMotion ? STATIC_PLAYING_HEIGHTS[index] : 14) : 4
        const y = (16 - height) / 2
        return (
          <Fragment key={x}>
            <rect className="read-bar" x={x} y={y} width={2} height={height} rx={1}>
              {playing && !reducedMotion ? (
                <>
                  <animate attributeName="height" values="14;4;14" keyTimes="0;0.5;1" calcMode="spline" keySplines={`${EASE_IN_OUT};${EASE_IN_OUT}`} dur="1.6s" begin={WAVE_BEGINS[index]} repeatCount="indefinite" />
                  <animate attributeName="y" values="1;6;1" keyTimes="0;0.5;1" calcMode="spline" keySplines={`${EASE_IN_OUT};${EASE_IN_OUT}`} dur="1.6s" begin={WAVE_BEGINS[index]} repeatCount="indefinite" />
                </>
              ) : null}
            </rect>
            {playing ? null : <rect className={`read-sweep read-sweep-${index + 1}`} x={x} y={y} width={2} height={height} rx={1} />}
          </Fragment>
        )
      })}
    </svg>
  )
}
