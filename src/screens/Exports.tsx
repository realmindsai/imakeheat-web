// ABOUTME: Exports screen — browse, play, share, star, and delete rendered audio exports.
// ABOUTME: Reads from IndexedDB via useExports hook; long-press a row to open the action menu.

import { useState, useRef, useEffect } from 'react'
import { TopBar } from '../components/TopBar'
import { Eyebrow } from '../components/Eyebrow'
import { Icon } from '../components/icons'
import { Waveform } from '../components/Waveform'
import { useExports } from '../store/hooks'
import { deleteExport, toggleStarred, type ExportRecord } from '../store/exports'
import { sharePlanWavBlob } from '../lib/share'
import { relativeTime } from '../lib/time'
import { navigate } from '../lib/router'
import { engine } from '../audio/engine'
import { useSessionStore } from '../store/session'

type Filter = 'all' | 'wav' | 'starred'

export function Exports() {
  const items = useExports()
  const [filter, setFilter] = useState<Filter>('all')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastUrl = useRef<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Stop the live preview loop on entry — the user is now thinking about saved
  // files, not the working source. Per-row playback below uses an HTMLAudioElement.
  useEffect(() => {
    engine.pause()
    useSessionStore.getState().setPlayback({ isPlaying: false })
  }, [])

  const filtered = items.filter((r) => {
    if (filter === 'wav') return r.kind === 'WAV'
    if (filter === 'starred') return r.starred
    return true
  })

  const totalMB = items.reduce((s, r) => s + r.sizeBytes, 0) / (1024 * 1024)

  const playOne = (rec: ExportRecord) => {
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current)
    const url = URL.createObjectURL(rec.blob)
    lastUrl.current = url
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    a.src = url
    a.onended = () => {
      setPlayingId(null)
      if (lastUrl.current) {
        URL.revokeObjectURL(lastUrl.current)
        lastUrl.current = null
      }
    }
    void a.play()
    setPlayingId(rec.id)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col">
      <TopBar
        left={
          <button onClick={() => navigate('home')} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-rmai-border bg-white">
            {Icon.back(16)}
          </button>
        }
        right={
          <span className="font-mono text-[11px] text-rmai-mut">
            {items.length} files · {totalMB.toFixed(1)} MB
          </span>
        }
      />
      <div className="px-[22px] pt-[22px]">
        <Eyebrow>—— archive</Eyebrow>
        <h2 className="mt-2 text-[26px] font-bold tracking-tight leading-tight">my exports</h2>
        <p className="mt-[6px] text-[12.5px] text-rmai-mut">rendered on-device — never uploaded.</p>
      </div>
      <div className="flex gap-[6px] px-[22px] pt-[14px]">
        {(['all', 'wav', 'starred'] as Filter[]).map((f) => {
          const n = f === 'all' ? items.length : f === 'wav' ? items.filter((r) => r.kind === 'WAV').length : items.filter((r) => r.starred).length
          const on = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex items-center gap-[6px] rounded-full px-[11px] py-[6px] text-[11.5px] font-semibold
                ${on ? 'border border-rmai-fg1 bg-rmai-fg1 text-white' : 'border border-rmai-border bg-white text-rmai-fg1'}`}
            >
              <span>{f}</span>
              <span className={`font-mono text-[10px] ${on ? 'opacity-70' : 'opacity-50'}`}>{n}</span>
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-auto px-[22px] pt-3">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[13px] text-rmai-mut">
            no exports yet — render something on the effects screen.
          </div>
        )}
        {filtered.map((rec) => (
          <ExportRow key={rec.id} rec={rec} playing={playingId === rec.id}
            onPlay={() => playOne(rec)}
            onShare={() => { void sharePlanWavBlob(rec.blob, rec.name) }}
            onDelete={() => { void deleteExport(rec.id) }}
            onStar={() => { void toggleStarred(rec.id) }}
            onRestore={rec.chainConfig ? () => {
              // Restore is chain-only — rec.blob is left alone so the user's
              // current source stays loaded. setChain regenerates slot ids.
              useSessionStore.getState().setChain(rec.chainConfig!)
              engine.rebuildChain(useSessionStore.getState().chain)
              navigate('effects')
            } : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function ExportRow({
  rec, playing, onPlay, onShare, onDelete, onStar, onRestore,
}: {
  rec: ExportRecord
  playing: boolean
  onPlay: () => void
  onShare: () => void
  onDelete: () => void
  onStar: () => void
  onRestore?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressTimer = useRef<number | null>(null)

  const onPointerDown = () => {
    longPressTimer.current = window.setTimeout(() => setMenuOpen(true), 500)
  }
  const onPointerUp = () => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  return (
    <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      className="relative flex items-center gap-3 border-b border-rmai-border px-1 py-3">
      <div className={`flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[10px] px-[6px] ${rec.starred ? 'bg-rmai-lavender' : 'bg-rmai-stone'}`}>
        <Waveform height={22} bars={10} dim={!rec.starred} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[13px] font-semibold tracking-tight">
          {rec.name}
        </div>
        <div className="mt-[3px] flex items-center gap-2 text-[11px] text-rmai-mut">
          <span className={`rounded px-[5px] py-[1px] text-[9px] font-bold tracking-wider ${rec.starred ? 'bg-rmai-purple text-white' : 'bg-rmai-border text-rmai-fg2'}`}>
            {rec.kind}
          </span>
          <span>{Math.floor(rec.durationSec / 60)}:{String(Math.floor(rec.durationSec % 60)).padStart(2, '0')}</span>
          <span>·</span>
          <span>{(rec.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
          <span>·</span>
          <span>{relativeTime(rec.createdAt)}</span>
        </div>
      </div>
      <button onClick={onPlay}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-rmai-border bg-white">
        {playing ? Icon.pause(13) : Icon.play(13)}
      </button>
      {onRestore && (
        <button
          onClick={onRestore}
          className="rounded-full border border-rmai-border bg-white px-[10px] py-[6px] font-mono text-[11px] font-semibold text-rmai-fg1"
        >
          Restore
        </button>
      )}
      <button onClick={onShare} className="flex h-8 w-8 items-center justify-center rounded-full text-rmai-mut">
        {Icon.share(14)}
      </button>
      {menuOpen && (
        <div className="absolute right-2 top-full z-30 mt-1 rounded-lg border border-rmai-border bg-white shadow">
          <button onClick={() => { onStar(); setMenuOpen(false) }} className="block w-full px-4 py-2 text-left text-[13px]">
            {rec.starred ? 'unstar' : 'star'}
          </button>
          <button onClick={() => { onDelete(); setMenuOpen(false) }} className="block w-full px-4 py-2 text-left text-[13px] text-rmai-orange">
            delete
          </button>
        </div>
      )}
    </div>
  )
}
