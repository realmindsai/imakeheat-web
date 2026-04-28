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
import { defaultEffects, defaultTrim } from '../../src/store/session'

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
    fxSnapshot: defaultEffects,
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
    const legacyFx = { ...defaultEffects } as Partial<typeof defaultEffects>
    delete legacyFx.speed
    const rec = fakeRecord({
      id: 'legacy',
      fxSnapshot: legacyFx as typeof defaultEffects,
    })
    await putExport(rec)
    const all = await listExports()
    expect(all[0].fxSnapshot.speed).toBe(1)
  })

  it('normalize preserves speed when present', async () => {
    const rec = fakeRecord({
      id: 'modern',
      fxSnapshot: { ...defaultEffects, speed: 1.5 },
    })
    await putExport(rec)
    const all = await listExports()
    expect(all[0].fxSnapshot.speed).toBe(1.5)
  })

  it('toggleStarred writes back the speed field on legacy records', async () => {
    const legacyFx = { ...defaultEffects } as Partial<typeof defaultEffects>
    delete legacyFx.speed
    await putExport(fakeRecord({
      id: 'legacy-star',
      starred: false,
      fxSnapshot: legacyFx as typeof defaultEffects,
    }))
    await toggleStarred('legacy-star')
    const all = await listExports()
    expect(all[0].starred).toBe(true)
    expect(all[0].fxSnapshot.speed).toBe(1)
    // Toggle again to confirm the persisted record is now well-formed.
    await toggleStarred('legacy-star')
    const after = await listExports()
    expect(after[0].fxSnapshot.speed).toBe(1)
  })
})
