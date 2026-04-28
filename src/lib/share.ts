// ABOUTME: Web Share API wrapper — uses native share sheet when available, falls back to download.
// ABOUTME: Revokes object URLs after use to avoid memory leaks.

export async function sharePlanWavBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'audio/wav' })
  if ('share' in navigator && (navigator as Navigator).canShare?.({ files: [file] })) {
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
