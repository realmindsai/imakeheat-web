// ABOUTME: Waveform display with draggable start/end trim handles.
// ABOUTME: Renders shaded exclusion regions and purple handle bars; fires onChange on drag.

import { useRef, useState, useEffect } from 'react'
import { StereoWaveform } from './StereoWaveform'

interface Props {
  durationSec: number
  startSec: number
  endSec: number
  onChange(startSec: number, endSec: number): void
}

export function TrimWaveform({ durationSec, startSec, endSec, onChange }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null)

  const startPct = durationSec > 0 ? (startSec / durationSec) * 100 : 0
  const endPct = durationSec > 0 ? (endSec / durationSec) * 100 : 100

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging || !ref.current) return
      const r = ref.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
      const sec = pct * durationSec
      if (dragging === 'start') onChange(Math.min(sec, endSec - 0.05), endSec)
      else                      onChange(startSec, Math.max(sec, startSec + 0.05))
    }
    const onUp = () => setDragging(null)
    if (dragging) {
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, startSec, endSec, durationSec, onChange])

  return (
    <div ref={ref} className="relative">
      <StereoWaveform />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-y-0 left-0 bg-rmai-bg/60" style={{ width: `${startPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-rmai-bg/60" style={{ width: `${100 - endPct}%` }} />
      </div>
      <div className="pointer-events-auto absolute inset-y-0 w-1 cursor-ew-resize bg-rmai-purple"
        style={{ left: `${startPct}%`, transform: 'translateX(-50%)' }}
        onPointerDown={() => setDragging('start')} />
      <div className="pointer-events-auto absolute inset-y-0 w-1 cursor-ew-resize bg-rmai-purple"
        style={{ left: `${endPct}%`, transform: 'translateX(-50%)' }}
        onPointerDown={() => setDragging('end')} />
    </div>
  )
}
