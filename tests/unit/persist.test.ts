// ABOUTME: Tests for chain persistence to localStorage via Zustand persist middleware.
// ABOUTME: Verifies addSlot and resetChain round-trip through the 'imakeheat-chain' key.

import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../src/store/session'

beforeEach(() => {
  localStorage.clear()
  useSessionStore.getState().reset()
})

describe('chain persistence', () => {
  it('addSlot writes the new chain to localStorage', () => {
    useSessionStore.getState().addSlot('echo')
    const before = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(before)
  })

  it('persisted chain round-trips a 303 VinylSim slot', () => {
    useSessionStore.getState().addSlot('vinyl303')
    const chain = useSessionStore.getState().chain
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain).toEqual(chain)
    expect(persisted.state.chain.at(-1).kind).toBe('vinyl303')
  })

  it('Reset writes the v1 default chain to localStorage', () => {
    useSessionStore.getState().addSlot('echo')
    useSessionStore.getState().resetChain()
    const persisted = JSON.parse(localStorage.getItem('imakeheat-chain') ?? '{}')
    expect(persisted.state.chain.map((s: any) => s.kind)).toEqual(['crusher', 'srhold', 'pitch', 'filter'])
  })
})
