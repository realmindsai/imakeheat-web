// ABOUTME: Home screen — entry point for the app. Upload or record to create a source.
// ABOUTME: Boots the AudioEngine on first user gesture and navigates to Preview on source ready.

import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Wordmark } from '../components/Wordmark'
import { Eyebrow } from '../components/Eyebrow'
import { StatusDot } from '../components/StatusDot'
import { Motif } from '../components/Motif'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/icons'
import { engine } from '../audio/engine'
import { useSessionStore } from '../store/session'
import { useExportsCount } from '../store/hooks'
import { newId } from '../lib/ids'
import { navigate } from '../lib/router'
import { RecordOverlay } from './RecordOverlay'

export function Home() {
  const [showRecord, setShowRecord] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const engineReady = useSessionStore((s) => s.engineReady)
  const exportsCount = useExportsCount()

  const ensureEngine = async () => {
    await engine.ensureStarted()
    useSessionStore.getState().setEngineReady(true)
  }

  const onUpload = async (file: File) => {
    await ensureEngine()
    const buffer = await engine.loadFromBlob(file)
    useSessionStore.getState().setSource({
      id: newId(),
      blob: file,
      buffer,
      name: file.name,
      durationSec: buffer.duration,
      sampleRateHz: buffer.sampleRate,
      channels: buffer.numberOfChannels,
    })
    navigate('preview')
  }

  const onRecordOpen = async () => {
    await ensureEngine()
    setShowRecord(true)
  }

  const sr = engine.context?.sampleRate
  const srLabel = sr ? `${Math.round(sr / 1000)} kHz` : '—'

  return (
    <div className="relative mx-auto flex min-h-screen max-w-[420px] flex-col">
      <Motif size={220} className="-right-10 top-9" opacity={0.7} />
      <TopBar
        left={<Wordmark />}
        right={
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-rmai-border text-rmai-fg1">
            {Icon.menu(16)}
          </button>
        }
      />
      <div className="px-[22px] pt-9">
        <Eyebrow>—— heat, on demand</Eyebrow>
        <h1 className="mt-3 text-[34px] font-bold leading-[1.05] tracking-tight">
          crush, melt,<br />
          <span className="text-rmai-purple">retape</span> any sound.
        </h1>
        <p className="mt-3 max-w-[280px] text-[13.5px] leading-[1.5] text-rmai-fg2">
          a pocket bitcrusher with grain, pitch and lo-fi textures.
          import or record — render it warm.
        </p>
      </div>
      <div className="mx-[22px] mt-[22px] flex items-center gap-[10px] rounded-full border border-rmai-border bg-white px-[14px] py-[10px] text-[11.5px] text-rmai-fg2">
        <StatusDot />
        <span className="font-mono font-medium text-rmai-fg1">
          {engineReady ? 'engine ready' : 'engine idle'}
        </span>
        <span className="text-rmai-mut">·</span>
        <span className="font-mono text-rmai-mut">{srLabel} · 16-bit · offline</span>
      </div>
      <div className="px-[22px] pt-6">
        <Eyebrow className="!text-rmai-mut">start a source</Eyebrow>
        <div className="mt-3 flex flex-col gap-[10px]">
          <SourceRow primary icon={Icon.mic(20)} title="record audio" sub="tap to capture from microphone" shortcut="01" onClick={onRecordOpen} />
          <SourceRow icon={Icon.upload(20)} title="upload a file" sub=".wav · .mp3" shortcut="02" onClick={() => fileInput.current?.click()} />
        </div>
        <input ref={fileInput} type="file" accept=".wav,.mp3,audio/*" hidden
          onChange={(e) => { void (e.target.files?.[0] && onUpload(e.target.files[0])) }} />
      </div>
      <div className="mt-auto px-[22px] pb-[18px]">
        <button onClick={() => navigate('exports')} className="flex w-full items-center justify-between bg-transparent px-1 py-3">
          <span className="flex items-center gap-[10px]">
            <span className="text-rmai-purple">{Icon.folder(18)}</span>
            <span className="text-[14px] font-semibold">my exports</span>
            <span className="rounded-full bg-rmai-lavender px-[7px] py-[2px] text-[10px] font-bold tracking-wider text-rmai-purple">
              {exportsCount}
            </span>
          </span>
          {Icon.arrow(16)}
        </button>
      </div>
      {showRecord && <RecordOverlay onDone={() => setShowRecord(false)} />}
    </div>
  )
}

function SourceRow({
  icon, title, sub, shortcut, primary = false, onClick,
}: { icon: ReactNode; title: string; sub: string; shortcut: string; primary?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-[14px] rounded-[12px] py-[14px] pl-4 pr-[14px] text-left
        ${primary ? 'bg-rmai-fg1 border border-rmai-fg1' : 'bg-white border border-rmai-border'}`}
    >
      <div className={`flex h-[42px] w-[42px] items-center justify-center rounded-[10px]
        ${primary ? 'bg-[#2a2b35] text-rmai-orange' : 'bg-rmai-lavender text-rmai-fg1'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[14.5px] font-semibold tracking-tight ${primary ? 'text-white' : 'text-rmai-fg1'}`}>
          {title}
        </div>
        <div className={`mt-[2px] text-[12px] ${primary ? 'text-[#bdbec6]' : 'text-rmai-mut'}`}>
          {sub}
        </div>
      </div>
      <div className={`font-mono text-[10px] tracking-wider ${primary ? 'text-[#7d7e88]' : 'text-rmai-mut'}`}>
        {shortcut}
      </div>
    </button>
  )
}
