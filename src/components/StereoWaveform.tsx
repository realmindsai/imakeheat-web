import { Waveform } from './Waveform'

export function StereoWaveform({ height = 130, played = 0 }: { height?: number; played?: number }) {
  const half = height / 2 - 2
  return (
    <div className="flex flex-col gap-1">
      <Waveform height={half} played={played} />
      <div style={{ transform: 'scaleY(-1)' }}>
        <Waveform height={half} played={played} dim />
      </div>
    </div>
  )
}
