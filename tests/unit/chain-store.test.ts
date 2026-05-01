// ABOUTME: Tests for chain mutators on the session store — addSlot, removeSlot, reorder, toggle.
// ABOUTME: Default chain shape, cross-slot 12-bit nudge logic, id regeneration on setChain.

import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../src/store/session'

beforeEach(() => useSessionStore.getState().reset())

describe('chain store', () => {
  it('default chain has the four legacy slots in v1 order, all enabled, all neutral', () => {
    const c = useSessionStore.getState().chain
    expect(c.map(s => s.kind)).toEqual(['crusher', 'srhold', 'pitch', 'filter'])
    expect(c.every(s => s.enabled)).toBe(true)
  })
  it('addSlot appends Isolator with neutral defaults and a fresh id', () => {
    const before = useSessionStore.getState().chain.length
    useSessionStore.getState().addSlot('isolator')
    const c = useSessionStore.getState().chain
    expect(c.length).toBe(before + 1)
    expect(c[c.length - 1]).toMatchObject({
      kind: 'isolator',
      enabled: true,
      params: { low: 0, mid: 0, high: 0 },
    })
    expect(c[c.length - 1].id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('addSlot appends Equalizer with flat defaults and a fresh id', () => {
    const before = useSessionStore.getState().chain.length
    useSessionStore.getState().addSlot('equalizer')
    const c = useSessionStore.getState().chain
    expect(c.length).toBe(before + 1)
    expect(c[c.length - 1]).toMatchObject({
      kind: 'equalizer',
      enabled: true,
      params: {
        lowGain: 0,
        midGain: 0,
        highGain: 0,
        lowFreq: 80,
        midFreq: 1000,
        highFreq: 8000,
      },
    })
    expect(c[c.length - 1].id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('addSlot appends Filter+Drive with conservative defaults and a fresh id', () => {
    const before = useSessionStore.getState().chain.length
    useSessionStore.getState().addSlot('filterDrive')
    const c = useSessionStore.getState().chain
    expect(c.length).toBe(before + 1)
    expect(c[c.length - 1]).toMatchObject({
      kind: 'filterDrive',
      enabled: true,
      params: {
        cutoffHz: 16000,
        resonance: 0,
        drive: 0,
        filterType: 'lowpass',
        lowFreq: 200,
        lowGain: 0,
      },
    })
    expect(c[c.length - 1].id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('addSlot appends 303 VinylSim with neutral defaults and a fresh id', () => {
    const before = useSessionStore.getState().chain.length
    useSessionStore.getState().addSlot('vinyl303')
    const c = useSessionStore.getState().chain
    expect(c.length).toBe(before + 1)
    expect(c[c.length - 1]).toMatchObject({
      kind: 'vinyl303',
      enabled: true,
      params: { comp: 0, noise: 0, wowFlutter: 0, level: 100 },
    })
    expect(c[c.length - 1].id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('addSlot appends Cassette Sim with neutral defaults and a fresh id', () => {
    const before = useSessionStore.getState().chain.length
    useSessionStore.getState().addSlot('cassette')
    const c = useSessionStore.getState().chain
    expect(c.length).toBe(before + 1)
    expect(c[c.length - 1]).toMatchObject({
      kind: 'cassette',
      enabled: true,
      params: { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 },
    })
    expect(c[c.length - 1].id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('removeSlot removes by id', () => {
    const id = useSessionStore.getState().chain[0].id
    useSessionStore.getState().removeSlot(id)
    expect(useSessionStore.getState().chain.find(s => s.id === id)).toBeUndefined()
  })
  it('reorderSlot moves a slot to a new index', () => {
    const ids = useSessionStore.getState().chain.map(s => s.id)
    useSessionStore.getState().reorderSlot(ids[3], 0)
    expect(useSessionStore.getState().chain[0].id).toBe(ids[3])
  })
  it('toggleEnabled flips the enabled flag', () => {
    const id = useSessionStore.getState().chain[0].id
    useSessionStore.getState().toggleEnabled(id)
    expect(useSessionStore.getState().chain.find(s => s.id === id)!.enabled).toBe(false)
  })
  it('setSlotParams patches params for the matching slot', () => {
    const id = useSessionStore.getState().chain[0].id
    useSessionStore.getState().setSlotParams(id, { bitDepth: 8 })
    const slot = useSessionStore.getState().chain.find(s => s.id === id)!
    expect((slot as any).params.bitDepth).toBe(8)
  })
  it('selecting bitDepth=12 nudges srhold to 24000 on first time', () => {
    const crusherId = useSessionStore.getState().chain[0].id
    useSessionStore.getState().setSlotParams(crusherId, { bitDepth: 12 })
    const srhold = useSessionStore.getState().chain[1]
    expect((srhold as any).params.sampleRateHz).toBe(24000)
  })
  it('manual srhold adjustment disables future nudges', () => {
    const srholdId = useSessionStore.getState().chain[1].id
    useSessionStore.getState().setSlotParams(srholdId, { sampleRateHz: 32000 })
    const crusherId = useSessionStore.getState().chain[0].id
    useSessionStore.getState().setSlotParams(crusherId, { bitDepth: 12 })
    const srhold = useSessionStore.getState().chain[1]
    expect((srhold as any).params.sampleRateHz).toBe(32000)
  })
  it('setChain regenerates slot ids', () => {
    const stored = [{ id: 'frozen-id', kind: 'echo' as const, enabled: true,
      params: { timeMs: 250, feedback: 0.4, mix: 0.5 } }]
    useSessionStore.getState().setChain(stored as any)
    expect(useSessionStore.getState().chain[0].id).not.toBe('frozen-id')
    expect(useSessionStore.getState().chain[0].id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
