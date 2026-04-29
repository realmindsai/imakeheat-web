import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore, defaultEffects, defaultTrim } from '../../src/store/session'

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it('starts with sensible defaults', () => {
    const s = useSessionStore.getState()
    expect(s.source).toBeNull()
    expect(s.effects).toEqual(defaultEffects)
    expect(s.trim).toEqual(defaultTrim)
    expect(s.playback.isPlaying).toBe(false)
    expect(s.render.phase).toBe('idle')
    expect(s.engineReady).toBe(false)
    expect(s.route).toBe('home')
  })

  it('setEffect updates one field', () => {
    useSessionStore.getState().setEffect({ bitDepth: 4 })
    expect(useSessionStore.getState().effects.bitDepth).toBe(4)
    expect(useSessionStore.getState().effects.pitchSemitones).toBe(0)
  })

  it('setSource resets effects and trim to defaults derived from the source', () => {
    useSessionStore.getState().setEffect({ bitDepth: 4 })
    useSessionStore.getState().setSource({
      id: 'a', blob: new Blob(), buffer: { numberOfChannels: 2, sampleRate: 48000, length: 96000, duration: 2 } as any,
      name: 'demo.wav', durationSec: 2, sampleRateHz: 48000, channels: 2,
    })
    const s = useSessionStore.getState()
    expect(s.effects.bitDepth).toBe(16)
    expect(s.effects.sampleRateHz).toBe(48000)
    expect(s.trim).toEqual({ startSec: 0, endSec: 2 })
  })

  it('navigate changes route without disturbing effects', () => {
    useSessionStore.getState().setEffect({ filterValue: 0.5 })
    useSessionStore.getState().navigate('effects')
    expect(useSessionStore.getState().route).toBe('effects')
    expect(useSessionStore.getState().effects.filterValue).toBe(0.5)
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

  it('setEffect with sampleRateHz sets srManuallyAdjusted=true', () => {
    useSessionStore.getState().setEffect({ sampleRateHz: 22050 })
    expect(useSessionStore.getState().effects.sampleRateHz).toBe(22050)
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(true)
  })

  it('setEffect without sampleRateHz does NOT set srManuallyAdjusted', () => {
    useSessionStore.getState().setEffect({ bitDepth: 12 })
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(false)
  })

  it('nudgeSampleRate sets sampleRateHz without setting srManuallyAdjusted', () => {
    useSessionStore.getState().nudgeSampleRate(26000)
    expect(useSessionStore.getState().effects.sampleRateHz).toBe(26000)
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(false)
  })

  it('setSource resets srManuallyAdjusted to false', () => {
    useSessionStore.getState().setEffect({ sampleRateHz: 22050 })
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(true)
    useSessionStore.getState().setSource({
      id: 'c', blob: new Blob(),
      buffer: { numberOfChannels: 1, sampleRate: 44100, length: 44100, duration: 1 } as any,
      name: 'fresh.wav', durationSec: 1, sampleRateHz: 44100, channels: 1,
    })
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(false)
  })

  it('resetEffects clears srManuallyAdjusted and restores defaults', () => {
    useSessionStore.getState().setEffect({ sampleRateHz: 18000, bitDepth: 12 })
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(true)
    useSessionStore.getState().resetEffects()
    expect(useSessionStore.getState().effects).toEqual(defaultEffects)
    expect(useSessionStore.getState().srManuallyAdjusted).toBe(false)
  })
})
