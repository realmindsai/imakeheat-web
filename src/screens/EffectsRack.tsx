// ABOUTME: EffectsRack — five parameter panels for bit depth, sample rate, pitch, speed, and filter.
// ABOUTME: Writes changes to session store and pushes to engine worklet in real time.

import { Param } from '../components/Param'
import { Slider } from '../components/Slider'
import { Range } from '../components/Range'
import { Eyebrow } from '../components/Eyebrow'
import { useSessionStore } from '../store/session'
import { engine } from '../audio/engine'
import { sliderToSpeed, speedToSlider } from '../audio/speed'

export function EffectsRack() {
  const fx = useSessionStore((s) => s.effects)

  const update = (patch: Partial<typeof fx>) => {
    useSessionStore.getState().setEffect(patch)
    engine.setEffect({ ...fx, ...patch })
  }

  const bitDepths = [2, 4, 8, 12, 16] as const

  const srNorm = (fx.sampleRateHz - 4000) / (48000 - 4000)
  const pitchNorm = (fx.pitchSemitones + 12) / 24
  const filterNorm = (fx.filterValue + 1) / 2

  return (
    <div className="px-[22px] pt-[14px]">
      <Eyebrow className="mb-[10px] !text-rmai-mut">effects rack</Eyebrow>

      <Param label="bit depth" sub="quantisation" value={`${fx.bitDepth}-bit`}>
        <div className="mt-2 flex gap-1">
          {bitDepths.map((b) => (
            <button
              key={b}
              onClick={() => update({ bitDepth: b })}
              className={`flex-1 rounded-md py-[7px] font-mono text-[12px] font-semibold ${
                fx.bitDepth === b
                  ? 'border border-rmai-fg1 bg-rmai-fg1 text-white'
                  : 'border border-rmai-border bg-white text-rmai-fg1'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </Param>

      <Param label="sample rate" sub="downsample" value={`${fx.sampleRateHz} Hz`}>
        <input type="range" min="4000" max="48000" step="100" value={fx.sampleRateHz}
          onChange={(e) => update({ sampleRateHz: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={srNorm} />
        <Range left="4 k" right="48 k" />
      </Param>

      <Param label="pitch shift" sub="semitones" value={`${fx.pitchSemitones >= 0 ? '+' : ''}${fx.pitchSemitones.toFixed(0)} st`}>
        <input type="range" min="-12" max="12" step="1" value={fx.pitchSemitones}
          onChange={(e) => update({ pitchSemitones: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={pitchNorm} neutralCenter />
        <Range left="−12" right="+12" />
      </Param>

      <Param label="speed" sub="multiplier" value={`${fx.speed.toFixed(2)}x`}>
        <input type="range" min="0" max="1" step="0.001"
          value={speedToSlider(fx.speed)}
          onChange={(e) => update({ speed: sliderToSpeed(Number(e.target.value)) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={speedToSlider(fx.speed)} neutralCenter />
        <Range left="0.5×" right="2.0×" centerHint="1.0×" />
      </Param>

      <Param label="filter" sub="lo-pass / hi-pass"
        value={
          Math.abs(fx.filterValue) < 0.05
            ? 'neutral'
            : `${fx.filterValue < 0 ? 'LP' : 'HP'} ${Math.round(Math.abs(fx.filterValue) * 100)}%`
        }
      >
        <input type="range" min="-1" max="1" step="0.01" value={fx.filterValue}
          onChange={(e) => update({ filterValue: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={filterNorm} neutralCenter />
        <Range left="LP" right="HP" centerHint="neutral" />
      </Param>
    </div>
  )
}
