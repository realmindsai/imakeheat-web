// ABOUTME: Share-or-download wrapper — share sheet on mobile, plain download on desktop.
// ABOUTME: Desktop's "share" sheet is a useless detour vs a direct save, so we skip it there.

function isMobile(): boolean {
  // userAgentData.mobile is the modern signal; maxTouchPoints catches older mobile UAs.
  // Both being falsy means desktop, where users want a download not a share sheet.
  const uad = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uad && typeof uad.mobile === 'boolean') return uad.mobile
  return navigator.maxTouchPoints > 0
}

export async function sharePlanWavBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'audio/wav' })
  if (isMobile() && 'share' in navigator && (navigator as Navigator).canShare?.({ files: [file] })) {
    await (navigator as Navigator).share({ files: [file] })
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
