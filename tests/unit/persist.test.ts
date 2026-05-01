// ABOUTME: Tests for chain persistence to localStorage via Zustand persist middleware.
// ABOUTME: Verifies addSlot and resetChain round-trip through the 'imakeheat-chain' key.

import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../src/store/session'

beforeEach(() => {
  localStorage.clear()
  useSessionStore.getState().reset()
})

describe('chain persistence', () => {
  it('addSlot writes Isolator to localStorage with neutral defaults', () => {
    useSessionStore.getState().addSlot('isolator')
    const chain = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(chain)
    expect(persisted.state.chain.at(-1)).toMatchObject({
      kind: 'isolator',
      enabled: true,
      params: { low: 0, mid: 0, high: 0 },
    })
  })

  it('addSlot writes Equalizer to localStorage with flat defaults', () => {
    useSessionStore.getState().addSlot('equalizer')
    const chain = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(chain)
    expect(persisted.state.chain.at(-1)).toMatchObject({
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
  })

  it('addSlot writes Filter+Drive to localStorage with conservative defaults', () => {
    useSessionStore.getState().addSlot('filterDrive')
    const chain = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(chain)
    expect(persisted.state.chain.at(-1)).toMatchObject({
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
  })

  it('addSlot writes Compressor to localStorage with conservative defaults', () => {
    useSessionStore.getState().addSlot('compressor')
    const chain = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(chain)
    expect(persisted.state.chain.at(-1)).toMatchObject({
      kind: 'compressor',
      enabled: true,
      params: { sustain: 0, attack: 50, ratio: 0, level: 100 },
    })
  })

  it('addSlot writes Lo-fi to localStorage with dry-bypass defaults', () => {
    useSessionStore.getState().addSlot('loFi')
    const chain = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(chain)
    expect(persisted.state.chain.at(-1)).toMatchObject({
      kind: 'loFi',
      enabled: true,
      params: {
        preFilt: 1,
        lofiType: 1,
        tone: 0,
        cutoffHz: 8000,
        balance: 0,
        level: 100,
      },
    })
  })

  it('persisted chain round-trips a 303 VinylSim slot', () => {
    useSessionStore.getState().addSlot('vinyl303')
    const chain = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(chain)
    expect(persisted.state.chain.at(-1).kind).toBe('vinyl303')
  })

  it('persisted chain round-trips a Cassette Sim slot', () => {
    useSessionStore.getState().addSlot('cassette')
    const chain = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(chain)
    expect(persisted.state.chain.at(-1)).toMatchObject({
      kind: 'cassette',
      params: { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 },
    })
  })

  it('Reset writes the v1 default chain to localStorage', () => {
    useSessionStore.getState().addSlot('echo')
    useSessionStore.getState().resetChain()
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain.map((s: any) => s.kind)).toEqual(['crusher', 'srhold', 'pitch', 'filter'])
  })
})
