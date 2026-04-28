// ABOUTME: Human-readable relative time formatter for export timestamps.
// ABOUTME: No external deps; pure function with optional nowMs for testability.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function relativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const deltaSec = Math.floor((nowMs - timestampMs) / 1000)
  if (deltaSec < 60) return 'just now'
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`
  if (deltaSec < 86_400) return `${Math.floor(deltaSec / 3600)}h ago`
  if (deltaSec < 172_800) return 'yesterday'
  const d = new Date(timestampMs)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
