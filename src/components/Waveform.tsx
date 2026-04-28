import { useEffect, useRef } from 'react'

interface Props {
  height?: number
  bars?: number
  played?: number
  analyser?: AnalyserNode | null
  peaks?: Float32Array | null
  dim?: boolean
}

const RMAI_FG1 = '#1A1B25'
const RMAI_PURPLE = '#A77ACD'
const RMAI_BORDER = '#E8E8EB'

export function Waveform({ height = 100, bars = 88, played = 0, analyser = null, peaks = null, dim = false }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const draw = (heights: Float32Array) => {
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)

      const playedIdx = Math.floor(bars * played)
      const barW = W / bars - 2

      for (let i = 0; i < bars; i++) {
        const h = Math.max(0.06, heights[i])
        const barH = h * H * 0.95
        const x = i * (W / bars) + 1
        const y = (H - barH) / 2
        ctx.fillStyle = dim ? RMAI_BORDER : i < playedIdx ? RMAI_PURPLE : RMAI_FG1
        ctx.fillRect(x, y, Math.max(1, barW), barH)
      }
    }

    if (!analyser) {
      const heights = new Float32Array(bars)
      if (peaks && peaks.length > 0) {
        // Resample provided peaks to `bars` bins via linear interpolation.
        for (let i = 0; i < bars; i++) {
          const idx = (i / bars) * peaks.length
          const lo = Math.floor(idx)
          const hi = Math.min(peaks.length - 1, lo + 1)
          const t = idx - lo
          heights[i] = peaks[lo] * (1 - t) + peaks[hi] * t
        }
      } else {
        // Deterministic placeholder shape — used when no source is loaded yet.
        for (let i = 0; i < bars; i++) {
          const x = i / bars
          const env = 0.45 + 0.55 * Math.pow(Math.sin(x * Math.PI), 0.5)
          const noise = 0.5 + 0.5 * Math.sin(i * 12.9898 + 78.233)
          const n2 = 0.5 + 0.5 * Math.sin(i * 1.7321 + 4.123)
          heights[i] = env * (0.35 + 0.65 * Math.abs(noise * 0.6 + n2 * 0.4))
        }
      }
      draw(heights)
      return
    }

    const data = new Float32Array(analyser.fftSize)
    let raf = 0
    const tick = () => {
      analyser.getFloatTimeDomainData(data)
      const heights = new Float32Array(bars)
      const step = Math.floor(data.length / bars)
      for (let i = 0; i < bars; i++) {
        let m = 0
        for (let j = 0; j < step; j++) {
          const a = Math.abs(data[i * step + j] || 0)
          if (a > m) m = a
        }
        heights[i] = Math.min(1, m * 1.5)
      }
      draw(heights)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bars, played, analyser, peaks, dim])

  return <canvas ref={ref} style={{ height, width: '100%' }} />
}
