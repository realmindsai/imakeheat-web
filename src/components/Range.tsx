export function Range({
  left, right, centerHint,
}: { left: string; right: string; centerHint?: string }) {
  return (
    <div className="relative mt-1 flex justify-between font-mono text-[10px] text-rmai-mut">
      <span>{left}</span>
      {centerHint && (
        <span className="absolute left-1/2 -translate-x-1/2">{centerHint}</span>
      )}
      <span>{right}</span>
    </div>
  )
}
