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
})
