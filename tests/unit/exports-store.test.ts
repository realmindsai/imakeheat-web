import { describe, it, expect, beforeEach } from 'vitest'
import {
  putExport,
  listExports,
  deleteExport,
  toggleStarred,
  countExports,
  __resetForTests,
  type ExportRecord,
} from '../../src/store/exports'
import { defaultTrim } from '../../src/store/session'
import type { LegacyEffectParamsSnapshot } from '../../src/store/exports'
import type { Chain } from '../../src/audio/effects/types'

// Legacy EffectParams baseline used by these back-compat tests. The live store
// no longer surfaces this shape (Task 2.2 replaced it with Chain), but
// IndexedDB records written by older versions still carry it, so the
// normalize-on-read path must keep working.
const legacyEffects: LegacyEffectParamsSnapshot = {
  bitDepth: 16,
  sampleRateHz: 44100,
  pitchSemitones: 0,
  speed: 1,
  filterValue: 0,
}

function fakeRecord(overrides: Partial<ExportRecord> = {}): ExportRecord {
  return {
    id: overrides.id ?? `id-${Math.random()}`,
    createdAt: overrides.createdAt ?? Date.now(),
    name: overrides.name ?? 'test.wav',
    sourceName: 'src.wav',
    blob: new Blob(['x'], { type: 'audio/wav' }),
    durationSec: 1.5,
    sizeBytes: 1,
    channels: 2,
    sampleRateHz: 48000,
    kind: 'WAV',
    starred: false,
    fxSnapshot: legacyEffects,
    trimSnapshot: defaultTrim,
    ...overrides,
  }
}

describe('exports store', () => {
  beforeEach(async () => {
    await __resetForTests()
  })

  it('round-trips a record', async () => {
    const rec = fakeRecord({ id: 'a', name: 'a.wav' })
    await putExport(rec)
    const all = await listExports()
    expect(all.length).toBe(1)
    expect(all[0].name).toBe('a.wav')
  })

  it('lists newest first', async () => {
    await putExport(fakeRecord({ id: 'old', createdAt: 100 }))
    await putExport(fakeRecord({ id: 'new', createdAt: 200 }))
    const all = await listExports()
    expect(all.map((r) => r.id)).toEqual(['new', 'old'])
  })

  it('counts records', async () => {
    await putExport(fakeRecord({ id: '1' }))
    await putExport(fakeRecord({ id: '2' }))
    expect(await countExports()).toBe(2)
  })

  it('toggleStarred flips and persists', async () => {
    await putExport(fakeRecord({ id: 's', starred: false }))
    await toggleStarred('s')
    expect((await listExports())[0].starred).toBe(true)
    await toggleStarred('s')
    expect((await listExports())[0].starred).toBe(false)
  })

  it('deleteExport removes a record', async () => {
    await putExport(fakeRecord({ id: 'x' }))
    await deleteExport('x')
    expect(await countExports()).toBe(0)
  })

  it('normalize fills speed=1 on records written without it', async () => {
    // Simulate a pre-migration record by stripping speed.
    const legacyFx = { ...legacyEffects } as Partial<typeof legacyEffects>
    delete legacyFx.speed
    const rec = fakeRecord({
      id: 'legacy',
      fxSnapshot: legacyFx as typeof legacyEffects,
    })
    await putExport(rec)
    const all = await listExports()
    expect(all[0].fxSnapshot?.speed).toBe(1)
  })

  it('normalize preserves speed when present', async () => {
    const rec = fakeRecord({
      id: 'modern',
      fxSnapshot: { ...legacyEffects, speed: 1.5 },
    })
    await putExport(rec)
    const all = await listExports()
    expect(all[0].fxSnapshot?.speed).toBe(1.5)
  })

  it('toggleStarred writes back the speed field on legacy records', async () => {
    const legacyFx = { ...legacyEffects } as Partial<typeof legacyEffects>
    delete legacyFx.speed
    await putExport(fakeRecord({
      id: 'legacy-star',
      starred: false,
      fxSnapshot: legacyFx as typeof legacyEffects,
    }))
    await toggleStarred('legacy-star')
    const all = await listExports()
    expect(all[0].starred).toBe(true)
    expect(all[0].fxSnapshot?.speed).toBe(1)
    // Toggle again to confirm the persisted record is now well-formed.
    await toggleStarred('legacy-star')
    const after = await listExports()
    expect(after[0].fxSnapshot?.speed).toBe(1)
  })

  it('round-trips chainConfig through IndexedDB', async () => {
    const chain: Chain = [
      { id: 'a', kind: 'crusher', enabled: true, params: { bitDepth: 4 } },
      {
        id: 'b',
        kind: 'echo',
        enabled: true,
        params: { timeMs: 250, feedback: 0.4, mix: 0.5 },
      },
    ]
    await putExport(
      fakeRecord({
        id: 'cc',
        // fxSnapshot intentionally omitted — new records carry chainConfig.
        fxSnapshot: undefined,
        chainConfig: structuredClone(chain),
      }),
    )
    const all = await listExports()
    expect(all[0].chainConfig).toEqual(chain)
  })

  it('reads old records without chainConfig as undefined', async () => {
    // Insert a record bypassing chainConfig (simulating a pre-Task-5.3 record
    // that only carries fxSnapshot). Round-trip and confirm chainConfig stays
    // undefined rather than being synthesised by normalize().
    await putExport(fakeRecord({ id: 'old', fxSnapshot: legacyEffects }))
    const all = await listExports()
    expect(all[0].chainConfig).toBeUndefined()
    expect(all[0].fxSnapshot).toEqual(legacyEffects)
  })

  it('persists chainConfig as a deep clone (mutating the source after put does not affect the stored snapshot)', async () => {
    const chain: Chain = [
      { id: 'a', kind: 'crusher', enabled: true, params: { bitDepth: 8 } },
    ]
    const snapshot = structuredClone(chain)
    await putExport(
      fakeRecord({ id: 'clone', fxSnapshot: undefined, chainConfig: snapshot }),
    )
    // Mutate the original chain and the snapshot reference; persisted record
    // must remain unchanged because IndexedDB structured-clones on write.
    chain[0].enabled = false
    snapshot[0].enabled = false
    const all = await listExports()
    expect(all[0].chainConfig?.[0].enabled).toBe(true)
  })

})
