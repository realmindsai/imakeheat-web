# Pedalboard Effects — Design

**Date:** 2026-04-30
**Status:** Draft
**Repo:** `imakeheat-web`
**Tagged baseline:** `v1` (commit `aea2021`) — pre-refactor checkpoint

## 1. Goal

Replace the hard-wired five-effect graph with a **programmable effects chain** where the user can add, remove, and reorder effects from a registry. Order matters: the same effects in different orders produce audibly different results, which is the entire point of an SP-404-style instrument.

This is the foundation work that enables a growing effect catalog over time. The initial v2 catalog is six effects:

- **Refactored from v1** (no DSP changes, only repackaging): Crusher, Sample-rate hold, Pitch, Filter
- **Ported from Android** (`../archive/IMakeHeat/app/src/main/java/com/dewoller/imakeheat/audioeffects/`): Echo, Reverb

Future SP-404MK2 effects (the other 39 catalogued in `~/Downloads/SP-404mk2_effects_reference.md`) become a roadmap, added in batches of 2–3 per release once the pedalboard architecture is shipping.

## 2. Non-goals (v2)

- Tempo / BPM-sync effects. The app has no global BPM; sync params (1/32, 1/16, …) are deferred.
- Live MIDI input. Rules out Vocoder, Harmony, Auto Pitch, and other INPUT FX exclusives.
- Performance-gesture effects (DJFX Looper, Back Spin, Scatter, Stopper, Downer, To-Gu-Ro). They don't fit the offline-render model and would need a different UX.
- Effect-node reuse across chain reorders. Echo/reverb tail buffers reset on every chain rebuild. Acceptable tradeoff; revisit only if it bothers anyone.
- The other 39 SP-404 effects. Catalog growth is explicitly post-v2.

## 3. Architecture

Three layers, mirroring the existing project structure (`src/audio/`, `src/store/`, `src/screens/`).

### 3.1 Data model

The session store gains an ordered chain of slots. The current flat `EffectParams` interface is replaced.

```ts
// src/audio/effects/types.ts
export type EffectKind =
  | 'crusher' | 'srhold' | 'pitch' | 'filter'   // refactored from v1
  | 'echo' | 'reverb'                            // new

export interface SlotBase {
  id: string                  // uuid; stable across reorders for React keys + dnd-kit
  kind: EffectKind
  enabled: boolean            // explicit on/off, separate from "neutral"
}

export type Slot =
  | SlotBase & { kind: 'crusher'; params: { bitDepth: 2|4|8|12|16 } }
  | SlotBase & { kind: 'srhold';  params: { sampleRateHz: number } }
  | SlotBase & { kind: 'pitch';   params: { semitones: number; speed: number } }
  | SlotBase & { kind: 'filter';  params: { value: number } }      // -1..+1
  | SlotBase & { kind: 'echo';    params: { timeMs: number; feedback: number; mix: number } }
  | SlotBase & { kind: 'reverb';  params: { size: number; decay: number; mix: number } }

export type Chain = Slot[]
```

Two design rules:

1. **`enabled` is separate from "neutral".** A slot can be in the chain but explicitly toggled off (eyeball icon, like in DAWs) — distinct from "in the chain but its params happen to land on neutral values." Bypass logic: `!enabled || isNeutral(slot)`. Each effect kind owns its own `isNeutral()` (echo: `mix < 0.05`; bitcrusher: `bitDepth === 16`; etc.).
2. **Pitch and speed share one slot.** They share the WSOLA worklet under the hood; splitting would mean two WSOLA instances per chain.

**Default chain on fresh source** (the v1 chain at neutral values):

```
[ {crusher, 16-bit}, {srhold, source-rate}, {pitch, 0st/1x}, {filter, 0} ]
```

All four enabled, all neutral → output is bit-identical to source until the user moves a slider, exactly like v1.

### 3.2 Effect registry

Each effect is a self-contained module that exports an `EffectDefinition`. The chain engine knows nothing about specific effects; it walks the registry.

```
src/audio/effects/
  types.ts                 # Slot, Chain, EffectKind, EffectDefinition
  registry.ts              # Map<EffectKind, EffectDefinition>
  crusher/{definition.ts, panel.tsx, crusher.test.ts}
  srhold/{definition.ts, panel.tsx, srhold.test.ts}
  pitch/{definition.ts, panel.tsx, pitch.test.ts}
  filter/{definition.ts, panel.tsx, filter.test.ts}
  echo/{definition.ts, panel.tsx, worklet.ts, echo.test.ts}
  reverb/{definition.ts, panel.tsx, worklet.ts, reverb.test.ts}
```

The contract:

```ts
interface EffectDefinition<P> {
  kind: EffectKind
  displayName: string                                   // "Echo", "Reverb"
  defaultParams: P
  isNeutral(p: P): boolean                              // for bypass
  build(ctx: BaseAudioContext, params: P): EffectNode   // sub-graph for this slot
  Panel: React.FC<{ slot: Slot; onChange(patch: Partial<P>): void }>
}

interface EffectNode {
  input: AudioNode
  output: AudioNode
  apply(params: unknown): void                          // live param push, no rebuild
  dispose(): void
}
```

Two guarantees:

- **Live param updates never rebuild the graph.** Sliders push through `apply(params)`. Only add/remove/reorder/enabled-toggle triggers rebuild.
- **Adding an effect is additive.** New folder, one registry line, no cross-cutting changes.

The Echo and Reverb worklets are direct ports of `EchoEffect.kt` and `ReverbEffect.kt` — same circular-buffer logic, same Schroeder topology, same hard caps (`feedback ≤ 0.95`, etc.). Native Web Audio `DelayNode` is **not** used for echo; we stick with the worklet to match the Android character.

### 3.3 Engine — live preview

```ts
// src/audio/engine.ts
class AudioEngine {
  private currentChain: EffectNode[] = []
  private master: GainNode

  rebuildChain(chain: Chain): void {
    // 1. Ramp master to 0 over ~10ms to mask the disconnect click.
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.003)

    // 2. After ramp completes (~15ms), reroute synchronously.
    setTimeout(() => {
      this.currentChain.forEach(n => n.dispose())
      this.currentChain = chain
        .filter(s => s.enabled && !isNeutral(s))
        .map(s => registry.get(s.kind).build(this.ctx, s.params))

      this.player.disconnect()
      let prev: AudioNode = this.player
      for (const node of this.currentChain) { prev.connect(node.input); prev = node.output }
      prev.connect(this.master)

      this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.003)
    }, 15)
  }

  updateSlotParams(slotId: string, params: unknown): void {
    const idx = this.chainSlotIds.indexOf(slotId)
    if (idx >= 0) this.currentChain[idx].apply(params)
  }
}
```

Three rules:

- **Apply-on-release.** Drag-and-drop reorder calls `rebuildChain` *once*, on drag end — not on every `pointermove`. One clean transition per gesture.
- **Bypass-by-omission.** Slots with `!enabled` or `isNeutral(params)` are not connected into the live graph. Reverb at mix=0 costs zero CPU.
- **Full rebuild, no node reuse.** Every chain change disposes and rebuilds. Echo/reverb tail buffers reset; that's the accepted tradeoff for simpler lifecycle code.

The `analyser` node sits at the chain tail (before `master`), so the waveform display always reflects the fully-processed signal regardless of chain length.

### 3.4 Engine — offline render

```ts
// src/audio/graph.ts
const TAIL_PADDING_SEC = 4

export async function renderOffline(
  buffer: AudioBuffer,
  trim: TrimPoints,
  chain: Chain,
): Promise<AudioBuffer> {
  const sourceDur = trim.endSec - trim.startSec
  const speed = getSpeedFromChain(chain) ?? 1
  const baseLen = sourceDur / speed
  const needsTail = chain.some(s =>
    s.enabled && (s.kind === 'echo' || s.kind === 'reverb') && !isNeutral(s)
  )
  const totalLen = baseLen + (needsTail ? TAIL_PADDING_SEC : 0)

  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    Math.ceil(totalLen * buffer.sampleRate),
    buffer.sampleRate,
  )
  await loadWorklets(ctx)

  const nodes = chain
    .filter(s => s.enabled && !isNeutral(s))
    .map(s => registry.get(s.kind).build(ctx, s.params))

  const player = new AudioWorkletNode(ctx, 'wsola')
  await loadBufferIntoPlayer(player, buffer)
  player.port.postMessage({ type: 'play', offsetSec: trim.startSec, trim, chain })

  let prev: AudioNode = player
  for (const node of nodes) { prev.connect(node.input); prev = node.output }
  prev.connect(ctx.destination)

  return ctx.startRendering()
}
```

Three notes:

- **Tail padding is conditional.** No active echo/reverb → render exactly `sourceDur / speed` seconds, identical to v1 length-wise. Existing v1-style exports stay byte-comparable in length.
- **Same `EffectDefinition.build()` for live and offline.** What you preview is what you export — no parallel offline-only DSP path. This is the central guarantee.
- **Speed extraction is centralized.** `getSpeedFromChain()` reads the (single) pitch slot. If pitch is bypassed/absent, speed = 1.

## 4. UI / EffectsRack screen

The flat 5-row screen becomes a slot list:

```
┌─ Effects rack ─────────────── [Reset] ┐
│ ⋮⋮  Crusher           [●] [▼] │  ← drag handle, enabled toggle, expand caret
│     bit depth: 16-bit             │
│     [2][4][8][12][16]             │
│                                    │
│ ⋮⋮  Sample rate       [●] [▼] │
│     ...                            │
│                                    │
│ ⋮⋮  Echo              [●] [▶] │  ← collapsed
│                                    │
│ ⋮⋮  Reverb            [●] [▶] │
│                                    │
│ ┌─ + Add effect ───────────────┐ │
│ │ Crusher · SR-hold · Pitch ·  │ │
│ │ Filter · Echo · Reverb       │ │
│ └──────────────────────────────┘ │
└────────────────────────────────────┘
```

### 4.1 Components

- **`EffectsRack.tsx`** — container. Reads `chain` from store. Wraps slot list in dnd-kit's `<DndContext>` + `<SortableContext>`. `onDragEnd` calls `store.reorderSlot(id, newIndex)` then `engine.rebuildChain(newChain)`.
- **`SlotCard.tsx`** — generic slot wrapper. Renders drag handle, enabled toggle (eyeball icon), expand/collapse caret, remove (×) button. Delegates the body to `def.Panel` from the registry. Default-collapsed for echo/reverb; default-expanded for the four legacy effects (so v1 users see no change).
- **`AddEffectMenu.tsx`** — `+ Add effect` button at the bottom, dropdown listing effects from the registry. Picking one calls `store.addSlot(kind)` → appends to chain with `defaultParams`. Duplicates allowed.

Per-effect panels (`crusher/panel.tsx`, etc.) are responsible only for their own controls. The four legacy panels are lift-and-shift from today's `EffectsRack.tsx`. Echo and reverb panels follow the original spec: three sliders each, **debounced ~300ms** before pushing to the engine. Legacy four don't need debouncing (already cheap param updates).

### 4.2 Reorder UX

**Drag-and-drop via dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable` — ~30kB gzip combined). Mouse and touch supported out of the box. Keyboard: Tab to handle, Space to grab, arrows to move, Space to drop (dnd-kit's built-in keyboard sortable strategy).

### 4.3 Reset

Sets the chain back to the v1 default: four legacy slots, neutral params, echo/reverb absent.

### 4.4 Slider specs (echo/reverb)

| Slider     | min  | max  | step | default |
| ---------- | ---- | ---- | ---- | ------- |
| Echo Time  | 50   | 1000 | 10   | 250     |
| Echo FB    | 0.00 | 0.95 | 0.05 | 0.40    |
| Echo Mix   | 0.00 | 1.00 | 0.05 | 0.00    |
| Reverb Sz  | 0.00 | 1.00 | 0.05 | 0.50    |
| Reverb Dcy | 0.00 | 1.00 | 0.05 | 0.50    |
| Reverb Mix | 0.00 | 1.00 | 0.05 | 0.00    |

### 4.5 Accessibility

Each slot: `aria-label="${displayName}, position ${i+1} of ${n}"`. Each slider: programmatic label per the original spec. Each expand/collapse caret announces its state.

## 5. Persistence

### 5.1 Live chain (localStorage)

Zustand `persist` middleware on `chain` only:

```ts
export const useSessionStore = create<SessionState>()(
  persist((set, get) => ({...}), {
    name: 'imakeheat-chain',
    partialize: (s) => ({ chain: s.chain }),
  })
)
```

- Page reload restores the chain.
- `source`, `playback`, `render`, `engineReady` are session-transient — not persisted.
- When a fresh source loads, the **persisted chain wins** over the v1 default. The user's last setup carries forward.

### 5.2 Exports (IndexedDB) — additive

```ts
interface Export {
  id: string
  createdAt: number
  blob: Blob
  // ...existing fields
  chainConfig?: Chain     // NEW — snapshot at render time, optional for back-compat
}
```

- Forward-compatible additive change. No migration. Old exports read as `chainConfig: undefined`; the UI hides "Restore" for them.
- Each export tile in the Exports screen gets a "Restore settings" button next to play/download/delete. Click → `store.setChain(export.chainConfig)` → engine rebuilds → user lands on the Effects screen with that export's exact chain loaded.

## 6. DSP — Echo & Reverb (algorithmic spec)

These are direct ports of the Android implementation. Algorithms here for self-containment; reference files at `../archive/IMakeHeat/app/src/main/java/com/dewoller/imakeheat/audioeffects/`.

### 6.1 Echo

Single-tap delay with feedback and dry/wet mix.

| Param      | Range     | Default | Units    |
| ---------- | --------- | ------- | -------- |
| `timeMs`   | 50–1000   | 250     | ms       |
| `feedback` | 0.00–0.95 | 0.40    | unitless |
| `mix`      | 0.00–1.00 | 0.00    | unitless |

- `feedback` MUST hard-cap at 0.95. Above that the loop diverges.
- `mix < 0.05` → bypass-eligible (active threshold).
- All setters MUST clamp to range; no throws.

Algorithm (per-sample, write-before-read):

```
readIdx = (writeIdx - delaySamples) mod bufferSize
delayed = buffer[readIdx]
buffer[writeIdx] = input + delayed * feedback
output = input * (1 - mix) + delayed * mix
writeIdx = (writeIdx + 1) mod bufferSize
```

Buffer sized for `MAX_TIME_MS * sampleRate / 1000`.

### 6.2 Reverb (Schroeder / Freeverb-lite)

Eight parallel damped comb filters → four series allpass filters.

| Param   | Range     | Default | Maps to                    |
| ------- | --------- | ------- | -------------------------- |
| `size`  | 0.00–1.00 | 0.50    | comb-delay scale 0.5–1.0   |
| `decay` | 0.00–1.00 | 0.50    | comb-feedback gain 0.5–0.95 |
| `mix`   | 0.00–1.00 | 0.00    | dry/wet                    |

Tuning constants at 44.1 kHz; scale linearly with `sr / 44100`:

```
COMB_DELAYS    = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
ALLPASS_DELAYS = [556, 441, 341, 225]
ALLPASS_FEEDBACK = 0.5
DAMP             = 0.5
```

Mapping:

```
combDelaySamples[i] = COMB_DELAYS[i] * (sr / 44100) * (0.5 + 0.5 * size)
combFeedback        = 0.5 + 0.45 * decay
```

Damped comb (×8 in parallel):

```
readIdx = (writeIdx - combDelaySamples[i]) mod bufferLen[i]
output  = buffer[readIdx]
lastFiltered = output * (1 - DAMP) + lastFiltered * DAMP
buffer[writeIdx] = input + lastFiltered * combFeedback
writeIdx = (writeIdx + 1) mod bufferLen[i]
return output
```

Schroeder allpass (×4 in series):

```
readIdx = (writeIdx - allpassDelaySamples[i]) mod bufferLen[i]
bufout  = buffer[readIdx]
output  = -input + bufout
buffer[writeIdx] = input + bufout * ALLPASS_FEEDBACK
writeIdx = (writeIdx + 1) mod bufferLen[i]
return output
```

Per-sample wiring:

```
wet = sum(comb[i].process(input) for i in 0..7)
for ap in allpasses: wet = ap.process(wet)
output = input * (1 - mix) + (wet / 8) * mix    // /8 keeps wet level sane
```

`mix < 0.05` → bypass-eligible.

## 7. Testing

### 7.1 Unit (`tests/unit/`, vitest + jsdom)

- **`chain.test.ts`** — store mutations: addSlot, removeSlot, reorderSlot, toggleEnabled. `isNeutral` per kind. Default-chain shape on fresh source. Persisted-chain wins over v1 default.
- **`effects/echo.test.ts`** — translates `EchoEffectTest.kt` assertions:
  1. Impulse with `mix=1, feedback=0` → peak of 1.0 at `delaySamples`; zero elsewhere.
  2. Impulse with `mix=1, feedback=0.5` → peaks at `n*delaySamples` of amplitude `feedback^(n-1)`.
  3. `mix=0` → output bit-equal to input.
  4. `feedback=5` (out of range) → second tap amplitude ≤ 0.95.
  5. `timeMs=99999` (out of range) → no buffer overflow.
- **`effects/reverb.test.ts`** — translates `ReverbEffectTest.kt`:
  1. `mix=0` → output bit-equal to input.
  2. Impulse with `mix=1, decay=0.7` → RMS over [50ms, 500ms] > 1e-3.
  3. `decay=1.0` late-tail RMS > `decay=0.0` late-tail RMS.
  4. Late RMS (1.5–2.0 s) < early RMS (0.1–0.5 s) for any decay.
  5. Out-of-range parameters do not throw.
- **`effects/{crusher,srhold,pitch,filter}.test.ts`** — lift-and-shift of existing tests onto the new module structure; no new assertions.
- **`persist.test.ts`** — chain serialization round-trip. Export-with-`chainConfig` round-trip via `fake-indexeddb`. Old export (no `chainConfig`) reads as `undefined` and "Restore" is hidden.

Worklet tests use the existing `processor-shim.ts` pattern to run `AudioWorkletProcessor` code in Node.

### 7.2 Integration (`tests/integration/`, playwright + real `OfflineAudioContext`)

- **`tail-padding.test.ts`** — chain with active echo (`mix>=0.05`) → render length = `sourceDur + 4s`; chain with echo at `mix=0` → render length = `sourceDur`. Mirrors Android `AppendSilenceTailTest`.
- **`chain-order.test.ts`** — *the proof that order matters*. Render `[BitCrusher, Reverb]` vs `[Reverb, BitCrusher]` on the same impulse; assert outputs differ by a measurable margin (RMS difference > threshold). Without this test, the entire premise of the refactor is unverified.
- **`bit-exactness.test.ts`** — chain with all four legacy effects at neutral params → output bit-equal to source. Proves bypass-by-omission works end-to-end and v1 behavior is preserved.

### 7.3 E2E (`tests/e2e/`, playwright + dev server)

- **`pedalboard.spec.ts`** — load source, drag Echo above Filter, verify chain order in the store, render, verify export carries `chainConfig`.
- **`restore-from-export.spec.ts`** — render export A; modify chain; click "Restore" on export A; verify chain matches A's snapshot.
- **`add-remove-toggle.spec.ts`** — `+ Add effect` adds a slot at the tail with default params; `×` removes it; eyeball toggles `enabled`; rendering audibly reflects the toggled state.

CI (`.github/workflows/ci.yml`) gates on all three suites, as today.

## 8. Migration / build sequence

A safe order to land this work in PR-sized chunks:

1. **Tag v1** ✓ (already done — `git tag v1` at `aea2021`).
2. **Introduce `src/audio/effects/` scaffolding**: `types.ts`, `registry.ts`, empty per-effect folders. No behavior change.
3. **Refactor v1 effects into the new structure** (Crusher, SR-hold, Pitch, Filter). Existing `EffectsRack.tsx` keeps working but reads from the registry. Tests passing, no UI change visible.
4. **Replace `EffectParams` with `Chain` in the store**, with the v1 default chain as the initial state. Engine wraps the chain into the existing hardcoded graph wiring (transitional). All existing tests still pass.
5. **Implement `engine.rebuildChain()`** programmatically wiring slots in chain order. Remove the hardcoded wiring in `graph.ts`. Bit-exactness integration test gates this.
6. **Build the new EffectsRack UI** with dnd-kit. Adds drag handles, enabled toggles, +Add, ×Remove. Reorder uses apply-on-release.
7. **Port Echo worklet** from Android `EchoEffect.kt`. Echo unit tests gate this.
8. **Port Reverb worklet** from Android `ReverbEffect.kt`. Reverb unit tests gate this.
9. **Tail padding in `renderOffline`**. Tail-padding integration test gates this.
10. **Persistence**: `persist` middleware on `chain`; `chainConfig` field on exports; "Restore" button. E2E test gates this.
11. **Chain-order integration test** is the final acceptance gate — the test that proves "order matters" works end-to-end.

Each step is a self-contained PR with passing tests. Rollback is a `git revert` away.

## 9. Open questions / risks

- **Click on rebuild despite the 10ms ramp.** If artifacts are still audible in practice, options: longer ramp (~30ms), or use a `ConstantSourceNode`-driven envelope for sample-accurate timing. Decide after first integration run.
- **dnd-kit bundle cost.** ~30kB gzip. If bundle-size matters more than expected, fall back to up/down arrow buttons (zero deps); keyboard accessibility story is simpler too.
- **Pitch slot's combined semitones+speed UI.** Today these are two separate `Param` rows. The pitch slot's panel must keep that two-control layout to not regress UX. The slot stays singular at the data level.
- **WSOLA worklet position.** It currently sits *upstream* of the effects (it's the `player`). Pitch is therefore "first in chain" by construction — moving the pitch slot to a different position in the rack doesn't actually relocate WSOLA. The pitch slot's params reach WSOLA via `apply()`, but the *slot's chain position* is decorative. This is documented behavior: pitch is always pre-effects. If a user genuinely wants pitch-after-distortion they can't have it in v2; flag this in the pitch slot's panel ("applies before all effects").

## 10. References

- Original Android implementation: `../archive/IMakeHeat/app/src/main/java/com/dewoller/imakeheat/audioeffects/{Echo,Reverb}Effect.kt`
- Android tests to translate: `../archive/IMakeHeat/app/src/test/java/com/dewoller/imakeheat/audio/{Echo,Reverb,AppendSilenceTail}EffectTest.kt`
- SP-404MK2 effects catalog (roadmap source): `~/Downloads/SP-404mk2_effects_reference.md`
- Existing v1 baseline: tag `v1` at commit `aea2021`
