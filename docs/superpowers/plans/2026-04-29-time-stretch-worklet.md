# Time-Stretch Worklet Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `playbackRate`-coupled pitch path with a hand-rolled WSOLA AudioWorklet so speed and pitch become independent parameters; existing behaviour is preserved byte-identically when both are at neutral.

**Architecture:** A new `WSOLAPlayer` AudioWorkletNode owns the AudioBuffer (transferred once via `port.postMessage`), the read pointer, loop/trim points, and emits at the audio clock with chosen speed and pitch. `AudioBufferSourceNode` is removed at runtime. `EffectParams` gains `speed: number` (0.5..2.0). Bypass-at-neutral check (`speed === 1 && pitchSemitones === 0`) keeps the audio path sample-identical to today for users who never touch the new slider.

**Tech Stack:** TypeScript strict, Web Audio API + AudioWorklet, Vite (`?worker&url` for worklet bundling), Vitest + jsdom for unit tests, Playwright with real `OfflineAudioContext` for integration, Playwright on the dev server for e2e.

**Reference spec:** `docs/superpowers/specs/2026-04-29-time-stretch-worklet-design.md`

---

## Conventions and discoveries (read before starting)

- **Worklet unit test pattern.** `tests/helpers/worklet.ts` exposes `runProcessor(proc, input, blockSize)` and `postToProcessor(proc, data)`. The existing `bitcrusher.test.ts` and `srhold.test.ts` instantiate the processor class directly from Node, posting params via `port.onmessage`. The WSOLA worklet differs from these in one key respect: it does not consume audio inputs — it owns the source buffer internally. Tests will pass an empty inputs array `[[]]` to `process()` and read outputs.
- **`processor-shim.ts`** at `src/audio/worklets/processor-shim.ts` provides Node-side stand-ins for `AudioWorkletProcessor`, `registerProcessor`, and a stub `port` with `onmessage`/`postMessage`. Import it once at the top of any worklet source file (the existing pattern). Tests import `processor-shim` once at the top of the test file.
- **`?worker&url`** is how Vite bundles worklet sources — see `src/audio/graph.ts:8-9`. Mirror that for the new file.
- **ABOUTME headers.** Every new file under `src/` must start with two `// ABOUTME:` comment lines describing the module — match the existing pattern (e.g., `src/audio/engine.ts:1-2`).
- **Spec inaccuracy to ignore.** The spec §3 mentions updating `RenderModal.tsx` for a duration display. Inspection of `src/components/RenderModal.tsx` shows it does not currently display duration. The only place that currently uses `pitchRate` to compute render duration is `src/audio/engine.ts:146-147`. **Skip the RenderModal change**; updating only `engine.ts:146-147` (Task 12, Step 9) is correct and complete.
- **Single PR, no feature flag.** Tasks are sequenced so each commit type-checks and runs (with one explicit two-task pairing in Chunk 3 where the build is broken across the boundary — the plan calls this out).
- **TDD throughout.** Every task that adds behaviour starts with a failing test, then a minimal implementation, then a passing test, then commit.
- **Commit messages.** Conventional commits, lowercase, present-tense imperative; match the existing log (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`). One commit per task unless explicitly noted.

---

## File map

| File | Action | Notes |
|---|---|---|
| `src/audio/types.ts` | modify | add `speed: number` |
| `src/audio/speed.ts` | create | `sliderToSpeed`/`speedToSlider`, ~10 lines, mirrors `pitch.ts` |
| `src/audio/pitch.ts` | unchanged | consumer moves to inside the worklet |
| `src/audio/worklets/wsola.worklet.ts` | create | ~250 lines, the DSP |
| `src/audio/graph.ts` | modify | register `wsola`; replace `setSource`/`applyPitch` with `loadBuffer`; rebuild offline path |
| `src/audio/engine.ts` | modify | `currentSource` → `player`; source-time position math; port-message API |
| `src/store/session.ts` | modify | `defaultEffects.speed = 1` |
| `src/store/exports.ts` | modify | `normalize()` in `listExports`; opportunistic write-back via `toggleStarred` |
| `src/screens/EffectsRack.tsx` | modify | fifth slider |
| `src/dev/components-gallery.tsx` | modify | frozen "speed" example |
| `tests/unit/speed.test.ts` | create | 3 cases |
| `tests/unit/wsola.test.ts` | create | 8 cases (built up across Chunk 2) |
| `tests/unit/exports-store.test.ts` | modify | normalize + toggleStarred-writeback cases |
| `tests/integration/runner.ts` | modify | accept `speed`; add `kind: 'render-legacy'` |
| `tests/integration/index.html` | unchanged | served by Vite at `/tests/integration/index.html` |
| `tests/integration/filter-attenuation.spec.ts` | modify | pass `speed: 1` in `EffectParams` literals |
| `tests/integration/stereo-symmetry.spec.ts` | modify | pass `speed: 1` in `EffectParams` literals |
| `tests/integration/wsola-stretch.spec.ts` | create | 5 cases |
| `tests/e2e/speed-slider.spec.ts` | create | 2 cases |

---

## Chunk 1: Types, helpers, store

After this chunk: `EffectParams` has `speed`; UI is unchanged; audio behaviour is unchanged; all existing tests still pass; the IDB store gracefully reads pre-existing records.

### Task 1: Add `speed` to `EffectParams` and propagate

**Files:**
- Modify: `src/audio/types.ts`
- Modify: `src/store/session.ts:30-35`
- Modify: `tests/integration/filter-attenuation.spec.ts`
- Modify: `tests/integration/stereo-symmetry.spec.ts`

- [ ] **Step 1: Extend `EffectParams`**

In `src/audio/types.ts`, change the interface:

```ts
export interface EffectParams {
  bitDepth: 2 | 4 | 8 | 12 | 16
  sampleRateHz: number      // perceptual; 4000–48000
  pitchSemitones: number    // -12..+12, decoupled from speed
  speed: number             // 0.5..2.0, log-mapped on UI
  filterValue: number       // -1..+1
}
```

- [ ] **Step 2: Update `defaultEffects`**

In `src/store/session.ts:30-35`, update:

```ts
export const defaultEffects: EffectParams = {
  bitDepth: 16,
  sampleRateHz: 44100,
  pitchSemitones: 0,
  speed: 1,
  filterValue: 0,
}
```

- [ ] **Step 3: Update existing integration test literals**

In `tests/integration/filter-attenuation.spec.ts`, every `EffectParams` literal currently looks like:
```ts
effects: { bitDepth: 16, sampleRateHz: sr, pitchSemitones: 0, filterValue: -1 },
```
Add `speed: 1` to all three literals (lines 18, 43, 68 currently).

In `tests/integration/stereo-symmetry.spec.ts`, the single literal is at line 17:
```ts
effects: { bitDepth: 4, sampleRateHz: 12000, pitchSemitones: -3, filterValue: -0.5 },
```
Add `speed: 1`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. (If anything else fails, search `EffectParams` literals across the repo with `grep -rn "bitDepth.*sampleRateHz.*pitchSemitones" src tests` and add `speed: 1` to each.)

- [ ] **Step 5: Run unit tests**

Run: `npm test`
Expected: all existing tests PASS. (We've only added an optional-shaped field; no behaviour changes.)

- [ ] **Step 6: Commit**

```bash
git add src/audio/types.ts src/store/session.ts tests/integration/filter-attenuation.spec.ts tests/integration/stereo-symmetry.spec.ts
git commit -m "feat: add speed field to EffectParams (default 1.0)"
```

---

### Task 2: `src/audio/speed.ts` log-mapped slider helpers (TDD)

**Files:**
- Create: `tests/unit/speed.test.ts`
- Create: `src/audio/speed.ts`

- [ ] **Step 1: Write failing tests first**

Create `tests/unit/speed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sliderToSpeed, speedToSlider } from '../../src/audio/speed'

describe('speed mapping', () => {
  it('identity at slider=0.5 → speed=1.0 exactly', () => {
    expect(sliderToSpeed(0.5)).toBe(1.0)
    expect(speedToSlider(1.0)).toBe(0.5)
  })

  it('endpoints: slider 0 ↔ 0.5x, slider 1 ↔ 2x', () => {
    expect(sliderToSpeed(0)).toBeCloseTo(0.5, 6)
    expect(sliderToSpeed(1)).toBeCloseTo(2.0, 6)
    expect(speedToSlider(0.5)).toBeCloseTo(0, 6)
    expect(speedToSlider(2.0)).toBeCloseTo(1, 6)
  })

  it('round-trips for 11 sample points', () => {
    for (let i = 0; i <= 10; i++) {
      const s = i / 10
      expect(speedToSlider(sliderToSpeed(s))).toBeCloseTo(s, 6)
    }
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run tests/unit/speed.test.ts`
Expected: FAIL — `Cannot find module '../../src/audio/speed'`.

- [ ] **Step 3: Implement helpers**

Create `src/audio/speed.ts`:

```ts
// ABOUTME: sliderToSpeed / speedToSlider — log mapping from 0..1 slider to 0.5..2.0 speed.
// ABOUTME: Pure functions, mirror src/audio/pitch.ts shape. Identity at slider=0.5 is exact.

// 0..1 slider → 0.5..2.0 speed, log-mapped, identity at 0.5 → 1.0 (exact)
export function sliderToSpeed(s: number): number {
  return Math.pow(2, 2 * s - 1)
}

// 0.5..2.0 speed → 0..1 slider, inverse of sliderToSpeed
export function speedToSlider(v: number): number {
  return (Math.log2(v) + 1) / 2
}
```

- [ ] **Step 4: Run, confirm passing**

Run: `npx vitest run tests/unit/speed.test.ts`
Expected: PASS, 3 cases.

- [ ] **Step 5: Commit**

```bash
git add src/audio/speed.ts tests/unit/speed.test.ts
git commit -m "feat: add log-mapped speed slider helpers"
```

---

### Task 3: Read-time `speed` normalisation in `src/store/exports.ts`

Why this task exists: `ExportRecord.fxSnapshot: EffectParams` now requires `speed`, but on-disk records written before this PR will not have it. We normalise at read time; `toggleStarred` opportunistically writes back. No IDB schema bump.

**Files:**
- Modify: `tests/unit/exports-store.test.ts`
- Modify: `src/store/exports.ts:67-91`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/exports-store.test.ts` (inside the `describe` block):

```ts
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
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run tests/unit/exports-store.test.ts`
Expected: FAIL — the legacy record's `speed` is `undefined`.

- [ ] **Step 3: Implement `normalize()` and apply in `listExports` and `toggleStarred`**

In `src/store/exports.ts`, add the helper above `putExport`:

```ts
function normalize(rec: ExportRecord): ExportRecord {
  if (rec.fxSnapshot.speed !== undefined) return rec
  return { ...rec, fxSnapshot: { speed: 1, ...rec.fxSnapshot } }
}
```

Modify `listExports` (currently lines 67-71) to map through `normalize`:

```ts
export async function listExports(): Promise<ExportRecord[]> {
  const db = await initExportsDb()
  const all = await db.getAllFromIndex('exports', 'by_createdAt')
  return all.reverse().map(normalize)
}
```

Modify `toggleStarred` (currently lines 84-91). The current body reads the record and re-puts it; insert `normalize` before the `put`:

```ts
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
```

- [ ] **Step 4: Run, confirm passing**

Run: `npx vitest run tests/unit/exports-store.test.ts`
Expected: PASS — original 5 cases plus 3 new = 8 cases.

- [ ] **Step 5: Commit**

```bash
git add src/store/exports.ts tests/unit/exports-store.test.ts
git commit -m "feat: read-time speed normalisation in exports store"
```

---

## Chunk 2: WSOLA worklet (built up TDD)

After this chunk: a fully unit-tested WSOLA worklet exists at `src/audio/worklets/wsola.worklet.ts` but is not yet wired into the engine. `npm run dev` is unaffected — pitch still works the old way, speed slider still does not exist. `npm test` covers the worklet in isolation; `npm run build` and CI continue to pass.

Build-up order: skeleton → fast path → stretch → pitch → cross-correlation → loop wrap → message protocol → position reporting.

### Task 4: Worklet skeleton with neutral fast-path (TDD)

**Files:**
- Create: `tests/unit/wsola.test.ts`
- Create: `src/audio/worklets/wsola.worklet.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/wsola.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import '../../src/audio/worklets/processor-shim'
import { WSOLAProcessor } from '../../src/audio/worklets/wsola.worklet'
import { postToProcessor } from '../helpers/worklet'

const SR = 48000
const BLOCK = 128
const PRIMING_BLOCKS = 1 // documented in spec §5.7 risk #3 / §7.1

function ramp(n: number): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = i / n
  return out
}

// Drive the processor with no audio inputs (it owns its buffer);
// collect `blocks` blocks of 128 samples per channel.
function drainBlocks(proc: WSOLAProcessor, channels: number, blocks: number): Float32Array[] {
  const out: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(blocks * BLOCK))
  for (let b = 0; b < blocks; b++) {
    const outBlock = Array.from({ length: channels }, () => new Float32Array(BLOCK))
    proc.process([[]], [outBlock], {})
    for (let c = 0; c < channels; c++) out[c].set(outBlock[c], b * BLOCK)
  }
  return out
}

describe('WSOLAProcessor', () => {
  it('neutral fast-path is sample-identical to input (mod priming)', () => {
    const proc = new WSOLAProcessor()
    const input = ramp(4096)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play',
      offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 1, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, 32) // 32 * 128 = 4096
    const skip = PRIMING_BLOCKS * BLOCK
    for (let i = skip; i < 4096; i++) {
      expect(out[0][i]).toBeCloseTo(input[i], 6)
    }
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: FAIL — `Cannot find module '../../src/audio/worklets/wsola.worklet'`.

- [ ] **Step 3: Implement skeleton + neutral fast-path**

Create `src/audio/worklets/wsola.worklet.ts`:

```ts
// ABOUTME: WSOLA player worklet — owns the source buffer; emits at chosen speed and pitch.
// ABOUTME: Standard WSOLA stretch composed with linear resample for pitch; neutral fast-path bypass.

import './processor-shim'

interface FxParams {
  speed: number
  pitchSemitones: number
}

interface TrimSec {
  startSec: number
  endSec: number
}

type LoadMsg = { type: 'load'; channels: Float32Array[]; sampleRate: number }
type PlayMsg = { type: 'play'; offsetSec: number; trim: TrimSec; fx: FxParams }
type PauseMsg = { type: 'pause' }
type SeekMsg = { type: 'seek'; sourceTimeSec: number }
type SetTrimMsg = { type: 'setTrim'; trim: TrimSec }
type SetFxMsg = { type: 'setFx'; fx: FxParams }
type UnloadMsg = { type: 'unload' }
type InMsg = LoadMsg | PlayMsg | PauseMsg | SeekMsg | SetTrimMsg | SetFxMsg | UnloadMsg

export class WSOLAProcessor extends AudioWorkletProcessor {
  private channels: Float32Array[] = []
  private srcSampleRate = 48000
  private trimStart = 0           // input samples
  private trimEnd = 0             // input samples
  private readPos = 0             // input samples (fractional allowed)
  private speed = 1
  private pitchFactor = 1
  private state: 'idle' | 'playing' | 'paused' = 'idle'

  constructor() {
    super()
    ;(this as any).port.onmessage = (ev: MessageEvent) => this.onMessage(ev.data as InMsg)
  }

  private onMessage(msg: InMsg): void {
    switch (msg.type) {
      case 'load': {
        this.channels = msg.channels
        this.srcSampleRate = msg.sampleRate
        this.trimStart = 0
        this.trimEnd = msg.channels[0]?.length ?? 0
        this.readPos = 0
        this.state = 'idle'
        return
      }
      case 'play': {
        this.trimStart = Math.round(msg.trim.startSec * this.srcSampleRate)
        this.trimEnd = Math.round(msg.trim.endSec * this.srcSampleRate)
        this.readPos = Math.round(msg.offsetSec * this.srcSampleRate)
        this.applyFx(msg.fx)
        this.state = 'playing'
        return
      }
      case 'pause': {
        this.state = 'paused'
        return
      }
      case 'seek': {
        this.readPos = Math.round(msg.sourceTimeSec * this.srcSampleRate)
        return
      }
      case 'setTrim': {
        this.trimStart = Math.round(msg.trim.startSec * this.srcSampleRate)
        this.trimEnd = Math.round(msg.trim.endSec * this.srcSampleRate)
        if (this.readPos < this.trimStart || this.readPos >= this.trimEnd) {
          this.readPos = this.trimStart
        }
        return
      }
      case 'setFx': {
        this.applyFx(msg.fx)
        return
      }
      case 'unload': {
        this.channels = []
        this.state = 'idle'
        return
      }
    }
  }

  private applyFx(fx: FxParams): void {
    this.speed = fx.speed
    this.pitchFactor = Math.pow(2, fx.pitchSemitones / 12)
  }

  private isNeutral(): boolean {
    return this.speed === 1 && this.pitchFactor === 1
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0]
    if (!output || output.length === 0) return true

    if (this.state !== 'playing' || this.channels.length === 0) {
      // emit silence
      for (let c = 0; c < output.length; c++) output[c]?.fill(0)
      return true
    }

    if (this.isNeutral()) {
      this.processNeutral(output)
      return true
    }

    // Non-neutral: silence for now — built up in subsequent tasks.
    for (let c = 0; c < output.length; c++) output[c]?.fill(0)
    return true
  }

  private processNeutral(output: Float32Array[]): void {
    const N = output[0].length
    const span = Math.max(1, this.trimEnd - this.trimStart)
    for (let i = 0; i < N; i++) {
      // wrap into [trimStart, trimEnd)
      let p = this.readPos
      if (p >= this.trimEnd) p = this.trimStart + ((p - this.trimStart) % span)
      const idx = Math.floor(p)
      for (let c = 0; c < output.length && c < this.channels.length; c++) {
        output[c][i] = this.channels[c][idx] ?? 0
      }
      this.readPos = p + 1
    }
  }
}

registerProcessor('wsola', WSOLAProcessor)
```

- [ ] **Step 4: Run, confirm passing**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: PASS, 1 case.

- [ ] **Step 5: Commit**

```bash
git add src/audio/worklets/wsola.worklet.ts tests/unit/wsola.test.ts
git commit -m "feat: WSOLA worklet skeleton with neutral fast-path"
```

---

### Task 5: WSOLA stretch (no pitch yet) — length correctness

**Files:**
- Modify: `src/audio/worklets/wsola.worklet.ts`
- Modify: `tests/unit/wsola.test.ts`

This task adds the OLA core: read at analysis hop `Ha = Hs / S` where `S = pitchFactor / speed` (with `pitchFactor === 1` for now), write at synthesis hop `Hs = 256`. Frame size `N = 1024`. Hann window, partition-of-unity divide. Cross-correlation search comes in Task 7. No pitch shift yet.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/wsola.test.ts`:

```ts
function sine(n: number, freq: number, sr: number): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / sr)
  return out
}

function rms(buf: Float32Array): number {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / buf.length)
}

function findFirstActive(buf: Float32Array, threshold = 1e-3): number {
  for (let i = 0; i < buf.length; i++) if (Math.abs(buf[i]) > threshold) return i
  return -1
}

function findLastActive(buf: Float32Array, threshold = 1e-3): number {
  for (let i = buf.length - 1; i >= 0; i--) if (Math.abs(buf[i]) > threshold) return i
  return -1
}

describe('WSOLAProcessor — stretch', () => {
  it('speed=0.5 produces output ~2× input length', () => {
    const proc = new WSOLAProcessor()
    const input = sine(4096, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 0.5, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    // Expect ~8192 samples of audible signal. Drain 80 blocks (10240 samples) to be safe.
    const out = drainBlocks(proc, 1, 80)
    const last = findLastActive(out[0])
    // Allow ±N samples of imprecision due to OLA priming and frame-edge rounding.
    expect(last).toBeGreaterThan(8192 - 1024)
    expect(last).toBeLessThan(8192 + 1024)
  })

  it('speed=2 produces output ~½ input length', () => {
    const proc = new WSOLAProcessor()
    const input = sine(4096, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 2, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    // After ~2048 samples of input, the loop wraps; just check output is non-zero
    // and rms is comparable to input rms. Length-wise, in-window output ≈ input/2.
    const out = drainBlocks(proc, 1, 32)
    expect(rms(out[0].subarray(0, 2048))).toBeGreaterThan(0.1)
  })
})
```

The first test asserts length (the headline property of the stretch). The second is a smoke test — at speed=2 the worklet wraps around the input loop quickly, so a strict end-of-signal assertion is misleading; instead we check that meaningful audio comes out at all.

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: FAIL — current non-neutral path emits silence.

- [ ] **Step 3: Implement WSOLA OLA**

Replace `src/audio/worklets/wsola.worklet.ts` with the full OLA implementation. Add to the file:

1. Frame constants:

```ts
const N = 1024            // frame size
const HS = 256            // synthesis hop (75% overlap)
const RING = 4 * N        // OLA ring buffer length, ample headroom
```

2. Precomputed Hann window (constructor-time):

```ts
private hann = new Float32Array(N)
private windowEnv = new Float32Array(HS) // partition-of-unity divisor
// in constructor, after super():
{
  for (let i = 0; i < N; i++) this.hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)))
  // For Hs=256, N=1024 (overlap factor = N/Hs = 4), the sum-of-windows over one Hs is:
  for (let i = 0; i < HS; i++) {
    let s = 0
    for (let k = 0; k < N / HS; k++) s += this.hann[i + k * HS] ** 2 // power-complementary
    this.windowEnv[i] = Math.max(s, 1e-6)
  }
}
```

3. OLA state:

```ts
private olaRing: Float32Array[] = [] // per channel
private olaWritePos = 0              // write head in ring (samples emitted so far)
private olaReadPos = 0               // read head
```

(Initialise the ring on `load`: `this.olaRing = msg.channels.map(() => new Float32Array(RING))`.)

4. Replace the non-neutral branch in `process()`:

```ts
// Non-neutral path: ensure ≥ output.length samples are queued in olaRing.
const need = output[0].length
while (this.olaWritePos - this.olaReadPos < need) {
  this.synthesizeOneFrame()
}
this.drainToOutput(output, need)
```

5. New methods:

```ts
private synthesizeOneFrame(): void {
  // For each output channel, take a Hann-windowed frame from the input at this.readPos,
  // overlap-add into the ring at this.olaWritePos, then advance olaWritePos by HS.
  const S = this.pitchFactor / this.speed
  const Ha = HS / S
  const channels = this.channels.length
  if (channels === 0) return

  // Pull one analysis frame; wrap readPos into [trimStart, trimEnd).
  const startInt = Math.floor(this.readPos)
  const span = Math.max(1, this.trimEnd - this.trimStart)

  for (let c = 0; c < channels; c++) {
    const inCh = this.channels[c]
    const ring = this.olaRing[c]
    for (let n = 0; n < N; n++) {
      // wrap each input sample read
      let p = startInt + n
      if (p >= this.trimEnd) p = this.trimStart + ((p - this.trimStart) % span)
      const v = inCh[p] ?? 0
      const ringIdx = (this.olaWritePos + n) % RING
      ring[ringIdx] += v * this.hann[n]
    }
  }
  this.olaWritePos += HS
  this.readPos += Ha
  // wrap readPos
  if (this.readPos >= this.trimEnd) {
    this.readPos = this.trimStart + ((this.readPos - this.trimStart) % span)
  }
}

private drainToOutput(output: Float32Array[], need: number): void {
  const channels = output.length
  for (let i = 0; i < need; i++) {
    const ringIdx = (this.olaReadPos + i) % RING
    const envIdx = (this.olaReadPos + i) % HS
    const norm = this.windowEnv[envIdx]
    for (let c = 0; c < channels && c < this.olaRing.length; c++) {
      output[c][i] = this.olaRing[c][ringIdx] / norm
      this.olaRing[c][ringIdx] = 0 // clear behind read head
    }
  }
  this.olaReadPos += need
}
```

Note the `partition-of-unity` divisor: at Hs=256, N=1024, with squared Hann, the running sum is constant in steady-state but rolls in/out at the buffer edges. Dividing by `windowEnv` keeps amplitude flat.

Also: on `load`/`play`/`seek`, reset `olaWritePos` and `olaReadPos` and clear the ring.

- [ ] **Step 4: Run, confirm passing**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: PASS, all cases (1 from Task 4 + 2 from Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/audio/worklets/wsola.worklet.ts tests/unit/wsola.test.ts
git commit -m "feat: WSOLA OLA stretch (no pitch yet, no correlation search)"
```

---

### Task 6: Pitch shift via linear resample — decoupling test

**Files:**
- Modify: `src/audio/worklets/wsola.worklet.ts`
- Modify: `tests/unit/wsola.test.ts`

After this task, pitch and speed are independently controllable. The decomposition is: WSOLA-stretch by `S = pitchFactor / speed`, then linearly resample by `1/pitchFactor`. When `pitchFactor === 1`, the resample step is a copy.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/wsola.test.ts`:

```ts
// Naive zero-cross frequency estimator. Assumes monotonic mid-band sine.
function dominantFreqHz(buf: Float32Array, sr: number): number {
  let crossings = 0
  for (let i = 1; i < buf.length; i++) {
    if (buf[i - 1] <= 0 && buf[i] > 0) crossings++
  }
  return (crossings * sr) / buf.length
}

describe('WSOLAProcessor — pitch shift', () => {
  it('speed=1, pitch=+12 on 220 Hz sine produces ~440 Hz', () => {
    const proc = new WSOLAProcessor()
    const input = sine(8192, 220, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 8192 / SR },
      fx: { speed: 1, pitchSemitones: 12, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, 64) // 8192 samples
    // Skip priming, measure middle 4096 samples.
    const measured = dominantFreqHz(out[0].subarray(2048, 6144), SR)
    expect(measured).toBeGreaterThan(420)
    expect(measured).toBeLessThan(460)
  })

  it('speed=0.5, pitch=+12 — output is ~2× as long AND ~440 Hz (decoupling)', () => {
    const proc = new WSOLAProcessor()
    const input = sine(4096, 220, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 0.5, pitchSemitones: 12, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, 80) // 10240 samples; expect ~8192 of signal
    // Measure pitch in the middle of the stretched output.
    const measured = dominantFreqHz(out[0].subarray(2048, 6144), SR)
    expect(measured).toBeGreaterThan(420)
    expect(measured).toBeLessThan(460)
    // Length: signal extends past 6144 (which input alone would not, since input is 4096).
    expect(rms(out[0].subarray(4500, 6500))).toBeGreaterThan(0.1)
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: FAIL — pitch shift not implemented; output frequency will still be 220 Hz.

- [ ] **Step 3: Implement linear resample post-OLA**

Replace `drainToOutput` and add a fractional read head. State:

```ts
private olaReadPosFrac = 0 // fractional read index into ring buffer
```

Modified drain:

```ts
private drainToOutput(output: Float32Array[], need: number): void {
  const channels = output.length
  if (this.pitchFactor === 1) {
    for (let i = 0; i < need; i++) {
      const ringIdx = (this.olaReadPos + i) % RING
      const envIdx = (this.olaReadPos + i) % HS
      const norm = this.windowEnv[envIdx]
      for (let c = 0; c < channels && c < this.olaRing.length; c++) {
        output[c][i] = this.olaRing[c][ringIdx] / norm
        this.olaRing[c][ringIdx] = 0
      }
    }
    this.olaReadPos += need
    return
  }

  // Linear resample: read at rate 1/pitchFactor through the ring.
  const step = 1 / this.pitchFactor
  for (let i = 0; i < need; i++) {
    const fracPos = this.olaReadPosFrac + i * step
    const base = Math.floor(fracPos)
    const frac = fracPos - base
    const idx0 = (this.olaReadPos + base) % RING
    const idx1 = (this.olaReadPos + base + 1) % RING
    const envIdx0 = (this.olaReadPos + base) % HS
    const envIdx1 = (this.olaReadPos + base + 1) % HS
    const norm0 = this.windowEnv[envIdx0]
    const norm1 = this.windowEnv[envIdx1]
    for (let c = 0; c < channels && c < this.olaRing.length; c++) {
      const a = this.olaRing[c][idx0] / norm0
      const b = this.olaRing[c][idx1] / norm1
      output[c][i] = a + (b - a) * frac
    }
  }
  // Advance read positions; consume up to floor(end) integer samples.
  const consumed = Math.floor(this.olaReadPosFrac + need * step)
  for (let j = 0; j < consumed; j++) {
    const idx = (this.olaReadPos + j) % RING
    for (let c = 0; c < this.olaRing.length; c++) this.olaRing[c][idx] = 0
  }
  this.olaReadPos += consumed
  this.olaReadPosFrac = (this.olaReadPosFrac + need * step) - consumed
}
```

Also adjust the pre-drain check to account for the resample step: `need / pitchFactor` integer samples must be queued. Replace the loop in `process()` with:

```ts
const need = output[0].length
const queueDemand = Math.ceil(need / this.pitchFactor) + N
while (this.olaWritePos - this.olaReadPos < queueDemand) {
  this.synthesizeOneFrame()
}
this.drainToOutput(output, need)
```

- [ ] **Step 4: Run, confirm passing**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/audio/worklets/wsola.worklet.ts tests/unit/wsola.test.ts
git commit -m "feat: WSOLA pitch shift via linear resample (decoupled from speed)"
```

---

### Task 7: WSOLA cross-correlation search

**Files:**
- Modify: `src/audio/worklets/wsola.worklet.ts`
- Modify: `tests/unit/wsola.test.ts`

Up to now, the analysis read pointer advances by `Ha` regardless of phase alignment. WSOLA's contribution is to *search* a small window around the expected position for the best phase match against the previously written synthesis frame. This drops splice-related artifacts dramatically at low speeds.

- [ ] **Step 1: Write failing test**

Append to `tests/unit/wsola.test.ts`:

```ts
describe('WSOLAProcessor — cross-correlation search', () => {
  it('chosen analysis offset for a periodic signal lands near the period', () => {
    // Pure sine at 100 Hz @ 48k → period = 480 samples. Expected best splice
    // is at the period, modulo phase wrap. We test indirectly: at speed=0.5,
    // pure sine should come out clean (low THD), which is impossible without
    // correlation alignment.
    const proc = new WSOLAProcessor()
    const input = sine(8192, 100, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 8192 / SR },
      fx: { speed: 0.5, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, 128)
    // Skip 1024 samples of priming; measure THD by comparing rms inside vs
    // outside a narrow band around 100 Hz. Cheap proxy: assert energy in the
    // first half-period of zero crossings is concentrated and not chaotic.
    const measured = dominantFreqHz(out[0].subarray(1024, 8192), SR)
    expect(measured).toBeGreaterThan(95)
    expect(measured).toBeLessThan(105)
    // Reject high-frequency junk: low-pass via 4-tap moving average should
    // not significantly attenuate the signal if it's a clean 100 Hz sine.
    const smoothed = new Float32Array(out[0].length - 4)
    for (let i = 0; i < smoothed.length; i++) {
      smoothed[i] = (out[0][i] + out[0][i+1] + out[0][i+2] + out[0][i+3]) / 4
    }
    const rmsOut = rms(out[0].subarray(1024, 8192))
    const rmsSm = rms(smoothed.subarray(1024, 8192))
    expect(rmsSm / rmsOut).toBeGreaterThan(0.95)
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: FAIL — without correlation, the OLA introduces splice clicks; the smoothed/raw rms ratio drops below 0.95.

- [ ] **Step 3: Implement cross-correlation search**

Add constants:

```ts
const SEARCH_DELTA = 128 // ± samples around expected analysis position
```

Add state:

```ts
private prevTail: Float32Array[] = [] // last SEARCH_DELTA*2 samples emitted, per channel
```

Initialise `prevTail` on `load`/`play`/`seek`: `this.prevTail = msg.channels.map(() => new Float32Array(SEARCH_DELTA * 2))`.

Replace the analysis-position computation in `synthesizeOneFrame()`:

```ts
private synthesizeOneFrame(): void {
  const S = this.pitchFactor / this.speed
  const Ha = HS / S
  const channels = this.channels.length
  if (channels === 0) return

  const expected = this.readPos
  let bestPos = expected
  if (this.prevTail.length > 0 && this.prevTail[0].some((v) => v !== 0)) {
    bestPos = this.searchBestAlignment(expected)
  }
  const startInt = Math.floor(bestPos)
  const span = Math.max(1, this.trimEnd - this.trimStart)

  for (let c = 0; c < channels; c++) {
    const inCh = this.channels[c]
    const ring = this.olaRing[c]
    for (let n = 0; n < N; n++) {
      let p = startInt + n
      if (p >= this.trimEnd) p = this.trimStart + ((p - this.trimStart) % span)
      const v = inCh[p] ?? 0
      const ringIdx = (this.olaWritePos + n) % RING
      ring[ringIdx] += v * this.hann[n]
    }
    // Update prevTail with the last 2*SEARCH_DELTA windowed samples we just wrote
    for (let n = 0; n < SEARCH_DELTA * 2; n++) {
      let p = startInt + (N - SEARCH_DELTA * 2) + n
      if (p >= this.trimEnd) p = this.trimStart + ((p - this.trimStart) % span)
      this.prevTail[c][n] = (inCh[p] ?? 0) * this.hann[(N - SEARCH_DELTA * 2) + n]
    }
  }
  this.olaWritePos += HS
  this.readPos = bestPos + Ha
  if (this.readPos >= this.trimEnd) {
    this.readPos = this.trimStart + ((this.readPos - this.trimStart) % span)
  }
}

private searchBestAlignment(expected: number): number {
  // Cross-correlate the head of the candidate analysis frame against prevTail
  // (the tail of the previous synthesis frame, in unwindowed input space).
  const span = Math.max(1, this.trimEnd - this.trimStart)
  const lo = Math.max(this.trimStart, Math.floor(expected) - SEARCH_DELTA)
  const hi = Math.min(this.trimEnd - N, Math.floor(expected) + SEARCH_DELTA)
  let bestScore = -Infinity
  let bestPos = expected
  for (let cand = lo; cand <= hi; cand++) {
    let score = 0
    let normA = 0
    let normB = 0
    for (let c = 0; c < this.channels.length; c++) {
      const inCh = this.channels[c]
      for (let n = 0; n < SEARCH_DELTA * 2; n++) {
        let p = cand + n
        if (p >= this.trimEnd) p = this.trimStart + ((p - this.trimStart) % span)
        const a = inCh[p] ?? 0
        const b = this.prevTail[c][n]
        score += a * b
        normA += a * a
        normB += b * b
      }
    }
    const norm = Math.sqrt(normA * normB) + 1e-9
    const normScore = score / norm
    if (normScore > bestScore) {
      bestScore = normScore
      bestPos = cand
    }
  }
  return bestPos
}
```

- [ ] **Step 4: Run, confirm passing**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/audio/worklets/wsola.worklet.ts tests/unit/wsola.test.ts
git commit -m "feat: WSOLA cross-correlation analysis-frame search"
```

---

### Task 8: Loop wrap correctness inside trim window

**Files:**
- Modify: `tests/unit/wsola.test.ts`

The wrap logic was added piecemeal in earlier tasks. This task adds an explicit test to lock in the behaviour and catch regressions.

- [ ] **Step 1: Write failing test (or verify pass under existing implementation)**

Append to `tests/unit/wsola.test.ts`:

```ts
describe('WSOLAProcessor — loop wrap', () => {
  it('loops within trim window indefinitely', () => {
    const proc = new WSOLAProcessor()
    // Ramp from 0..1 over 1 second; trim window is the middle 0.2s (4800..14400 at 48k? No: 0.4s..0.6s = 19200..28800).
    // Use a sawtooth that wraps inside the trim window so the loop boundary is observable.
    const input = ramp(SR) // 1.0s
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0.4,
      trim: { startSec: 0.4, endSec: 0.6 },
      fx: { speed: 1, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    // Drain 4 trim spans worth of output. Trim span = 0.2s = 9600 samples.
    const out = drainBlocks(proc, 1, Math.ceil((9600 * 4) / BLOCK))
    // Output should be 4 repetitions of input[19200..28800].
    const span = 9600
    for (let rep = 0; rep < 4; rep++) {
      // Sample 5 points across each span; tolerate priming by skipping rep 0.
      if (rep === 0) continue
      for (let frac = 0.1; frac < 1.0; frac += 0.2) {
        const offset = Math.floor(frac * span)
        const o = rep * span + offset
        const expected = input[19200 + offset]
        expect(out[0][o]).toBeCloseTo(expected, 2)
      }
    }
  })
})
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/unit/wsola.test.ts`
If this passes already (most likely — wrap was implemented in T4/T5), commit and move on. If not, fix the wrap (likely in `processNeutral` or `synthesizeOneFrame`).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/wsola.test.ts
git commit -m "test: WSOLA loop-wrap regression test"
```

---

### Task 9: Pause / seek / setFx / setTrim mid-process

**Files:**
- Modify: `src/audio/worklets/wsola.worklet.ts`
- Modify: `tests/unit/wsola.test.ts`

Most of these handlers exist after Task 4; this task adds mid-process semantics tests and the seek-fade-in.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/wsola.test.ts`:

```ts
describe('WSOLAProcessor — control messages', () => {
  it('pause emits silence and holds readPos', () => {
    const proc = new WSOLAProcessor()
    const input = sine(8192, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 8192 / SR },
      fx: { speed: 1, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    drainBlocks(proc, 1, 4) // 512 samples played
    postToProcessor(proc, { type: 'pause' })
    const silent = drainBlocks(proc, 1, 4) // 512 samples while paused
    for (let i = 0; i < silent[0].length; i++) {
      expect(silent[0][i]).toBe(0)
    }
  })

  it('setFx({speed:1.5}) mid-process does not zero-fill or duplicate', () => {
    const proc = new WSOLAProcessor()
    const input = sine(16384, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 16384 / SR },
      fx: { speed: 1, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const phase1 = drainBlocks(proc, 1, 32) // 4096 samples at speed=1
    postToProcessor(proc, {
      type: 'setFx',
      fx: { speed: 1.5, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const phase2 = drainBlocks(proc, 1, 32)
    // No long zero runs (>= 64 samples) in either phase, modulo priming.
    function maxZeroRun(buf: Float32Array): number {
      let cur = 0, max = 0
      for (let i = 0; i < buf.length; i++) {
        if (Math.abs(buf[i]) < 1e-6) cur++
        else { max = Math.max(max, cur); cur = 0 }
      }
      return Math.max(max, cur)
    }
    expect(maxZeroRun(phase1.subarray(BLOCK))).toBeLessThan(64)
    expect(maxZeroRun(phase2.subarray(BLOCK))).toBeLessThan(64)
  })

  it('seek drops OLA state to avoid splice clicks', () => {
    const proc = new WSOLAProcessor()
    const input = sine(SR, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 1 },
      fx: { speed: 0.7, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    drainBlocks(proc, 1, 16)
    postToProcessor(proc, { type: 'seek', sourceTimeSec: 0.5 })
    const after = drainBlocks(proc, 1, 16)
    // First sample after seek should not be a huge step; allow up to one full
    // sample swing but not more (would indicate carry-over splice).
    expect(Math.abs(after[0][0])).toBeLessThan(1.0)
  })
})
```

- [ ] **Step 2: Run, confirm pass/fail per test**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: pause and setFx tests likely pass (handlers exist already). Seek test may fail if `seek` doesn't reset OLA state.

- [ ] **Step 3: Make seek reset OLA + prevTail**

In `onMessage` `seek` branch:

```ts
case 'seek': {
  this.readPos = Math.round(msg.sourceTimeSec * this.srcSampleRate)
  for (const r of this.olaRing) r.fill(0)
  for (const t of this.prevTail) t.fill(0)
  this.olaWritePos = 0
  this.olaReadPos = 0
  this.olaReadPosFrac = 0
  return
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/audio/worklets/wsola.worklet.ts tests/unit/wsola.test.ts
git commit -m "feat: WSOLA seek/pause/setFx mid-process semantics"
```

---

### Task 10: Position reporting back to main thread

**Files:**
- Modify: `src/audio/worklets/wsola.worklet.ts`
- Modify: `tests/unit/wsola.test.ts`

- [ ] **Step 1: Extend `processor-shim.ts` postMessage to capture sent messages**

The existing shim has `postMessage: () => {}` which discards messages. We need to spy on it for the test. Add a recording variant inline in the test rather than modifying the shim:

```ts
function makeRecordingPort() {
  const sent: any[] = []
  return {
    sent,
    install(proc: any) {
      const orig = proc.port
      proc.port = {
        onmessage: orig.onmessage,
        postMessage: (data: any) => { sent.push(data) },
      }
    },
  }
}
```

- [ ] **Step 2: Write failing test**

Append to `tests/unit/wsola.test.ts`:

```ts
describe('WSOLAProcessor — position reporting', () => {
  it('emits position messages periodically while playing', () => {
    const proc = new WSOLAProcessor()
    const port = makeRecordingPort()
    port.install(proc)
    const input = sine(SR, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 1 },
      fx: { speed: 1, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    drainBlocks(proc, 1, 32) // 32 * 128 = 4096 samples = ~85ms
    const positions = port.sent.filter((m) => m.type === 'position')
    expect(positions.length).toBeGreaterThan(0)
    const last = positions[positions.length - 1]
    expect(last.readPosSec).toBeGreaterThan(0)
    expect(last.readPosSec).toBeLessThan(0.1)
  })
})
```

Note: `postToProcessor` reads `proc.port.onmessage`, but our recording port replaces `port` after install — restore the original `onmessage` reference. Hence the `install` method preserves it. Re-install before each post if needed; in this test `load`/`play` are posted *after* install, so we re-route `postToProcessor` calls through the new port:

```ts
function postViaPort(port: any, proc: any, data: unknown) {
  // bypass the recording shim's onmessage hand-off — call the processor directly.
  const handler = (proc as any).port.onmessage
  handler({ data } as MessageEvent)
}
```

Adjust the test to use `postViaPort` after `install`.

- [ ] **Step 3: Run, confirm failure**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: FAIL — no `position` messages emitted.

- [ ] **Step 4: Implement position reporting**

Add a counter and a post-every-N-blocks emission inside `process()` (at the bottom, before `return true`):

```ts
private blocksSinceReport = 0
private static readonly REPORT_EVERY_BLOCKS = 8 // ~21 ms at 48k

// ... in process(), after successful render:
this.blocksSinceReport++
if (this.blocksSinceReport >= WSOLAProcessor.REPORT_EVERY_BLOCKS) {
  this.blocksSinceReport = 0
  ;(this as any).port.postMessage({
    type: 'position',
    readPosSec: this.readPos / this.srcSampleRate,
  })
}
```

Reset `blocksSinceReport` to 0 on `pause`/`seek`/`unload` so the first post-resume position is fresh.

- [ ] **Step 5: Run, confirm passing**

Run: `npx vitest run tests/unit/wsola.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/audio/worklets/wsola.worklet.ts tests/unit/wsola.test.ts
git commit -m "feat: WSOLA emits position messages every ~21ms"
```

---

## Chunk 3: Engine integration (BufferSource → WSOLAPlayer)

After this chunk: `BufferSource` is gone from runtime. The engine's play/pause/seek/setEffect/setTrim API is preserved at the same shape but is implemented via port messages. The render-parity merge gate passes byte-identically.

**Important:** Tasks 11 and 12 form a paired commit — Task 11 alone leaves the build broken (graph.ts removes `applyPitch` and `setSource`; engine.ts still references them). Land them together.

### Task 11: Register the worklet and rebuild PreviewGraph

**Files:**
- Modify: `src/audio/graph.ts`

- [ ] **Step 1: Import the worklet URL**

At the top of `src/audio/graph.ts` (alongside existing `bitcrusherUrl` and `srholdUrl` imports):

```ts
import wsolaUrl from './worklets/wsola.worklet.ts?worker&url'
```

- [ ] **Step 2: Register in `loadWorklets`**

Add to the existing function:

```ts
export async function loadWorklets(ctx: BaseAudioContext): Promise<void> {
  await ctx.audioWorklet.addModule(bitcrusherUrl)
  await ctx.audioWorklet.addModule(srholdUrl)
  await ctx.audioWorklet.addModule(wsolaUrl)
}
```

- [ ] **Step 3: Replace `PreviewGraph` interface and `buildPreviewGraph`**

```ts
export interface PreviewGraph {
  ctx: AudioContext
  player: AudioWorkletNode
  bitCrusher: AudioWorkletNode
  srHold: AudioWorkletNode
  filter: BiquadFilterNode
  analyser: AnalyserNode
  loadBuffer(audioBuffer: AudioBuffer): void
  applyEffects(fx: EffectParams): void
}

export async function buildPreviewGraph(ctx: AudioContext): Promise<PreviewGraph> {
  await loadWorklets(ctx)

  const player = new AudioWorkletNode(ctx, 'wsola')
  const bitCrusher = new AudioWorkletNode(ctx, 'bitcrusher')
  const srHold = new AudioWorkletNode(ctx, 'srhold')
  const filter = ctx.createBiquadFilter()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024

  player.connect(bitCrusher)
  bitCrusher.connect(srHold)
  srHold.connect(filter)
  filter.connect(analyser)
  analyser.connect(ctx.destination)

  return {
    ctx,
    player,
    bitCrusher,
    srHold,
    filter,
    analyser,
    loadBuffer(audioBuffer) {
      const channels: Float32Array[] = []
      const transfer: ArrayBuffer[] = []
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        // Copy to a fresh Float32Array so we own its underlying buffer for transfer.
        const data = new Float32Array(audioBuffer.length)
        audioBuffer.copyFromChannel(data, c)
        channels.push(data)
        transfer.push(data.buffer)
      }
      player.port.postMessage(
        { type: 'load', channels, sampleRate: audioBuffer.sampleRate },
        transfer,
      )
    },
    applyEffects(fx) {
      bitCrusher.port.postMessage({ bits: fx.bitDepth })
      const holdFactor = Math.max(1, Math.floor(ctx.sampleRate / Math.max(1, fx.sampleRateHz)))
      srHold.port.postMessage({ holdFactor })
      const fp = filterParams(fx.filterValue, ctx.sampleRate)
      filter.type = fp.type
      filter.frequency.setTargetAtTime(fp.frequency, ctx.currentTime, 0.01)
      filter.Q.setTargetAtTime(fp.Q, ctx.currentTime, 0.01)
    },
  }
}
```

`applyPitch` is gone (pitch lives in the worklet). `setSource` is gone (worklet *is* the source).

- [ ] **Step 4: Defer `renderOffline` rewrite**

Leave `renderOffline` as-is for the moment; it still uses `BufferSource`. Task 13 rewrites it. Typecheck will be broken until Task 12 — that's expected.

**No commit yet.** Continue to Task 12.

---

### Task 12: Reshape `engine.ts` to message-passing

**Files:**
- Modify: `src/audio/engine.ts`

The engine's public API stays the same; the internals change. Position math switches to source-time.

- [ ] **Step 1: New private fields**

Replace the `AudioEngine` class state:

```ts
export class AudioEngine {
  private ctx: AudioContext | null = null
  private graph: PreviewGraph | null = null
  private currentBuffer: AudioBuffer | null = null
  private pausedSourceTimeSec = 0
  private playStartedAt = 0           // ctx.currentTime when play() was called
  private playStartedAtSrcSec = 0     // source-time anchor at playStartedAt
  private isPlaying = false
  private lastTrim: TrimPoints | null = null
  private lastFx: EffectParams | null = null
  private lastReportedPosSec = 0      // updated from worklet 'position' messages
}
```

- [ ] **Step 2: Wire the position message in `ensureStarted`**

```ts
async ensureStarted(): Promise<void> {
  if (this.ctx) return
  this.ctx = new AudioContext({ latencyHint: 'interactive' })
  this.graph = await buildPreviewGraph(this.ctx)
  this.graph.player.port.onmessage = (ev) => {
    const data = ev.data as { type?: string; readPosSec?: number }
    if (data.type === 'position' && typeof data.readPosSec === 'number') {
      this.lastReportedPosSec = data.readPosSec
    }
  }
}
```

- [ ] **Step 3: Rewrite `loadFromBlob`**

```ts
async loadFromBlob(blob: Blob): Promise<AudioBuffer> {
  await this.ensureStarted()
  const buf = await blob.arrayBuffer()
  const decoded = await this.ctx!.decodeAudioData(buf)
  this.currentBuffer = decoded
  this.graph!.loadBuffer(decoded)
  this.pausedSourceTimeSec = 0
  this.playStartedAtSrcSec = 0
  this.isPlaying = false
  this.lastTrim = null
  this.lastFx = null
  return decoded
}
```

- [ ] **Step 4: Rewrite `play`**

```ts
async play(trim: TrimPoints, fx: EffectParams): Promise<void> {
  if (!this.ctx || !this.graph || !this.currentBuffer) throw new Error('engine not loaded')
  if (this.isPlaying) return
  this.lastTrim = trim
  this.lastFx = fx
  this.graph.applyEffects(fx)
  const offsetSec = trim.startSec + (this.pausedSourceTimeSec - trim.startSec)
  this.graph.player.port.postMessage({
    type: 'play',
    offsetSec: Math.max(trim.startSec, Math.min(trim.endSec, offsetSec)),
    trim,
    fx,
  })
  this.playStartedAt = this.ctx.currentTime
  this.playStartedAtSrcSec = offsetSec
  this.isPlaying = true
}
```

- [ ] **Step 5: Rewrite `pause`**

```ts
pause(): void {
  if (!this.ctx || !this.graph) return
  if (!this.isPlaying) return
  const trim = this.lastTrim ?? { startSec: 0, endSec: this.currentBuffer?.duration ?? 0 }
  this.pausedSourceTimeSec = this.getCurrentSourceTimeSec(trim)
  this.graph.player.port.postMessage({ type: 'pause' })
  this.isPlaying = false
}
```

- [ ] **Step 6: Rewrite `seek`**

```ts
async seek(sourceTimeSec: number): Promise<void> {
  if (!this.currentBuffer || !this.graph) return
  const trim = this.lastTrim ?? { startSec: 0, endSec: this.currentBuffer.duration }
  const clamped = Math.max(trim.startSec, Math.min(trim.endSec, sourceTimeSec))
  this.pausedSourceTimeSec = clamped
  this.graph.player.port.postMessage({ type: 'seek', sourceTimeSec: clamped })
  if (this.isPlaying && this.ctx) {
    this.playStartedAt = this.ctx.currentTime
    this.playStartedAtSrcSec = clamped
  }
}
```

- [ ] **Step 7: Rewrite `setTrim` and `setEffect`**

```ts
async setTrim(trim: TrimPoints): Promise<void> {
  this.lastTrim = trim
  if (!this.graph) return
  // snapshot before the change so the predictor doesn't jump
  if (this.isPlaying && this.ctx) {
    const cur = this.getCurrentSourceTimeSec(trim)
    this.playStartedAt = this.ctx.currentTime
    this.playStartedAtSrcSec = cur
  }
  this.graph.player.port.postMessage({ type: 'setTrim', trim })
}

setEffect(fx: EffectParams): void {
  if (!this.graph || !this.ctx) return
  // If speed changed mid-play, snapshot before applying the new rate.
  if (this.isPlaying && this.lastTrim && this.lastFx && this.lastFx.speed !== fx.speed) {
    const cur = this.getCurrentSourceTimeSec(this.lastTrim)
    this.playStartedAt = this.ctx.currentTime
    this.playStartedAtSrcSec = cur
  }
  this.lastFx = fx
  this.graph.applyEffects(fx)
  this.graph.player.port.postMessage({ type: 'setFx', fx })
}
```

- [ ] **Step 8: Rewrite `unload`**

```ts
unload(): void {
  if (this.graph) this.graph.player.port.postMessage({ type: 'unload' })
  this.currentBuffer = null
  this.pausedSourceTimeSec = 0
  this.playStartedAtSrcSec = 0
  this.isPlaying = false
  this.lastTrim = null
  this.lastFx = null
}
```

- [ ] **Step 9: Rewrite `getCurrentSourceTimeSec`**

```ts
getCurrentSourceTimeSec(trim: TrimPoints): number {
  if (!this.ctx) return trim.startSec
  if (!this.isPlaying) return this.pausedSourceTimeSec
  const wall = this.ctx.currentTime - this.playStartedAt
  const speed = this.lastFx?.speed ?? 1
  const pos = this.playStartedAtSrcSec + wall * speed
  const span = trim.endSec - trim.startSec
  if (span <= 0) return trim.startSec
  return trim.startSec + (((pos - trim.startSec) % span) + span) % span
}
```

- [ ] **Step 10: Rewrite `render`**

```ts
async render(buffer: AudioBuffer, trim: TrimPoints, fx: EffectParams): Promise<AudioBuffer> {
  const sr = buffer.sampleRate
  const length = Math.max(1, Math.ceil(((trim.endSec - trim.startSec) / fx.speed) * sr))
  const offline = new OfflineAudioContext({
    numberOfChannels: buffer.numberOfChannels,
    length,
    sampleRate: sr,
  })
  const { renderOffline } = await import('./graph')
  return renderOffline(offline, buffer, trim, fx)
}
```

(Length now divides by `speed`, not `pitchRate`. Pitch no longer changes duration.)

- [ ] **Step 11: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. (`renderOffline` in `graph.ts` still uses old BufferSource path, but its signature is unchanged and the engine still calls it with the same arguments. This is the temporary inconsistent state — it compiles but the offline path will not actually use the worklet until Task 13.)

- [ ] **Step 12: Run unit tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 13: Commit (T11 + T12 paired)**

```bash
git add src/audio/graph.ts src/audio/engine.ts
git commit -m "refactor(audio): replace BufferSource with WSOLAPlayer worklet"
```

---

### Task 13: Rewrite `renderOffline` to use the worklet

**Files:**
- Modify: `src/audio/graph.ts`

- [ ] **Step 1: Replace `renderOffline`**

```ts
export async function renderOffline(
  ctx: OfflineAudioContext,
  buffer: AudioBuffer,
  trim: TrimPoints,
  fx: EffectParams,
): Promise<AudioBuffer> {
  await loadWorklets(ctx)

  const player = new AudioWorkletNode(ctx, 'wsola')
  const bitCrusher = new AudioWorkletNode(ctx, 'bitcrusher')
  const srHold = new AudioWorkletNode(ctx, 'srhold')
  const filter = ctx.createBiquadFilter()

  bitCrusher.port.postMessage({ bits: fx.bitDepth })
  const holdFactor = Math.max(1, Math.floor(ctx.sampleRate / Math.max(1, fx.sampleRateHz)))
  srHold.port.postMessage({ holdFactor })
  const fp = filterParams(fx.filterValue, ctx.sampleRate)
  filter.type = fp.type
  filter.frequency.value = fp.frequency
  filter.Q.value = fp.Q

  // Load buffer into the worklet (offline ctx accepts the same messages).
  const channels: Float32Array[] = []
  const transfer: ArrayBuffer[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = new Float32Array(buffer.length)
    buffer.copyFromChannel(data, c)
    channels.push(data)
    transfer.push(data.buffer)
  }
  player.port.postMessage(
    { type: 'load', channels, sampleRate: buffer.sampleRate },
    transfer,
  )
  player.port.postMessage({
    type: 'play',
    offsetSec: trim.startSec,
    trim,
    fx,
  })

  player.connect(bitCrusher)
  bitCrusher.connect(srHold)
  srHold.connect(filter)
  filter.connect(ctx.destination)

  return ctx.startRendering()
}
```

The `pitchRateFromSemitones` import in `graph.ts` is now unused (pitch lives in the worklet). Remove it.

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 3: Existing integration tests**

Run: `npm run test:integration`
Expected: PASS for `filter-attenuation` and `stereo-symmetry` (with their newly added `speed: 1` literals from Task 1, the chain at neutral should behave the same).

- [ ] **Step 4: Commit**

```bash
git add src/audio/graph.ts
git commit -m "refactor(audio): renderOffline uses WSOLAPlayer worklet"
```

---

### Task 14: Render-parity integration test (the merge gate)

**Files:**
- Modify: `tests/integration/runner.ts`
- Create: `tests/integration/wsola-stretch.spec.ts`

This is the binding merge gate per spec §9. It runs the *current* `renderOffline` against a frozen-in-fixture *legacy* render that uses `BufferSource` directly, with `speed=1, pitch=0`. Sample-by-sample equal within float epsilon, modulo a one-block startup priming offset.

- [ ] **Step 1: Add a `kind: 'render-legacy'` path in `runner.ts`**

The current `runner.ts` exposes `window.__run({kind:'render', ...})`. Extend it to accept `kind: 'render-legacy'` that builds a BufferSource-based chain (the old code) and renders. This serves as the parity baseline.

Replace `tests/integration/runner.ts`:

```ts
import { renderOffline } from '../../src/audio/graph'
import { filterParams } from '../../src/audio/filter-mapping'
import { pitchRateFromSemitones } from '../../src/audio/pitch'
import bitcrusherUrl from '../../src/audio/worklets/bitcrusher.worklet.ts?worker&url'
import srholdUrl from '../../src/audio/worklets/srhold.worklet.ts?worker&url'
import type { EffectParams } from '../../src/audio/types'

interface RunPayload {
  kind: 'render' | 'render-legacy'
  sourcePcm: number[][]
  sampleRate: number
  effects: EffectParams
  trim: { startSec: number; endSec: number }
}

declare global {
  interface Window {
    __run: (payload: RunPayload) => Promise<{ pcm: number[][]; sampleRate: number; length: number }>
  }
}

async function renderLegacy(payload: RunPayload) {
  // Pre-WSOLA path: BufferSource with playbackRate; pitch couples to duration.
  const pitchRate = pitchRateFromSemitones(payload.effects.pitchSemitones)
  const trimSec = payload.trim.endSec - payload.trim.startSec
  const ctx = new OfflineAudioContext({
    numberOfChannels: payload.sourcePcm.length,
    length: Math.max(1, Math.ceil((trimSec / pitchRate) * payload.sampleRate)),
    sampleRate: payload.sampleRate,
  })
  await ctx.audioWorklet.addModule(bitcrusherUrl)
  await ctx.audioWorklet.addModule(srholdUrl)

  const buffer = ctx.createBuffer(
    payload.sourcePcm.length,
    payload.sourcePcm[0].length,
    payload.sampleRate,
  )
  for (let c = 0; c < payload.sourcePcm.length; c++) {
    buffer.copyToChannel(Float32Array.from(payload.sourcePcm[c]), c)
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = pitchRate

  const bitCrusher = new AudioWorkletNode(ctx, 'bitcrusher')
  bitCrusher.port.postMessage({ bits: payload.effects.bitDepth })
  const srHold = new AudioWorkletNode(ctx, 'srhold')
  const holdFactor = Math.max(
    1,
    Math.floor(ctx.sampleRate / Math.max(1, payload.effects.sampleRateHz)),
  )
  srHold.port.postMessage({ holdFactor })
  const filter = ctx.createBiquadFilter()
  const fp = filterParams(payload.effects.filterValue, ctx.sampleRate)
  filter.type = fp.type
  filter.frequency.value = fp.frequency
  filter.Q.value = fp.Q

  source.connect(bitCrusher)
  bitCrusher.connect(srHold)
  srHold.connect(filter)
  filter.connect(ctx.destination)

  source.start(0, payload.trim.startSec, trimSec)
  const rendered = await ctx.startRendering()
  const pcm: number[][] = []
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    pcm.push(Array.from(rendered.getChannelData(c)))
  }
  return { pcm, sampleRate: rendered.sampleRate, length: rendered.length }
}

async function renderViaWorklet(payload: RunPayload) {
  const pitchRate = Math.pow(2, payload.effects.pitchSemitones / 12)
  const trimSec = payload.trim.endSec - payload.trim.startSec
  const ctx = new OfflineAudioContext({
    numberOfChannels: payload.sourcePcm.length,
    length: Math.max(1, Math.ceil((trimSec / payload.effects.speed) * payload.sampleRate)),
    sampleRate: payload.sampleRate,
  })
  void pitchRate

  const buffer = ctx.createBuffer(
    payload.sourcePcm.length,
    payload.sourcePcm[0].length,
    payload.sampleRate,
  )
  for (let c = 0; c < payload.sourcePcm.length; c++) {
    buffer.copyToChannel(Float32Array.from(payload.sourcePcm[c]), c)
  }

  const rendered = await renderOffline(ctx, buffer, payload.trim, payload.effects)
  const pcm: number[][] = []
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    pcm.push(Array.from(rendered.getChannelData(c)))
  }
  return { pcm, sampleRate: rendered.sampleRate, length: rendered.length }
}

window.__run = async (payload) => {
  return payload.kind === 'render-legacy' ? renderLegacy(payload) : renderViaWorklet(payload)
}

document.getElementById('status')!.textContent = 'ready'
```

- [ ] **Step 2: Write the parity test**

Create `tests/integration/wsola-stretch.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const PRIMING = 128 // one 128-sample block, per spec §5.7 risk #3
const EPS = 1e-4    // float epsilon for cross-implementation comparison

test('neutral parity: WSOLA path equals legacy BufferSource path', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  // Complex synthetic input: mix of three sines + one click transient.
  const result = await page.evaluate(async () => {
    const sr = 48000
    const dur = 0.3
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      ch[i] =
        0.3 * Math.sin((2 * Math.PI * 220 * i) / sr) +
        0.2 * Math.sin((2 * Math.PI * 880 * i) / sr) +
        0.1 * Math.sin((2 * Math.PI * 3300 * i) / sr)
    }
    ch[Math.floor(N * 0.5)] += 0.5 // click transient
    const payload = {
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      effects: { bitDepth: 16, sampleRateHz: sr, pitchSemitones: 0, speed: 1, filterValue: 0 },
      trim: { startSec: 0, endSec: dur },
    }
    const wsola = await window.__run({ ...payload, kind: 'render' })
    const legacy = await window.__run({ ...payload, kind: 'render-legacy' })
    return { wsola, legacy }
  })

  expect(result.wsola.pcm[0].length).toBeGreaterThan(0)
  expect(result.legacy.pcm[0].length).toBeGreaterThan(0)
  // Lengths within ±1 priming block.
  expect(Math.abs(result.wsola.pcm[0].length - result.legacy.pcm[0].length)).toBeLessThanOrEqual(PRIMING)

  // Compare from the latest priming offset onward, in the overlap region.
  const start = PRIMING
  const end = Math.min(result.wsola.pcm[0].length, result.legacy.pcm[0].length)
  let maxDiff = 0
  for (let i = start; i < end; i++) {
    const d = Math.abs(result.wsola.pcm[0][i] - result.legacy.pcm[0][i])
    if (d > maxDiff) maxDiff = d
  }
  expect(maxDiff).toBeLessThan(EPS)
})
```

- [ ] **Step 3: Run integration suite**

Run: `npm run test:integration`
Expected: PASS for the new parity test plus the two pre-existing tests.

If parity fails: the most likely cause is the worklet's neutral fast-path emitting a delayed first block. Inspect with a one-off harness; if a one-block startup latency is unavoidable, adjust `PRIMING` constant in the test (and document in spec §7.1). Spec §5.7 risk #3 explicitly allows up to one block — anything more requires re-spec.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/runner.ts tests/integration/wsola-stretch.spec.ts
git commit -m "test(integration): WSOLA neutral-parity merge gate"
```

---

## Chunk 4: UI, remaining integration tests, e2e

After this chunk: speed slider works in the UI; the spec's full integration test matrix passes; e2e covers the new feature end-to-end. Ready for PR.

### Task 15: Add the fifth slider to `EffectsRack`

**Files:**
- Modify: `src/screens/EffectsRack.tsx`

- [ ] **Step 1: Import the speed mapper**

Add to imports at the top:

```ts
import { sliderToSpeed, speedToSlider } from '../audio/speed'
```

- [ ] **Step 2: Insert the speed `<Param>` between pitch and filter**

After the existing pitch `<Param>` block (lines 55-61), before the filter `<Param>` block:

```tsx
<Param label="speed" sub="multiplier" value={`${fx.speed.toFixed(2)}x`}>
  <input type="range" min="0" max="1" step="0.001"
    value={speedToSlider(fx.speed)}
    onChange={(e) => update({ speed: sliderToSpeed(Number(e.target.value)) })}
    className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
  <Slider value={speedToSlider(fx.speed)} neutralCenter />
  <Range left="0.5×" right="2.0×" centerHint="1.0×" />
</Param>
```

Update the file's ABOUTME header at the top from "four parameter panels" to "five parameter panels":

```ts
// ABOUTME: EffectsRack — five parameter panels for bit depth, sample rate, pitch, speed, and filter.
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open `http://localhost:5173`, upload audio, navigate to the Effects screen, drag the speed slider. Confirm:
- Slider visually centred at neutral 1.00×.
- Drag right → audio plays back faster, pitch unchanged (vs current behaviour where pitch slider also speeds up).
- Drag left → audio plays back slower, pitch unchanged.
- Set speed to 0.5× and pitch to +12 → audio plays at half speed but an octave higher (the decoupling demo).

- [ ] **Step 5: Commit**

```bash
git add src/screens/EffectsRack.tsx
git commit -m "feat(ui): speed slider in effects rack"
```

---

### Task 16: Components-gallery: frozen "speed" example

**Files:**
- Modify: `src/dev/components-gallery.tsx`

- [ ] **Step 1: Add the example**

Find the existing pitch example (`src/dev/components-gallery.tsx:38`) and add a sibling `<Param>` for speed with a frozen value such as `1.25x`. Mirror the pitch example's structure.

- [ ] **Step 2: Smoke test**

Run: `npm run dev`, visit `http://localhost:5173/?gallery=1`, confirm the speed example renders.

- [ ] **Step 3: Commit**

```bash
git add src/dev/components-gallery.tsx
git commit -m "docs(gallery): frozen speed slider example"
```

---

### Task 17: Integration tests — THD, transient, stereo, filter-chain

**Files:**
- Modify: `tests/integration/wsola-stretch.spec.ts`

- [ ] **Step 1: Add THD-at-0.5×**

Append to `tests/integration/wsola-stretch.spec.ts`:

```ts
test('THD at 0.5x speed on a 220 Hz sine is below 1.5%', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async () => {
    const sr = 48000
    const dur = 0.5
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      effects: { bitDepth: 16, sampleRateHz: sr, pitchSemitones: 0, speed: 0.5, filterValue: 0 },
      trim: { startSec: 0, endSec: dur },
    })
  })

  // Cheap THD proxy: the dominant zero-cross frequency is ~220 Hz, and the
  // signal smoothed by a 4-tap moving average retains ≥98% rms (no high-freq
  // junk from splice clicks).
  const buf = result.pcm[0]
  let crossings = 0
  for (let i = 1; i < buf.length; i++) if (buf[i - 1] <= 0 && buf[i] > 0) crossings++
  const f = (crossings * 48000) / buf.length
  expect(f).toBeGreaterThan(215)
  expect(f).toBeLessThan(225)

  let rmsRaw = 0
  for (let i = 0; i < buf.length; i++) rmsRaw += buf[i] * buf[i]
  rmsRaw = Math.sqrt(rmsRaw / buf.length)

  let rmsSm = 0
  for (let i = 4; i < buf.length; i++) {
    const s = (buf[i] + buf[i - 1] + buf[i - 2] + buf[i - 3]) / 4
    rmsSm += s * s
  }
  rmsSm = Math.sqrt(rmsSm / (buf.length - 4))
  // If THD < 1.5%, the moving average preserves ≥98% of energy.
  expect(rmsSm / rmsRaw).toBeGreaterThan(0.985)
})
```

- [ ] **Step 2: Add transient-localisation**

```ts
test('transient localisation: a click at speed=2 stays narrow', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async () => {
    const sr = 48000
    const dur = 0.2
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    ch[0] = 1.0 // dirac at the start of the trim window
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      effects: { bitDepth: 16, sampleRateHz: sr, pitchSemitones: 0, speed: 2, filterValue: 0 },
      trim: { startSec: 0, endSec: dur },
    })
  })

  const buf = result.pcm[0]
  // Find peak; FWHM (full width at half max) in samples.
  let peakIdx = 0, peakVal = 0
  for (let i = 0; i < buf.length; i++) if (Math.abs(buf[i]) > peakVal) { peakVal = Math.abs(buf[i]); peakIdx = i }
  let lo = peakIdx
  while (lo > 0 && Math.abs(buf[lo]) > peakVal / 2) lo--
  let hi = peakIdx
  while (hi < buf.length - 1 && Math.abs(buf[hi]) > peakVal / 2) hi++
  const fwhmSamples = hi - lo
  const fwhmMs = (fwhmSamples / 48000) * 1000
  expect(fwhmMs).toBeLessThan(4)
})
```

- [ ] **Step 3: Add stereo-symmetry-at-non-neutral**

```ts
test('stereo symmetry preserved at speed=0.7, pitch=+3', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async () => {
    const sr = 48000
    const dur = 0.2
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch), Array.from(ch)],
      sampleRate: sr,
      effects: { bitDepth: 16, sampleRateHz: sr, pitchSemitones: 3, speed: 0.7, filterValue: 0 },
      trim: { startSec: 0, endSec: dur },
    })
  })

  expect(result.pcm.length).toBe(2)
  for (let i = 0; i < result.pcm[0].length; i++) {
    expect(result.pcm[0][i]).toBe(result.pcm[1][i])
  }
})
```

- [ ] **Step 4: Add filter-chain-still-attenuates**

```ts
test('downstream filter still attenuates at non-neutral stretch', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async () => {
    const sr = 48000
    const dur = 0.3
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 8000 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      effects: { bitDepth: 16, sampleRateHz: sr, pitchSemitones: -3, speed: 0.7, filterValue: -1 },
      trim: { startSec: 0, endSec: dur },
    })
  })

  const inputRms = 0.5 / Math.sqrt(2)
  let outRms = 0
  for (let i = 0; i < result.pcm[0].length; i++) outRms += result.pcm[0][i] ** 2
  outRms = Math.sqrt(outRms / result.pcm[0].length)
  const attenuationDb = 20 * Math.log10(outRms / inputRms)
  expect(attenuationDb).toBeLessThan(-12)
})
```

- [ ] **Step 5: Run all integration tests**

Run: `npm run test:integration`
Expected: PASS — five tests in `wsola-stretch.spec.ts` plus the two existing suites.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/wsola-stretch.spec.ts
git commit -m "test(integration): WSOLA THD, transient, stereo, filter-chain"
```

---

### Task 18: E2E speed slider

**Files:**
- Create: `tests/e2e/speed-slider.spec.ts`

- [ ] **Step 1: Test 1 — slider updates store and engine**

```ts
import { test, expect } from '@playwright/test'
import path from 'path'

test('speed slider drives playback speed', async ({ page }) => {
  await page.goto('/')

  // Upload a file. The Home screen has a file input; the existing e2e
  // tests/e2e/upload-and-export.spec.ts shows the pattern. Reuse the
  // same WAV fixture if one exists; otherwise inject a synthetic one.
  // For this assertion we just need a long-enough audio source.
  const fixture = path.resolve(__dirname, '../fixtures/short.wav')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(fixture)

  // Navigate to effects, set speed=0.5
  await page.goto('/#effects')
  // The 4th slider on this screen is the speed slider (between pitch and filter).
  // We rely on the displayed value text to verify.
  await expect(page.getByText('1.00x')).toBeVisible()
  // Use evaluate to set the slider value directly (range input).
  await page.locator('input[type="range"]').nth(3).evaluate((el: HTMLInputElement) => {
    el.value = '0' // slider 0 → 0.5x
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.getByText('0.50x')).toBeVisible()
})
```

If `tests/fixtures/short.wav` does not exist, list `tests/fixtures/` and substitute whatever WAV is present (the existing `tests/e2e/upload-and-export.spec.ts` will reveal the pattern).

- [ ] **Step 2: Test 2 — full pipeline render with speed**

This requires reading the rendered exported WAV. The existing `tests/e2e/upload-and-export.spec.ts` already exercises the export flow; mirror it. After exporting, decode the WAV via `AudioContext.decodeAudioData` in a `page.evaluate` and assert `decoded.duration ≈ 2 × original.duration` (within 5%) and dominant frequency ≈ 2× source.

```ts
test('render at speed=0.5, pitch=+12 produces 2x duration and 2x pitch', async ({ page }) => {
  await page.goto('/')
  // upload, navigate, set speed and pitch sliders, render, read export.
  // ... (mirror the existing upload-and-export e2e test for the upload-and-render
  //     flow; add slider drives for speed=0.5 and pitch=+12 before triggering
  //     the render.)
  // Assertions:
  //   exported.duration ≈ 2 * source.duration (±5%)
  //   peak FFT bin / source peak FFT bin ≈ 2.0 (±5%)
})
```

(Implementation detail of the existing render trigger flow needs to be looked up in the live `tests/e2e/upload-and-export.spec.ts`; do not stub.)

- [ ] **Step 3: Run e2e**

Run: `npm run test:e2e`
Expected: both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/speed-slider.spec.ts
git commit -m "test(e2e): speed slider drives playback and render"
```

---

### Task 19: Final verification gate

**Files:** none modified.

- [ ] **Step 1: Full CI mirror, locally**

Run, in order, and confirm each passes:

```bash
npm run typecheck
npm test
npm run build
npm run test:integration
npm run test:e2e
```

- [ ] **Step 2: Manual smoke**

Run `npm run dev`. Confirm:
- Upload an audio file.
- Set speed=0.5, pitch=+12 → audio plays for ~2× the original duration at +1 octave.
- Render → exported WAV downloads, file plays back at the modified speed/pitch.
- Pause, drag the trim handles while paused, resume → playback resumes correctly.
- Move speed slider mid-playback → no audible glitch, pitch holds.
- Set speed=1, pitch=0 (neutral) → audio is byte-identical to the source within float epsilon (already verified in §7.2 integration).

- [ ] **Step 3: Open the spec and plan side-by-side, walk every claim against the code**

Confirm every "Files touched" line in the spec §8 matches what was actually committed (`git log --stat origin/main..HEAD`).

- [ ] **Step 4: Open PR**

The PR description should reference the spec at `docs/superpowers/specs/2026-04-29-time-stretch-worklet-design.md` and call out the merge gate (the parity test in `tests/integration/wsola-stretch.spec.ts`).

---

## Recovery and rollback notes

- **If WSOLA quality is below threshold on real audio (despite tests passing):** the most likely lever is `SEARCH_DELTA` (currently 128). Doubling to 256 typically halves remaining splice artifacts at the cost of ~2× search CPU. Adjust the constant in `wsola.worklet.ts` and re-run `npm run test:integration`.
- **If the parity test fails by more than one block:** spec §5.7 risk #3 explicitly allows re-spec. Stop, write up the latency source, and bring it back through the brainstorming skill to decide whether the parity guarantee weakens to "perceptually identical to within X dB" or whether the bypass needs a different shape (e.g., engine-level swap between BufferSource and worklet at neutral).
- **If a future feature needs to address `pitchSemitones` directly without speed:** the engine already separates them. No changes to the worklet protocol needed.
- **To revert this change cleanly:** revert the entire range of commits on this branch (Task 1 through Task 18). The store-side `normalize()` is harmless on its own and can be left in place after revert if desired; existing records will round-trip through it without change.
