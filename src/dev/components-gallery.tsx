import { Wordmark } from '../components/Wordmark'
import { Eyebrow } from '../components/Eyebrow'
import { StatusDot } from '../components/StatusDot'
import { PrimaryButton } from '../components/PrimaryButton'
import { GhostButton } from '../components/GhostButton'
import { Slider } from '../components/Slider'
import { Param } from '../components/Param'
import { Range } from '../components/Range'
import { Waveform } from '../components/Waveform'
import { StereoWaveform } from '../components/StereoWaveform'
import { Icon } from '../components/icons'
import { Motif } from '../components/Motif'
import { TopBar } from '../components/TopBar'

export function Gallery() {
  return (
    <div className="mx-auto max-w-[420px] space-y-8 p-6">
      <section>
        <h2 className="mb-2 text-sm font-bold">Wordmark</h2>
        <Wordmark />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold">Buttons</h2>
        <div className="flex flex-col gap-2">
          <PrimaryButton icon={Icon.download(16)}>render &amp; export</PrimaryButton>
          <GhostButton>rerecord</GhostButton>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold">Status</h2>
        <div className="flex items-center gap-2">
          <StatusDot /><span className="font-mono text-xs">engine ready · 48 kHz · 16-bit · offline</span>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold">Sliders</h2>
        <Param label="bit depth" sub="quantisation" value="4-bit"><Slider value={0.25} /></Param>
        <Param label="pitch shift" sub="semitones" value="−3 st">
          <Slider value={0.375} neutralCenter />
          <Range left="−12" right="+12" />
        </Param>
        <Param label="speed" sub="multiplier" value="1.25x">
          <input type="range" min="0" max="1" step="0.001" defaultValue="0.65" readOnly
            className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
          <Slider value={0.65} neutralCenter />
          <Range left="0.5×" right="2.0×" centerHint="1.0×" />
        </Param>
        <Param label="filter" sub="lo-pass / hi-pass" value="LP 38%">
          <Slider value={0.31} neutralCenter />
          <Range left="LP" right="HP" centerHint="neutral" />
        </Param>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold">Waveform</h2>
        <Waveform played={0.42} />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold">Stereo Waveform</h2>
        <StereoWaveform played={0.42} />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold">Icons</h2>
        <div className="flex flex-wrap gap-2 text-rmai-fg1">
          {(['mic','upload','folder','play','pause','loop','arrow','back','download','share','more','reset','menu'] as const).map((k) => (
            <div key={k} className="flex flex-col items-center text-[10px] text-rmai-mut">
              {Icon[k](18)}<span>{k}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold">TopBar + Motif</h2>
        <div className="relative h-[80px] overflow-hidden rounded border border-rmai-border">
          <Motif size={120} className="-right-4 -top-4" />
          <TopBar left={<Wordmark small />} right={<Eyebrow>—— v0</Eyebrow>} />
        </div>
      </section>
    </div>
  )
}
