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

**Pause/resume:**

- `pause()`: compute `pausedSourceTimeSec = getCurrentSourceTimeSec(trim)`; clear `isPlaying`; post `{type:'pause'}` to the worklet (which holds its `readPos` and emits silence).
- `play()` from a paused state: set `playStartedAtSrcSec = pausedSourceTimeSec`, `playStartedAt = ctx.currentTime`, set `isPlaying`; post `{type:'play', offsetSec: pausedSourceTimeSec, trim, fx}`. The worklet resumes from the same `readPos` it was holding (the `offsetSec` is mainly a safety re-anchor in case the engine and worklet drifted while paused).

The shape mirrors today's `engine.ts:46`/`:82`, but every accumulator is in *source-time* rather than wall-time. There is no place that mixes the two.

**Engine and worklet wrap independently** — the worklet wraps `readPos` modulo the trim span (the actual sample read), while the engine wraps its predictor (the UI position). Both must wrap or they desync. The `position` message (every ~20 ms, §5.6) is the reconciliation channel; brief disagreement near a wrap boundary is acceptable for UI purposes.

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

`ExportRecord.fxSnapshot: EffectParams` — pre-existing records on disk lack `speed`. Read-time normalisation in `listExports`, applied at every read so callers always see a fully-typed `EffectParams`:

```ts
function normalize(rec: ExportRecord): ExportRecord {
  return rec.fxSnapshot.speed !== undefined
    ? rec
    : { ...rec, fxSnapshot: { speed: 1, ...rec.fxSnapshot } }
}
```

`toggleStarred` (`src/store/exports.ts:84`) reads the raw record from IDB and re-puts it; it must call `normalize()` before the `put` so the user touching a star also opportunistically writes back the new field. Without this step, starred records would round-trip un-migrated and the `EffectParams` type would be lying about disk state.

No IDB schema bump. Read-time normalisation is the binding migration path; the `toggleStarred` write-back is a best-effort opportunistic upgrade. No "replay-from-snapshot" feature exists today, so `fxSnapshot` is descriptive metadata and this is sufficient.

## 5. Worklet internals (`src/audio/worklets/wsola.worklet.ts`)

**Revision 2026-04-29:** the original spec described a hand-rolled WSOLA. Two implementation iterations confirmed that hand-rolling pitch-preserving stretch is materially harder than the spec suggested — pure-sine pitch tests failed under the canonical OLA + cross-correlation pattern at the depth the spec specified, and the multi-week DSP work needed to land it (phase locking, transient detection, multi-resolution analysis) is out of scope for this PR. Pivoting to the option ranked C in brainstorming: **wrap [`@soundtouchjs/audio-worklet`](https://www.npmjs.com/package/@soundtouchjs/audio-worklet) (or the underlying `soundtouchjs` package — implementer picks at install time) inside our own worklet.**

The file name `wsola.worklet.ts` is retained for git-history continuity even though the algorithm is now SoundTouch's WSOLA implementation rather than ours.

### 5.1 Algorithm

SoundTouch is a mature WSOLA-family time-stretch / pitch-shift library. We wrap it; we don't reimplement it. Our worklet is a thin shim that:

1. Owns the source `AudioBuffer` (transferred via `port.postMessage` once at load).
2. Advances a logical `readPos` through the buffer (with loop/trim semantics — same as before).
3. Feeds chunks of input from `readPos` into the SoundTouch instance.
4. Pulls processed output from SoundTouch and writes to the worklet output.
5. Exposes the existing message protocol (load/play/pause/seek/setTrim/setFx/unload + `position` back to main).

Pitch and speed are independent at the SoundTouch level — set `pitchSemitones` and `tempo` (where `tempo = speed`) on the instance; SoundTouch handles the rest.

### 5.2 Parameters

SoundTouch's parameters (frame, hop, search window) are internal. We set only:

- `pitchSemitones: number` — directly from `EffectParams.pitchSemitones` (-12..+12).
- `tempo: number` — directly from `EffectParams.speed` (0.5..2.0). SoundTouch's "tempo" is our "speed": tempo=2 plays twice as fast (output is half as long), tempo=0.5 plays half as fast (output is twice as long).

If the chosen package exposes additional knobs (e.g. `quickSeek`, `useAntiAliasFilter`), v1 leaves them at defaults.

### 5.3 Per-block process

```
neutral_path:
  if speed === 1 && pitchSemitones === 0:
    copy buffer[readPos..readPos+128] to output, advance readPos by 128
    return

stretch_path:
  while soundtouch has < 128 samples available to extract:
    feed soundtouch a chunk of input from buffer at readPos
      (chunk size = e.g. 256 input samples; advance readPos by chunk size,
       wrapping at trim boundaries)
  extract 128 samples from soundtouch, write to output
```

The neutral fast-path stays as-is — same byte-identical bypass guarantee as before.

### 5.4 Worklet state (per processor instance)

- `inputChannels: Float32Array[]` — the loaded buffer.
- `readPos: number` — fractional, in input samples. Advanced by the chunk size when feeding SoundTouch.
- `soundtouch: SoundTouchInstance` — the wrapped library object. Recreated on `load`, params updated on `setFx`.
- `playState: 'idle' | 'playing' | 'paused'`.
- `trim: {startSec, endSec}`, `speed`, `pitchFactor` — current params (pitchFactor cached only for neutral check).

### 5.5 Loop / trim

Loop wrap happens in the *feed* stage: when feeding SoundTouch, if a chunk would cross `trimEnd`, split it — feed the head of the chunk before the boundary, advance `readPos` to `trimStart`, feed the tail. Same wall-clock looping behaviour as today's `BufferSource.loop = true`.

When the user changes trim mid-play, the engine clamps `readPos` into the new window via `setTrim`.

### 5.6 Message protocol

| Direction | Type | Payload | Notes |
|---|---|---|---|
| → worklet | `load` | `{channels: Float32Array[], sampleRate}` | Transferable. Replaces any prior buffer. Re-creates the SoundTouch instance. |
| → worklet | `play` | `{offsetSec, trim, fx}` | Begins emitting. |
| → worklet | `pause` | `{}` | Outputs silence; holds `readPos`. |
| → worklet | `seek` | `{sourceTimeSec}` | Sets `readPos`. Calls SoundTouch's `clear()`/`flush()` if available (drops internal buffers) to avoid stale samples. |
| → worklet | `setTrim` | `{trim}` | Clamps `readPos` into the new window. |
| → worklet | `setFx` | `{fx}` | Sets `soundtouch.pitchSemitones` and `soundtouch.tempo`. New values take effect at the next feed. |
| → worklet | `unload` | `{}` | Drops references. |
| ← main | `position` | `{readPosSec}` | Emitted every ~20 ms. Main thread uses it to *correct* drift in its own `ctx.currentTime × speed` predictor; the predictor remains the primary clock for sub-frame UI smoothness. |

### 5.7 Known risks

1. **SoundTouch latency.** SoundTouch buffers internally; output for the first N samples after `play` may be silence while the input pipe primes. The plan/tests treat this as a documented startup priming offset (currently 1 × 128-sample block; bump to 2–4 if SoundTouch's measured latency demands it). Surfaced in the `PRIMING_BLOCKS` constant in `tests/unit/wsola.test.ts`.
2. **Neutral path must match BufferSource output.** Same guarantee as before — the neutral fast-path bypasses SoundTouch entirely. The §7.2 render-parity integration test is the binding merge gate.
3. **Library bundle size.** `soundtouchjs` is ~50 KB minified. Acceptable for a PWA (already shipping React + Zustand + idb). Document in PR.
4. **Package choice.** Two candidates: `soundtouchjs` (general-purpose) and `@soundtouchjs/audio-worklet` (purpose-built worklet wrapper, may eliminate some integration code). Implementer picks at install time based on what npm publishes and whether the worklet variant works inside Vite's `?worker&url` pipeline.

## 6. Math

(Removed in revision 2026-04-29: hand-rolled stretch/pitch decomposition no longer applies. SoundTouch's internal algorithm is referenced in their docs.)

## 7. Tests

### 7.1 Unit (`tests/unit/wsola.test.ts`, vitest + Node via `processor-shim.ts`)

The shim already exists; `bitcrusher.test.ts` and `srhold.test.ts` instantiate processors directly in Node. Same pattern.

| Test | Assertion |
|---|---|
| neutral fast-path is sample-identical | At `speed=1, pitch=0`: feed a 4096-sample ramp; after a startup-priming offset of at most one 128-sample block (documented as a constant in the test), output samples equal input samples within float epsilon. |
| stretch length is sustained at 0.5× | At `speed=0.5` on a 4096-sample sine: drain 8192 output samples; assert RMS is sustained in both halves of the output (signal continues past natural input length, demonstrating stretch). |
| stretch loops at 2× | At `speed=2`: drain 4096 output samples; assert RMS is sustained both before and after the input loop wraps (~2048 samples). |
| pitch shift via SoundTouch | At `speed=1, pitch=+12` on 220 Hz sine: dominant frequency in mid-window output is 420–460 Hz. |
| pitch + stretch decoupled | At `speed=0.5, pitch=+12` on 220 Hz sine: dominant frequency is 420–460 Hz AND output extends past natural input length. |
| loop wrap | With trim `{0.4s, 0.6s}` at speed=1: 4 trim spans of output show repeated content. |
| `setFx` mid-process | Send `{speed: 1.5}` between two `process()` calls; assert no zero-fill, no abnormal silence, signal continues. |
| pause emits silence | After `pause` message, output is all zeros until next `play`. |
| seek drops stale state | After `seek` to a new position, no carry-over splice (first sample magnitude < 0.05 and step-to-step change < 0.05 over priming window). |
| position messages emitted | Worklet emits `{type: 'position'}` periodically while playing; none while paused. |
| pure functions (`src/audio/speed.ts`) | `sliderToSpeed`/`speedToSlider` round-trip; identity at 0.5 → 1.0; endpoints. |

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

- `package.json` / `package-lock.json` — add `soundtouchjs` (or `@soundtouchjs/audio-worklet`) dependency.
- `src/audio/worklets/wsola.worklet.ts` — new (~150 lines: thin wrapper around the chosen SoundTouch package)
- `src/audio/speed.ts` — new (~10 lines, `sliderToSpeed` / `speedToSlider`, mirrors `pitch.ts`)
- `src/audio/types.ts` — add `speed`
- `src/audio/graph.ts` — register `wsola`; remove `applyPitch` and `setSource`; add `loadBuffer`; rebuild offline path
- `src/audio/engine.ts` — replace `currentSource` with `player`; reshape position math; port-message `play`/`pause`/`seek`/`setTrim`/`setFx`/`unload`
- `src/audio/pitch.ts` — keep; consumer moves to inside the worklet
- `src/store/session.ts` — `defaultEffects.speed = 1`
- `src/store/exports.ts` — read-time `speed: 1` normalisation in `listExports`; opportunistic write-back through `toggleStarred`
- `src/screens/EffectsRack.tsx` — fifth slider
- `src/screens/RenderModal.tsx` — duration display reads `/ speed` not `/ pitchRate`
- `src/dev/components-gallery.tsx` — frozen "speed" example
- `tests/unit/wsola.test.ts` — new
- `tests/unit/speed.test.ts` — new (3 cases)
- `tests/integration/runner.ts` — accept `speed` in payload
- `tests/integration/filter-attenuation.spec.ts`, `tests/integration/stereo-symmetry.spec.ts` — pass `speed: 1` in any `EffectParams` literals so they typecheck against the new shape
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
