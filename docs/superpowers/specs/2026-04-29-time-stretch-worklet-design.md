# Time-Stretch Worklet — Independent Speed and Pitch

**Status:** design approved 2026-04-29
**Owner:** dw
**Replaces:** the playbackRate-coupled pitch path described in `../../../../imakeheat/docs/superpowers/specs/2026-04-28-imakeheat-pwa-design.md` lines 102 / 135 / 152
**Touches:** `src/audio/`, `src/store/session.ts`, `src/screens/EffectsRack.tsx`, the four test layers

---

## 1. Problem

Today, the pitch slider is implemented as `bufferSource.playbackRate.value = 2^(semi/12)` (`src/audio/graph.ts:60`, `:87`). That gives "honest tape-varispeed" — moving pitch also changes duration. There is no way to stretch a clip in time without also changing its pitch. The original design (line 733) lists "duration-preserving pitch shift (WSOLA via soundtouchjs worklet)" as the v2 direction. This spec is that v2.

After this change:

- A clip can be slowed to half speed without dropping in pitch.
- A clip can be pitched up an octave without halving in duration.
- Setting both knobs together still gives the tape-varispeed sound (it's just no longer the *only* mode).

## 2. Non-goals

- **Wider-than-octave range.** ±1 octave (0.5×–2.0×) for speed; ±12 semitones for pitch. Wider ranges sound rough through a hand-rolled WSOLA without further work.
- **A "tape mode" toggle.** Tape-varispeed is recoverable by moving both knobs together. No mode switch. A future "link" gesture is YAGNI for v1.
- **Phase-locking, transient detection, multi-resolution STFT.** Standard WSOLA only. The v1 quality target is "good enough for short loop-style material at moderate stretch".
- **A user-exposed quality knob** (frame size, search window, overlap). Compile-time constants for v1.
- **Replay-from-snapshot of archived exports.** Existing `ExportRecord.fxSnapshot` becomes mildly out of date (no `speed` field on pre-existing records); we read-time migrate to `speed: 1` rather than running an IDB upgrade.
- **Reworking the recorder.** Recording captures at native rate, unchanged.

## 3. UX

A fifth slider is added to `src/screens/EffectsRack.tsx`, between pitch and filter:

| Field | Range | Mapping | Display | Neutral |
|---|---|---|---|---|
| `speed` | 0.5×–2.0× | log (slider 0..1, identity at 0.5) | `0.50x` / `1.00x` / `2.00x` | 1.00× |

The pitch slider's behaviour, range (±12 st), and visual treatment are unchanged. Only its underlying implementation moves from `playbackRate` to the worklet.

**Bypass predicate:** `speed === 1 && pitchSemitones === 0`. The worklet enters a copy-only path on each `process()` block when the predicate is true. No WSOLA, no resample.

`RenderModal` already shows the rendered duration; it now reads `(endSec - startSec) / speed` instead of `/ pitchRate`. This makes the "duration after render" surface — already called out in the original spec line 754 — more honest, not less.

## 4. Architecture

### 4.1 Audio chain

Live and offline, identical:

```
WSOLAPlayer → bitcrusher → srhold → biquad → analyser → destination
```

`AudioBufferSourceNode` is removed from the runtime. The `AudioBuffer`'s channel data is transferred once into the worklet at load time via `port.postMessage({type:'load', channels: Float32Array[], sampleRate}, transferList)`. The buffer is *not* copied; the main thread's reference becomes detached after transfer.

### 4.2 `EffectParams`

`src/audio/types.ts`:

```ts
export interface EffectParams {
  bitDepth: 2 | 4 | 8 | 12 | 16
  sampleRateHz: number
  pitchSemitones: number    // -12..+12, decoupled from speed
  speed: number             // 0.5..2.0, log-mapped on UI
  filterValue: number
}
```

`session.ts` `defaultEffects` gains `speed: 1`; `setSource` resets the whole struct from `defaultEffects` so the new field is reset for free.

### 4.3 Engine state machine (`src/audio/engine.ts`)

| Today | After |
|---|---|
| `currentSource: AudioBufferSourceNode \| null` | `player: WSOLAPlayerNode` (always present after `ensureStarted`) |
| `src.start(0, offset)` / `src.stop()` | port message `play` / `pause` |
| Loop via `src.loop = true; src.loopStart = …; src.loopEnd = …` | Loop logic inside the worklet (`readPos = ((readPos − trim.start) mod span) + trim.start`) |
| `pausedOffsetSec` (wall-time, accumulated across pauses) | `pausedSourceTimeSec` (source-time at the moment of pause) |
| Position: `playStartedAt → ctx.currentTime − playStartedAt` | Position: `playStartedAtSrcSec + (ctx.currentTime − playStartedAt) × speed`, wrapped within trim |
| Render length: `((endSec − startSec) / pitchRate) × sr` (`engine.ts:147`) | Render length: `((endSec − startSec) / speed) × sr` |

Position math:

```ts
getCurrentSourceTimeSec(trim: TrimPoints): number {
  if (!this.ctx) return trim.startSec
  if (!this.isPlaying) return this.pausedSourceTimeSec
  const wall = this.ctx.currentTime - this.playStartedAt
  const pos = this.playStartedAtSrcSec + wall * (this.lastFx?.speed ?? 1)
  const span = trim.endSec - trim.startSec
  if (span <= 0) return trim.startSec
  return trim.startSec + ((pos - trim.startSec) % span + span) % span
}
```

Whenever `setEffect({speed})`, `setTrim(...)`, or `seek(...)` arrives mid-play, the engine snapshots the current source-time into `playStartedAtSrcSec`, resets `playStartedAt = ctx.currentTime`, then sends the corresponding port message. After that the formula reads the new params and stays correct.

### 4.4 `graph.ts` changes

- `applyPitch` is removed (pitch lives in the worklet).
- `applyEffects` no longer touches the source node; it only configures bitcrusher, srhold, biquad.
- `setSource(source)` is removed; the worklet *is* the source. The new `loadBuffer(audioBuffer)` packages channel data and posts the `load` message with a transferList.
- `loadWorklets` registers `wsola` alongside `bitcrusher` and `srhold`.
- `renderOffline` builds the same chain on `OfflineAudioContext`, posts `load` + `play(offsetSec=trim.startSec, trim, fx)` *before* `ctx.startRendering()`.

### 4.5 Store changes

`src/store/session.ts`:

```ts
export const defaultEffects: EffectParams = {
  bitDepth: 16, sampleRateHz: 44100,
  pitchSemitones: 0, speed: 1, filterValue: 0,
}
```

`setSource` is unchanged in shape; it already resets effects from `defaultEffects` plus source sample rate.

### 4.6 IDB / `ExportRecord` migration

`ExportRecord.fxSnapshot: EffectParams` — pre-existing records on disk lack `speed`. Read-time migration in `listExports`/`getExport`:

```ts
function normalize(rec: ExportRecord): ExportRecord {
  return rec.fxSnapshot.speed !== undefined
    ? rec
    : { ...rec, fxSnapshot: { speed: 1, ...rec.fxSnapshot } }
}
```

No IDB schema bump. Records are written back with the new field only when the user touches them (e.g., `toggleStarred`). No explicit "replay these settings" feature exists today, so the field is descriptive metadata and read-time normalisation is sufficient.

## 5. Worklet internals (`src/audio/worklets/wsola.worklet.ts`)

### 5.1 Algorithm

Standard WSOLA, with pitch shift composed as stretch + linear resample:

1. WSOLA-stretch the input by `S = pitchFactor / speed` where `pitchFactor = 2^(semi/12)`.
2. Linearly resample the result by `1/pitchFactor`.

Net mapping: `output_length = input_length / speed`, `output_pitch_ratio = pitchFactor`. (Worked through the math in §6.)

### 5.2 Parameters (compile-time constants)

| Parameter | Value | Rationale |
|---|---|---|
| Frame size `N` | 1024 samples (~21 ms @ 48 k) | Long enough for periodicity in low-mid; short enough to keep transients localised. Power of two. |
| Synthesis hop `Hs` | 256 samples (75% overlap) | High overlap masks splice artifacts at low speed. ~0.5 ms per audio block at 1024-frame `N`. |
| Analysis hop `Ha` | `Hs / S` | Standard WSOLA: read at `Ha`, write at `Hs`, ratio is the stretch. |
| Search window `±Δ` | ±128 samples | Cross-correlate over this range to find the analysis frame whose head best matches the tail of the previous synthesis frame. SoundTouch-region tuning. |
| Window | Hann, precomputed once at processor construction | Standard. At 75% overlap not partition-of-unity; we divide the running sum by a precomputed windowed-overlap envelope. |
| Similarity metric | Normalised cross-correlation, channel-summed | Cheaper than coherence; normalisation avoids amplitude-envelope bias. |

### 5.3 Per-block process

```
neutral_path:
  if speed === 1 && pitchSemitones === 0:
    copy buffer[readPos..readPos+128] to output, advance readPos by 128
    return

stretch_path:
  while output_buffer has < 128 samples queued:
    1. find best analysis frame: normalised cross-correlation of
       input[expectedReadPos ± Δ] against the tail of the previously-
       written synthesis frame. expectedReadPos = lastReadPos + Ha.
    2. window the chosen analysis frame with Hann.
    3. overlap-add into the output ring buffer at writePos; writePos += Hs.
    4. lastReadPos = chosen position.
  if pitchFactor !== 1:
    linearly resample 128 samples from the OLA ring buffer at rate 1/pitchFactor
    into output. Keep the fractional read index between blocks.
  else:
    copy 128 samples directly from OLA ring buffer.
```

### 5.4 Worklet state (per processor instance)

- `inputChannels: Float32Array[]` — the loaded buffer, never freed until next `load`
- `readPos: number` (fractional, in input samples) — advanced by `Ha` per analysis frame
- `olaRing: Float32Array[]` per channel — circular accumulator, length `2N`
- `olaReadPos: number` (fractional) — for the resample step
- `prevTail: Float32Array` per channel — last `Δ` samples written, the cross-correlation target
- `playState: 'idle' | 'playing' | 'paused'`
- `trim: {startSec, endSec}`, `speed`, `pitchFactor` — current params
- `windowEnvelope: Float32Array` — precomputed sum of overlapping Hanns at current `Hs`, divided out at frame finalisation

### 5.5 Loop / trim

The worklet wraps `readPos` modulo the trim span: when `readPos >= trim.endSec * sr`, subtract `(trim.endSec − trim.startSec) * sr`. Wraps within a single block are possible at high speeds; handle in a `while` loop. When the user changes trim mid-play, the engine clamps `readPos` into the new window via `setTrim`.

### 5.6 Message protocol

| Direction | Type | Payload | Notes |
|---|---|---|---|
| → worklet | `load` | `{channels: Float32Array[], sampleRate}` | Transferable. Replaces any prior buffer. |
| → worklet | `play` | `{offsetSec, trim, fx}` | Begins emitting. |
| → worklet | `pause` | `{}` | Outputs silence; holds `readPos`. |
| → worklet | `seek` | `{sourceTimeSec}` | Sets `readPos`; drops `olaRing` and `prevTail` to silence; one-time fade-in over `N` samples to avoid click. |
| → worklet | `setTrim` | `{trim}` | Clamps `readPos` into the new window. |
| → worklet | `setFx` | `{fx}` | Recomputes `S` and `pitchFactor`. New `Ha` takes effect at the *next* analysis frame; the in-flight synthesis frame still completes (no zero-fill, no glitch). |
| → worklet | `unload` | `{}` | Drops references. |
| ← main | `position` | `{readPosSec}` | Emitted every ~20 ms. Main thread uses it to *correct* drift in its own `ctx.currentTime × speed` predictor; the predictor remains the primary clock for sub-frame UI smoothness. |

### 5.7 Known risks (called out for testing)

1. **Splice clicks at `speed < 0.7`.** The cross-correlation search is the only thing keeping the OLA from sounding like a digital chorus in this region. The ±128-sample search window is tuned for it. Tested directly in §7.2.
2. **Pitch-shift quantisation.** Linear interpolation is fine for ±12 st (max factor 2). No need for cubic or sinc unless integration tests show audible aliasing — which they will not at this range.
3. **Neutral path must match BufferSource output.** The bypass story depends on the neutral fast-path producing audio indistinguishable from the current `BufferSource → …` path. If this is not byte-identical (e.g., a 128-sample latency we haven't accounted for), the spec's parity test escalates from "byte-identical" to "perceptually identical to within X dB" and we revisit.

## 6. Math: pitch + stretch decomposition

Goal: `output_length = input_length / speed`, `output_pitch = pitchFactor × input_pitch`.

Define:
- Resample by ratio `P` → output length = input length × `P`, output pitch ratio = `1/P`.
- WSOLA-stretch by ratio `S` → output length = input length × `S`, output pitch ratio = `1`.

Apply WSOLA-stretch by `S` then resample by `P`:
- length: `L × S × P`
- pitch: `1 × 1 × (1/P) = 1/P`

Want pitch = `pitchFactor` ⇒ `P = 1/pitchFactor`.
Want length = `L/speed` ⇒ `L × S × P = L/speed` ⇒ `S = pitchFactor / speed`.

Worst-case WSOLA stretch magnitude (max(`S`, `1/S`)) at `speed=0.5, pitch=+12`: `S = 4`. This is the algorithm's worst regime in our supported range; §7.2 tests THD specifically here.

## 7. Tests

### 7.1 Unit (`tests/unit/wsola.test.ts`, vitest + Node via `processor-shim.ts`)

The shim already exists; `bitcrusher.test.ts` and `srhold.test.ts` instantiate processors directly in Node. Same pattern.

| Test | Assertion |
|---|---|
| neutral fast-path is sample-identical | At `speed=1, pitch=0`: feed a 4096-sample ramp, output equals input within float epsilon |
| stretch length is correct | At `speed=0.5`, feed `N` samples → expect `2N` samples out (within ±1 frame); at `speed=2`, expect `N/2` |
| pitch shift, no stretch | At `speed=1, pitch=+12` on 220 Hz sine: peak FFT bin shifts to 440 Hz |
| pitch + stretch combined | At `speed=0.5, pitch=+12` on 220 Hz: output is 2× as long *and* peaks at 440 Hz — proves decoupling |
| WSOLA cross-correlation finds the right offset | Synthetic input where the "right" splice is known by construction; chosen `analysisPos` within ±2 samples of the analytical answer |
| loop wrap | `readPos` near `trim.endSec` wraps cleanly; output across the wrap point has no discontinuity > 1e-3 normalised step |
| `setFx` mid-process | Send `{speed: 1.5}` between two `process()` calls; assert no zero-fill, no doubled samples, length math reflects the new rate from the next analysis frame |
| pure functions (`src/audio/speed.ts`) | `sliderToSpeed`/`speedToSlider` round-trip; identity at 0.5 → 1.0; endpoints |

### 7.2 Integration (`tests/integration/wsola-stretch.spec.ts`, Playwright + real OfflineAudioContext)

Extends `tests/integration/runner.ts` to take `speed` in `EffectParams` and exercise the worklet on a real `OfflineAudioContext`.

| Test | Assertion |
|---|---|
| **render parity at neutral** | Render a complex synthetic signal (mix of sines + a click transient) at `(speed=1, pitch=0)`. Sample-by-sample equality (within float epsilon) against the same signal rendered through a *frozen-in-fixture copy* of the old `renderOffline`. The bypass-correctness guarantee. |
| **THD at 0.5× speed, sine input** | Render 220 Hz sine at `speed=0.5`. THD < 1.5%. Catches splice-click regressions. |
| **transient localisation** | Render a click (Kronecker delta) followed by silence at `speed=2`. Click remains < 4 ms FWHM in the output. Catches over-aggressive overlap-add. |
| **stereo symmetry** | L=R signal at non-neutral settings → L and R outputs sample-identical. Mirrors `tests/integration/stereo-symmetry.spec.ts`. |
| **filter chain still attenuates** | At `speed=0.7, pitch=−3` with full LP, HF attenuation matches the bound in `tests/integration/filter-attenuation.spec.ts`. |

### 7.3 E2E (`tests/e2e/speed-slider.spec.ts`, Playwright on dev server)

| Test | Assertion |
|---|---|
| Upload → preview → move speed slider → audio still playing, position advances at the changed rate (read store) | UI ↔ engine wiring |
| Upload → set `speed=0.5, pitch=+12` → render → exported WAV has duration ≈ 2× source and main pitch peak at 2× source frequency | Whole pipeline end-to-end |

## 8. Files

- `src/audio/worklets/wsola.worklet.ts` — new (~250 lines)
- `src/audio/speed.ts` — new (~10 lines, `sliderToSpeed` / `speedToSlider`, mirrors `pitch.ts`)
- `src/audio/types.ts` — add `speed`
- `src/audio/graph.ts` — register `wsola`; remove `applyPitch` and `setSource`; add `loadBuffer`; rebuild offline path
- `src/audio/engine.ts` — replace `currentSource` with `player`; reshape position math; port-message `play`/`pause`/`seek`/`setTrim`/`setFx`/`unload`
- `src/audio/pitch.ts` — keep; consumer moves to inside the worklet
- `src/store/session.ts` — `defaultEffects.speed = 1`
- `src/store/exports.ts` — read-time `speed: 1` normalisation in `listExports`/`getExport`
- `src/screens/EffectsRack.tsx` — fifth slider
- `src/screens/RenderModal.tsx` — duration display reads `/ speed` not `/ pitchRate`
- `src/dev/components-gallery.tsx` — frozen "speed" example
- `tests/unit/wsola.test.ts` — new
- `tests/unit/speed.test.ts` — new (3 cases)
- `tests/integration/runner.ts` — accept `speed` in payload
- `tests/integration/wsola-stretch.spec.ts` — new (5 cases)
- `tests/e2e/speed-slider.spec.ts` — new (2 cases)

**Not touched:** recorder, WAV codec, peaks, biquad, bitcrusher, srhold, the routing layer, three of the four screens (Home, Preview, Exports), the IDB schema.

## 9. Rollout

**Single PR, no feature flag.** Reasons:

- This is a stripe down through every layer (worklet, graph, engine, store, UI, tests). A flag would either gate the whole stripe (long-lived dead path that rots) or leave half live and half flagged (incoherent state).
- The bypass-at-neutral fast-path *is* the de-risk. Existing users who never touch the new slider get behaviour byte-identical to today, verified by §7.2's render-parity test. That is a stronger guarantee than a flag, because a flag protects the *code path* but not the *audio output*.
- CI (`.github/workflows/ci.yml`) already runs typecheck → unit → build → integration → e2e on every PR. All four gates apply automatically.
- Idiom-match: bitcrusher and srhold worklets shipped without flags; same shape of change.

**Merge gate:** §7.2 render-parity must pass byte-identically. If it cannot (e.g., a 128-sample latency in the worklet that BufferSource didn't have), the parity guarantee weakens to "perceptually identical within X dB" and the spec is revisited before merge — not merged with a known parity gap.
