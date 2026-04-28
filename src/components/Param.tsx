import type { ReactNode } from 'react'

export function Param({
  label, value, sub, children,
}: { label: string; value: string; sub: string; children: ReactNode }) {
  return (
    <div className="relative mb-[10px] rounded-[10px] border border-rmai-border bg-white p-[14px]">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[13.5px] font-semibold tracking-tight">{label}</div>
          <div className="mt-[2px] text-[10px] tracking-wider text-rmai-mut">{sub}</div>
        </div>
        <div className="font-mono text-[13px] font-semibold text-rmai-purple">{value}</div>
      </div>
      <div className="relative mt-[10px]">{children}</div>
    </div>
  )
}
