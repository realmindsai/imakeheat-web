interface Props {
  value: number              // 0..1
  neutralCenter?: boolean
}

export function Slider({ value, neutralCenter = false }: Props) {
  const v = Math.max(0, Math.min(1, value))
  const pct = `${v * 100}%`

  let fillLeft = '0%'
  let fillRight = `${100 - v * 100}%`
  if (neutralCenter) {
    fillLeft = `${Math.min(50, v * 100)}%`
    fillRight = `${Math.min(50, 100 - v * 100)}%`
  }

  return (
    <div className="relative flex h-[22px] items-center">
      <div className="absolute inset-x-0 h-[2px] rounded-full bg-rmai-border" />
      <div
        className="absolute h-[2px] rounded-full bg-rmai-purple"
        style={{ left: fillLeft, right: fillRight }}
      />
      {neutralCenter && (
        <div
          data-center-tick
          className="absolute left-1/2 top-1 h-[14px] w-px -translate-x-1/2 bg-rmai-mut"
        />
      )}
      <div
        data-thumb
        className="absolute h-[18px] w-[18px] -translate-x-1/2 rounded-full border-2 border-rmai-purple bg-white shadow-[0_2px_6px_rgba(167,122,205,0.25)]"
        style={{ left: pct }}
      />
    </div>
  )
}
