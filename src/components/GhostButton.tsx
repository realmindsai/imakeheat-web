import type { ReactNode } from 'react'

export function GhostButton({
  children, icon, full = false, onClick, disabled = false,
}: {
  children: ReactNode
  icon?: ReactNode
  full?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] border border-rmai-border bg-white px-[18px] py-[13px] text-[14px] font-semibold tracking-tight text-rmai-fg1 disabled:opacity-50 ${full ? 'w-full' : ''}`}
    >
      {icon}<span>{children}</span>
    </button>
  )
}
