// ABOUTME: Full-screen recording overlay — manages mic permission, start/stop, and WAV blob decode.
// ABOUTME: On stop, decodes the blob into an AudioBuffer and pushes a Source into SessionStore.

import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import type { ActiveRecording } from '../audio/recorder'
import { useSessionStore } from '../store/session'
import { newId } from '../lib/ids'
import { navigate } from '../lib/router'
import { PrimaryButton } from '../components/PrimaryButton'
import { GhostButton } from '../components/GhostButton'

export function RecordOverlay({ onDone }: { onDone: () => void }) {
  const [recording, setRecording] = useState<ActiveRecording | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<number | null>(null)

  const start = async () => {
    try {
      const rec = await engine.startRecording()
      setRecording(rec)
      setElapsed(0)
      const startedAt = performance.now()
      intervalRef.current = window.setInterval(() => {
        setElapsed((performance.now() - startedAt) / 1000)
      }, 100)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const stop = async () => {
    if (!recording) return
    if (intervalRef.current != null) clearInterval(intervalRef.current)
    intervalRef.current = null

    const blob = await recording.stop()
    setRecording(null)
    const buffer = await engine.loadFromBlob(blob)
    useSessionStore.getState().setSource({
      id: newId(),
      blob,
      buffer,
      name: `recording-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.wav`,
      durationSec: buffer.duration,
      sampleRateHz: buffer.sampleRate,
      channels: buffer.numberOfChannels,
    })
    onDone()
    navigate('preview')
  }

  const cancel = async () => {
    if (recording) {
      if (intervalRef.current != null) clearInterval(intervalRef.current)
      intervalRef.current = null
      await recording.stop()
    }
    onDone()
  }

  useEffect(() => () => { if (intervalRef.current != null) clearInterval(intervalRef.current) }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-rmai-bg p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-rmai-mut">recording</span>
        <button onClick={cancel} className="text-sm text-rmai-fg2">cancel</button>
      </div>
      <div className="m-auto flex flex-col items-center gap-6">
        <div className={`h-32 w-32 rounded-full ${recording ? 'bg-rmai-orange animate-pulse' : 'bg-rmai-fg1'}`} />
        <div className="font-mono text-[28px] tabular-nums">
          {elapsed.toFixed(1)}s
        </div>
        {error && <div className="text-sm text-rmai-orange">{error}</div>}
      </div>
      <div className="flex gap-[10px]">
        {!recording ? (
          <PrimaryButton full onClick={start}>start recording</PrimaryButton>
        ) : (
          <GhostButton full onClick={stop}>stop &amp; preview</GhostButton>
        )}
      </div>
    </div>
  )
}
