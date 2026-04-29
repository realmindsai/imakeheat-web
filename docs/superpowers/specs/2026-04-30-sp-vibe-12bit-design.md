# SP-vibe character on the 12-bit button

## Context

`imakeheat-web` exposes five bit-depth buttons (2, 4, 8, 12, 16) wired to a single uniform mid-tread quantizer in `src/audio/worklets/bitcrusher.worklet.ts`. The 12 button currently does generic 12-bit rounding — it doesn't sound like any specific machine. A friend with audio-engineering background has produced research on emulating the SP-1200 (12-bit) and ASR-10 (16-bit) and asked us to make the 12 and 16 buttons sound like those machines.

Decision out of brainstorming: judge results by ear, not by spec sheet. Match the *vibe* of the SP-1200 at the 12 button, leave 16 alone (ASR-10 character is too subtle to fake without making clean audio sound worse), leave 2/4/8 alone.

## Goal

When a user taps the 12 button and plays a drum loop through it, the result should land in the same neighbourhood as an SP-1200 — a bit grittier, a bit darker, more "hit" on transients — without rewriting the audio architecture.

Non-goals:
- Hardware fidelity (offset-binary I/O, exact 26.04 kHz, SSM2044 routing, repeat/skip pitch).
- ASR-10 emulation on the 16 button.
- Any change to 2-, 4-, or 8-bit behaviour.
- Any change to the WSOLA pitch shifter.

## Approach

Two changes, both small.

**1. Pre-quantizer soft saturation, gated to the 12-bit path.**

Inside `bitcrusher.worklet.ts`, when `bits === 12`, run input samples through a `tanh`-shaped soft clipper at roughly +2 dB drive *before* quantizing. Other bit depths bypass the saturator entirely. The saturator is the single largest perceptual move — it gives drums the punch and mild crunch that listeners associate with the SP-1200. Doing it pre-quantize (not post) is the part that matches the doc's "sampled hot" intuition: the nonlinear stage sits in front of the bit reduction, not after.

Drive amount and curve are fixed (no new UI knob). If we later expose a "drive" parameter, it goes in as an extension; the spec ships with one fixed feel.

**2. One-shot SR nudge to ~26 kHz on first 12-bit selection.**

When the user taps the 12 button *for the first time in a session*, the sample-rate slider snaps to 26000 Hz. After that, the user owns the slider — moving it sets a "manually adjusted" flag in the session store, and subsequent 12-button taps no longer override.

This avoids two failure modes: (a) the user taps 12 and hears nothing different because their SR slider is at 48k; (b) the user carefully tunes SR for an effect, taps 12, and loses their setting. The nudge is a one-time hint, not a coupling.

The nudge fires only when going *to* 12 from another bit depth — not when 12 is already selected and the user changes another control.

## Architecture

```
EffectsRack ──tap "12"──► sessionStore.setEffect({ bitDepth: 12, ... })
                              │
                              ├─ if first 12-tap and !srManuallyAdjusted:
                              │     also set sampleRateHz = 26000
                              │
                              ▼
                        engine.setEffect(fx)
                              │
                              ▼
                       bitcrusher.worklet
                              │
                              ▼
                       bits === 12 ?
                          ├── yes ► tanh soft-clip (+2 dB) ► 12-bit quantize
                          └── no  ► (existing path: quantize only, or pass-through at 16)
```

## Components

### `src/audio/worklets/bitcrusher.worklet.ts`

Add a single conditional branch on `this.bits === 12`. In that branch, each input sample is multiplied by the drive gain, soft-clipped through `Math.tanh`, then fed into the existing 12-bit quantizer math. Drive constant lives at module scope as a named constant. One-line comment cites why the saturator is pre-quantize (the only WHY-comment we add — everything else is self-explanatory).

The 16-bit pass-through, the generic quantizer for 2/4/8, and the 12-bit quantizer math itself stay byte-for-byte unchanged. The new code is one `if` and three lines of arithmetic.

### `src/store/session.ts`

Add one boolean to the session shape: `srManuallyAdjusted` (default `false`). Set it to `true` whenever `setEffect` is called with a `sampleRateHz` value that differs from what the store currently holds *and* the call originates from user input (i.e. always — there's no internal SR setter that should clear it).

Rather than thread origin through `setEffect`, the simpler model: `setEffect` always sets the flag when `sampleRateHz` changes, *except* when called via a new dedicated method `nudgeSampleRate(hz)` which sets SR without touching the flag.

### `src/screens/EffectsRack.tsx`

The bit-depth button handler grows one branch. When the new `bitDepth` is 12 and the previous `bitDepth` was not 12 and `srManuallyAdjusted` is false, also call `nudgeSampleRate(26000)`. Otherwise behave as today.

No new UI elements. No tooltip, no badge, no "SP mode" label. The button still says "12". The change is felt, not seen.

## Data flow on a 12-tap

1. User taps "12" while bit depth is 8.
2. `EffectsRack` reads `srManuallyAdjusted` from store. It's false (user has not touched the SR slider).
3. `EffectsRack` calls `setEffect({ bitDepth: 12 })` then `nudgeSampleRate(26000)`.
4. Store updates both fields; `srManuallyAdjusted` stays false.
5. `engine.setEffect` posts `{ bits: 12 }` to bitcrusher worklet and `{ holdFactor: ... }` to srhold.
6. Worklet's process loop now runs the soft-clip-then-quantize path.

On a 12-tap when SR has been manually moved: step 3 only calls `setEffect({ bitDepth: 12 })`; SR stays where the user left it.

## Error handling

There aren't any new failure modes. Soft-clip and bit-quantize are pure arithmetic on `Float32Array` — no allocations, no I/O, no async. The store change is a single boolean field. Nothing can fail in a way that needs handling.

## Testing

Three layers, matching the project's existing test strategy.

**Unit (`tests/unit/`):**
- `bitcrusher.test.ts` (extend existing): with `bits = 12`, feeding a +6 dBFS sine should produce output where peaks are below ~+2 dBFS-equivalent (i.e. soft-clipped) but RMS is preserved within tolerance for low-level signals. Feeding the same +6 dBFS sine with `bits = 8` should NOT show the saturation behaviour — just hard quantization. This is the regression-protection test that future "let's also add saturation to 8-bit" temptations have to break.
- `session.test.ts` (extend existing or add): `setEffect({ sampleRateHz: x })` sets `srManuallyAdjusted = true`; `nudgeSampleRate(x)` does not.

**Integration (`tests/integration/`, playwright + `renderOffline`):**
- Render a -1 dBFS sine through the full chain at `bitDepth: 12` vs `bitDepth: 16`. The 12-bit render should show measurably more harmonic content above the fundamental than a pure 12-bit linear quantizer would (because of the pre-saturation). This validates the saturator survives the worklet boundary in the offline path.

**E2E (`tests/e2e/`):**
- Tap "12" on a fresh session — assert SR slider reads 26000.
- Manually drag SR to 18000, then tap "8", then tap "12" — assert SR stays at 18000.

## Build sequence

1. Add `srManuallyAdjusted` and `nudgeSampleRate` to `session.ts`. Tests for the flag.
2. Wire the 12-tap nudge in `EffectsRack.tsx`. E2E test for the nudge behaviour.
3. Add the soft-clip branch to `bitcrusher.worklet.ts`. Unit test for the +6 dBFS peak behaviour.
4. Integration test for harmonic content in offline render.

Each step should leave `npm run typecheck`, `npm test`, and the build green.

## What we're explicitly skipping (and why each is fine)

- **Repeat/skip pitch shifting.** Would require swapping out the WSOLA worklet conditionally based on bit depth — a much bigger change. The saturator does most of the perceptual work for drum-style material, which is the SP's home turf.
- **Offset-binary I/O.** Inaudible. Internal signed math produces identical samples.
- **SSM2044-style output filter.** The biquad in the existing chain can already emulate a resonant low-pass if the user wants one; adding a second filter would clutter the graph.
- **26.04 kHz to four decimal places.** 26000 vs 26040 is 1.5 Hz of difference at the system rate. Not audible.
- **TPDF dither at 12 bits.** Listening path doesn't requantize for export at 12 bits in a way where dither would matter; bit-crush is a creative effect and the noise floor is the point.
- **ASR-10 character on 16-bit.** 16-bit through a clean chain already sounds like a clean ASR-10 minus the converter colour. Adding "ASR character" to a 16-bit quantize step would mostly mean making it dirtier, which is the wrong move when the user has explicitly asked for the cleanest setting.

## Open questions

None blocking. If after listening the saturator at +2 dB feels too tame or too aggressive, the drive constant is a one-line tweak. If the SR nudge feels paternalistic in practice, removing it is also one branch.
