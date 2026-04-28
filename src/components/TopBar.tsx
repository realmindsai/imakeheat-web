import type { ReactNode } from 'react'

export function TopBar({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-[22px] pt-[14px]">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}
