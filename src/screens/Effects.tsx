// ABOUTME: Effects screen — live preview with audio engine, effects rack, and render-to-export flow.
// ABOUTME: Wires session store + engine singleton; navigates to exports on successful render.

import { useEffect, useRef, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/icons'
import { Slider } from '../components/Slider'
import { Waveform } from '../components/Waveform'
import { TrimWaveform } from '../components/TrimWaveform'
import { StatusDot } from '../components/StatusDot'
import { PrimaryButton } from '../components/PrimaryButton'
import { EffectsRack } from './EffectsRack'
import { RenderModal } from '../components/RenderModal'
import { useSessionStore, defaultEffects } from '../store/session'
import { engine } from '../audio/engine'
import { putExport } from '../store/exports'
import { wavEncode } from '../audio/wav'
import { newId } from '../lib/ids'
import { navigate } from '../lib/router'

export function Effects() {
  const source = useSessionStore((s) => s.source)
  const trim = useSessionStore((s) => s.trim)
  const fx = useSessionStore((s) => s.effects)
  const playing = useSessionStore((s) => s.playback.isPlaying)
  const [latencyMs, setLatencyMs] = useState(0)
  const [progress, setProgress] = useState(0)
  const playheadRaf = useRef<number | null>(null)

  useEffect(() => {
    if (!source) navigate('home')
  }, [source])

  useEffect(() => {
    const update = () => {
      const ctx = engine.context
      if (!ctx) return
      const total = (ctx.baseLatency + (ctx.outputLatency ?? 0)) * 1000
      setLatencyMs(Math.round(total))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!playing || !source) return
    const tick = () => {
      const t = engine.getCurrentSourceTimeSec(trim)
      const span = Math.max(0.001, trim.endSec - trim.startSec)
      // Loop playback runs indefinitely; mod by span so the playhead
      // sweeps the trim window repeatedly instead of pinning at 100%.
      const elapsed = t - trim.startSec
      const looped = ((elapsed % span) + span) % span
      setProgress(Math.min(1, Math.max(0, looped / span)))
      playheadRaf.current = requestAnimationFrame(tick)
    }
    playheadRaf.current = requestAnimationFrame(tick)
    return () => {
      if (playheadRaf.current != null) cancelAnimationFrame(playheadRaf.current)
    }
  }, [playing, source, trim])

  if (!source) return null

  const togglePlay = async () => {
    if (playing) {
      engine.pause()
      useSessionStore.getState().setPlayback({ isPlaying: false })
    } else {
      await engine.play(trim, fx)
      useSessionStore.getState().setPlayback({ isPlaying: true })
    }
  }

  const reset = () => {
    useSessionStore.getState().resetEffects()
    engine.setEffect(defaultEffects)
  }

  const setTrim = (startSec: number, endSec: number) => {
    useSessionStore.getState().setTrim({ startSec, endSec })
    void engine.setTrim({ startSec, endSec })
  }

  const onRender = async () => {
    if (!source) return
    useSessionStore.getState().beginRender()
    try {
      const rendered = await engine.render(source.buffer, trim, fx)
      const blob = await wavEncode({
        numberOfChannels: rendered.numberOfChannels,
        sampleRate: rendered.sampleRate,
        length: rendered.length,
        getChannelData: (c) => rendered.getChannelData(c),
      })
      const stem = source.name.replace(/\.[^.]+$/, '')
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '').replace(/(\d{8})(\d{4})/, '$1-$2')
      const name = `${stem}_crushed_${stamp}.wav`
      await putExport({
        id: newId(),
        createdAt: Date.now(),
        name,
        sourceName: source.name,
        blob,
        durationSec: rendered.duration,
        sizeBytes: blob.size,
        channels: rendered.numberOfChannels,
        sampleRateHz: rendered.sampleRate,
        kind: 'WAV',
        starred: false,
        fxSnapshot: fx,
        trimSnapshot: trim,
      })
      useSessionStore.getState().finishRender()
      navigate('exports')
    } catch (e) {
      useSessionStore.getState().failRender(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col">
      <TopBar
        left={
          <div className="flex items-center gap-[10px]">
            <button onClick={() => navigate('preview')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rmai-border bg-white">
              {Icon.back(14)}
            </button>
            <div>
              <div className="text-[13px] font-bold tracking-tight">effects</div>
              <div className="font-mono text-[10px] text-rmai-mut">{source.name}</div>
            </div>
          </div>
        }
        right={
          <button onClick={reset} className="flex items-center gap-[5px] rounded-full border border-rmai-border bg-white px-[10px] py-[6px] text-[11px] font-semibold text-rmai-fg2">
            {Icon.reset(12)} reset
          </button>
        }
      />
      <div className="px-[22px] pt-[14px]">
        <div className="rounded-[10px] border border-rmai-border bg-rmai-lavender p-[14px]">
          <Waveform height={56} bars={70} played={progress} analyser={engine.getAnalyser()} />
          <div className="mt-2"><Slider value={progress} /></div>
          <div className="mt-2 flex items-center justify-between">
            <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-rmai-fg1 text-white">
              {playing ? Icon.pause(14) : Icon.play(14)}
            </button>
            <div className="flex items-center gap-[6px]">
              <StatusDot />
              <span className="font-mono text-[10.5px]">live · p50 {latencyMs}ms</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-[22px] pt-[10px]">
        <div className="rounded-[10px] border border-rmai-border bg-white p-[12px]">
          <div className="mb-[8px] flex items-center justify-between text-[10px] tracking-wider text-rmai-mut">
            <span className="uppercase">chunk</span>
            <span className="font-mono">
              {trim.startSec.toFixed(2)}s → {trim.endSec.toFixed(2)}s
              · {(trim.endSec - trim.startSec).toFixed(2)}s
            </span>
          </div>
          <div className="h-[64px]">
            <TrimWaveform
              durationSec={source.durationSec}
              startSec={trim.startSec}
              endSec={trim.endSec}
              onChange={setTrim}
              buffer={source.buffer}
            />
          </div>
        </div>
      </div>
      <EffectsRack />
      <div className="mt-auto px-[22px] py-[18px]">
        <PrimaryButton full icon={Icon.download(16)} onClick={onRender}>render &amp; export</PrimaryButton>
      </div>
      <RenderModal />
    </div>
  )
}
