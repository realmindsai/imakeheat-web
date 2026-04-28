// ABOUTME: Preview screen — review source audio with trim handles before applying effects.
// ABOUTME: Shows waveform, source metadata, playback controls, and trim points.

import { useState } from 'react'
import { Eyebrow } from '../components/Eyebrow'
import { Wordmark } from '../components/Wordmark'
import { TopBar } from '../components/TopBar'
import { TrimWaveform } from '../components/TrimWaveform'
import { PrimaryButton } from '../components/PrimaryButton'
import { GhostButton } from '../components/GhostButton'
import { Icon } from '../components/icons'
import { useSessionStore, defaultEffects } from '../store/session'
import { engine } from '../audio/engine'
import { navigate } from '../lib/router'

export function Preview() {
  const source = useSessionStore((s) => s.source)
  const trim = useSessionStore((s) => s.trim)
  const [playing, setPlaying] = useState(false)

  if (!source) {
    navigate('home')
    return null
  }

  const togglePlay = async () => {
    if (playing) {
      engine.pause()
      setPlaying(false)
    } else {
      await engine.play(trim, defaultEffects)
      setPlaying(true)
    }
  }

  const setTrim = (startSec: number, endSec: number) => {
    useSessionStore.getState().setTrim({ startSec, endSec })
    void engine.setTrim({ startSec, endSec })
  }

  const min = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col">
      <TopBar
        left={
          <button onClick={() => navigate('home')} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-rmai-border bg-white">
            {Icon.back(16)}
          </button>
        }
        right={<Wordmark small />}
      />
      <div className="px-[22px] pt-6">
        <Eyebrow>—— step 02 of 03 · preview</Eyebrow>
        <h2 className="mt-2 text-[22px] font-bold tracking-tight leading-tight">
          review the source<br />before we set it on fire.
        </h2>
      </div>
      <div className="mx-[22px] mt-5 rounded-[12px] border border-rmai-border bg-white p-[18px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <span className="rounded bg-rmai-lavender px-2 py-[3px] font-mono text-[10px] font-bold tracking-wider text-rmai-purple">
              WAV
            </span>
            <span className="font-mono text-[12px]">{source.name}</span>
          </div>
        </div>
        <div className="mt-3 h-[110px]">
          <TrimWaveform
            durationSec={source.durationSec}
            startSec={trim.startSec}
            endSec={trim.endSec}
            onChange={setTrim}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-[10px] border-t border-rmai-border pt-3">
          <Metric label="duration" value={min(source.durationSec)} />
          <Metric label="sample" value={`${Math.round(source.sampleRateHz / 1000)}k`} />
          <Metric label="channels" value={source.channels === 2 ? 'stereo' : 'mono'} />
        </div>
      </div>
      <div className="flex items-center gap-[14px] px-[22px] pt-[22px]">
        <button onClick={() => { void togglePlay() }} className="flex h-16 w-16 items-center justify-center rounded-full bg-rmai-purple text-white shadow-[0_8px_20px_rgba(167,122,205,0.35)]">
          {playing ? Icon.pause(22) : Icon.play(22)}
        </button>
        <div className="flex-1">
          <div className="text-[13px] font-semibold">tap to preview source</div>
          <div className="mt-[2px] text-[11.5px] text-rmai-mut">no effects applied — original audio</div>
        </div>
      </div>
      <div className="mt-auto flex gap-[10px] px-[22px] pb-[18px]">
        <GhostButton full onClick={() => navigate('home')}>rerecord</GhostButton>
        <PrimaryButton full icon={Icon.arrow(16)} onClick={() => navigate('effects')}>to effects</PrimaryButton>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-rmai-mut">{label}</div>
      <div className="mt-1 font-mono text-[15px] font-semibold tracking-tight">{value}</div>
    </div>
  )
}
