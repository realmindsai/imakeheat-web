// ABOUTME: Two stacked Waveforms (top normal, bottom mirrored+dim) for a stereo display.
// ABOUTME: When a buffer is provided, draws real per-channel peaks; else falls back to placeholder.

import { useMemo } from 'react'
import { Waveform } from './Waveform'
import { peaksFromBuffer } from '../audio/peaks'
import type { AudioBufferLike } from '../audio/types'

interface Props {
  height?: number
  played?: number
  bars?: number
  buffer?: AudioBufferLike | null
}

export function StereoWaveform({ height = 130, played = 0, bars = 88, buffer = null }: Props) {
  const half = height / 2 - 2

  const { topPeaks, bottomPeaks } = useMemo(() => {
    if (!buffer) return { topPeaks: null, bottomPeaks: null }
    const top = peaksFromBuffer(buffer, bars, 0)
    const bottom = buffer.numberOfChannels > 1
      ? peaksFromBuffer(buffer, bars, 1)
      : top
    return { topPeaks: top, bottomPeaks: bottom }
  }, [buffer, bars])

  return (
    <div className="flex flex-col gap-1">
      <Waveform height={half} bars={bars} played={played} peaks={topPeaks} />
      <div style={{ transform: 'scaleY(-1)' }}>
        <Waveform height={half} bars={bars} played={played} peaks={bottomPeaks} dim />
      </div>
    </div>
  )
}
