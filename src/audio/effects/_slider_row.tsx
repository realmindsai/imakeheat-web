// ABOUTME: Shared slider row for multi-control effect panels with visible labels.
// ABOUTME: Wraps the invisible range input, visual slider, and range labels in the required relative container.

import { Slider } from '../../components/Slider'
import { Range } from '../../components/Range'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step: number
  left: string
  right: string
  onChange(value: number): void
  className?: string
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  left,
  right,
  onChange,
  className = '',
}: Props) {
  const norm = (value - min) / (max - min)
  const mt = className ? ` ${className}` : ''
  return (
    <div className={`relative${mt}`}>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-rmai-mut">
        {label}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-x-0 bottom-[12px] z-10 h-[22px] cursor-pointer opacity-0"
      />
      <Slider value={norm} />
      <Range left={left} right={right} />
    </div>
  )
}
