// ABOUTME: IndexedDB-backed export archive using idb — stores ExportRecord entries with a createdAt index.
// ABOUTME: Exposes CRUD helpers, a change-event bus, and __resetForTests for vitest + fake-indexeddb.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { TrimPoints } from '../audio/types'
import type { Chain } from '../audio/effects/types'

// Legacy EffectParams shape — kept locally because IndexedDB records written
// by pre-pedalboard versions still carry it. New records (post-pedalboard
// migration) won't write this — Task 5.3 lands a `chainConfig` field that
// captures the slot-based chain instead. Defined inline here rather than
// re-exported, so this is the only module that retains the legacy shape.
export interface LegacyEffectParamsSnapshot {
  bitDepth: 2 | 4 | 8 | 12 | 16
  sampleRateHz: number
  pitchSemitones: number
  speed: number
  filterValue: number
}

export interface ExportRecord {
  id: string
  createdAt: number
  name: string
  sourceName: string
  blob: Blob
  durationSec: number
  sizeBytes: number
  channels: number
  sampleRateHz: number
  kind: 'WAV'
  starred: boolean
  // fxSnapshot is the legacy EffectParams snapshot. Kept optional so older
  // records still round-trip cleanly through normalize().
  fxSnapshot?: LegacyEffectParamsSnapshot
  // chainConfig captures the slot-based effect chain at render time. Optional
  // so records written by pre-pedalboard versions (which carry fxSnapshot
  // instead) keep reading cleanly. New records written post-Task 5.3 always
  // carry a deep-cloned snapshot here.
  chainConfig?: Chain
  trimSnapshot: TrimPoints
}

interface ImaKeHeatDB extends DBSchema {
  exports: {
    key: string
    value: ExportRecord
    indexes: { by_createdAt: number }
  }
}

const DB_NAME = 'imakeheat'
const DB_VERSION = 1

const listeners = new Set<() => void>()

export function onExportsChanged(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function notify(): void {
  for (const cb of listeners) cb()
}

let dbPromise: Promise<IDBPDatabase<ImaKeHeatDB>> | null = null

export function initExportsDb(): Promise<IDBPDatabase<ImaKeHeatDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ImaKeHeatDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('exports', { keyPath: 'id' })
        store.createIndex('by_createdAt', 'createdAt')
      },
    })
  }
  return dbPromise
}

function normalize(rec: ExportRecord): ExportRecord {
  if (!rec.fxSnapshot) return rec
  if (rec.fxSnapshot.speed !== undefined) return rec
  // Records written before the speed field existed: backfill speed=1.
  // Guard above ensures we only reach here when speed is genuinely absent.
  return { ...rec, fxSnapshot: { ...rec.fxSnapshot, speed: 1 } }
}

export async function putExport(rec: ExportRecord): Promise<void> {
  const db = await initExportsDb()
  await db.put('exports', rec)
  notify()
}

export async function listExports(): Promise<ExportRecord[]> {
  const db = await initExportsDb()
  const all = await db.getAllFromIndex('exports', 'by_createdAt')
  return all.reverse().map(normalize)
}

export async function countExports(): Promise<number> {
  const db = await initExportsDb()
  return db.count('exports')
}

export async function deleteExport(id: string): Promise<void> {
  const db = await initExportsDb()
  await db.delete('exports', id)
  notify()
}

export async function toggleStarred(id: string): Promise<void> {
  const db = await initExportsDb()
  const tx = db.transaction('exports', 'readwrite')
  const rec = await tx.store.get(id)
  if (rec) {
    const normalised = normalize(rec)
    await tx.store.put({ ...normalised, starred: !normalised.starred })
  }
  await tx.done
  notify()
}

export async function totalSizeBytes(): Promise<number> {
  const all = await listExports()
  return all.reduce((s, r) => s + r.sizeBytes, 0)
}

export async function __resetForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
