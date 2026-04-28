export function Motif({ size = 110, opacity = 0.55, className = '' }: { size?: number; opacity?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`pointer-events-none absolute ${className}`}
      style={{ opacity }}
    >
      <circle cx="20" cy="22" r="14" fill="#A77ACD" fillOpacity="0.18" />
      <circle cx="48" cy="14" r="9" fill="#A77ACD" fillOpacity="0.22" />
      <circle cx="68" cy="36" r="18" fill="#A77ACD" fillOpacity="0.14" />
      <circle cx="32" cy="52" r="6" fill="#A77ACD" fillOpacity="0.28" />
      <circle cx="86" cy="60" r="10" fill="#A77ACD" fillOpacity="0.18" />
    </svg>
  )
}
