import type { ReactNode } from 'react'

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[9.5px] font-bold uppercase tracking-[0.14em] text-rmai-purple ${className}`}>
      {children}
    </div>
  )
}
