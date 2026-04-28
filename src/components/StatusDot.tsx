export function StatusDot({ size = 8 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block rounded-full bg-rmai-green ring-[3px] ring-rmai-green/10"
    />
  )
}
