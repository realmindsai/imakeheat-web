import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore, defaultTrim } from '../../src/store/session'

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it('starts with sensible defaults', () => {
    const s = useSessionStore.getState()
    expect(s.source).toBeNull()
    expect(s.chain.map(x => x.kind)).toEqual(['crusher', 'srhold', 'pitch', 'filter'])
    expect(s.trim).toEqual(defaultTrim)
    expect(s.playback.isPlaying).toBe(false)
    expect(s.render.phase).toBe('idle')
    expect(s.engineReady).toBe(false)
    expect(s.route).toBe('home')
  })

  it('setSource resets chain and trim derived from the source', () => {
    useSessionStore.getState().setSource({
      id: 'a', blob: new Blob(), buffer: { numberOfChannels: 2, sampleRate: 48000, length: 96000, duration: 2 } as any,
      name: 'demo.wav', durationSec: 2, sampleRateHz: 48000, channels: 2,
    })
    const s = useSessionStore.getState()
    const srhold = s.chain.find(x => x.kind === 'srhold')!
    expect((srhold as any).params.sampleRateHz).toBe(48000)
    expect(s.trim).toEqual({ startSec: 0, endSec: 2 })
  })

  it('navigate changes route without disturbing chain', () => {
    const lenBefore = useSessionStore.getState().chain.length
    useSessionStore.getState().navigate('effects')
    expect(useSessionStore.getState().route).toBe('effects')
    expect(useSessionStore.getState().chain.length).toBe(lenBefore)
  })

  it('beginRender / finishRender / failRender transitions', () => {
    const s = useSessionStore.getState()
    s.beginRender()
    expect(useSessionStore.getState().render.phase).toBe('rendering')
    s.finishRender()
    expect(useSessionStore.getState().render.phase).toBe('idle')
    s.failRender('boom')
    const r = useSessionStore.getState().render
    expect(r.phase).toBe('error')
    if (r.phase === 'error') expect(r.message).toBe('boom')
  })

  it('setSource clears a stale failed-render state', () => {
    useSessionStore.getState().failRender('previous error')
    useSessionStore.getState().setSource({
      id: 'b', blob: new Blob(),
      buffer: { numberOfChannels: 1, sampleRate: 44100, length: 44100, duration: 1 } as any,
      name: 'fresh.wav', durationSec: 1, sampleRateHz: 44100, channels: 1,
    })
    expect(useSessionStore.getState().render.phase).toBe('idle')
  })

  it('starts with srManuallyAdjusted=false', () => {
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(false)
  })

  it('setSource resets srManuallyAdjusted to false', () => {
    const srholdId = useSessionStore.getState().chain[1].id
    useSessionStore.getState().setSlotParams(srholdId, { sampleRateHz: 22050 })
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(true)
    useSessionStore.getState().setSource({
      id: 'c', blob: new Blob(),
      buffer: { numberOfChannels: 1, sampleRate: 44100, length: 44100, duration: 1 } as any,
      name: 'fresh.wav', durationSec: 1, sampleRateHz: 44100, channels: 1,
    })
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(false)
  })

  it('resetChain clears srManuallyAdjusted and restores defaults', () => {
    const srholdId = useSessionStore.getState().chain[1].id
    useSessionStore.getState().setSlotParams(srholdId, { sampleRateHz: 18000 })
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(true)
    useSessionStore.getState().resetChain()
    expect(useSessionStore.getState().chain.map(x => x.kind)).toEqual(['crusher', 'srhold', 'pitch', 'filter'])
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(false)
  })
})
