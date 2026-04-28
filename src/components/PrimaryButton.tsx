import type { ReactNode } from 'react'

export function PrimaryButton({
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
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] bg-rmai-orange px-[18px] py-[14px] text-[14px] font-semibold tracking-tight text-white disabled:opacity-50 ${full ? 'w-full' : ''}`}
    >
      {icon}<span>{children}</span>
    </button>
  )
}
