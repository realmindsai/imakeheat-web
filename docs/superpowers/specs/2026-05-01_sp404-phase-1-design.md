# SP-404 Phase 1 Design

**Date:** 2026-05-01
**Status:** Draft
**Repo:** `imakeheat-web`
**Depends on:** `docs/superpowers/specs/2026-04-30-pedalboard-effects-design.md`
**Reference:** `docs/reference/SP-404mk2_effects.md`

## 1. Goal

Ship the first pragmatic SP-404-inspired expansion pack without changing the pedalboard engine model.

This phase widens the effect vocabulary with five new slot kinds that fit the current chain architecture cleanly:

- `isolator`
- `equalizer`
- `filterDrive`
- `compressor`
- `loFi`

The design optimizes for fast, clean, shippable implementations. It does not chase exact Roland emulation.

## 2. Design Rules

1. Every new effect remains a normal pedalboard slot built through the existing effect registry.
2. Live preview and offline render must use the same `EffectDefinition.build()` path.
3. Prefer native Web Audio node compositions when they are good enough.
4. Add a new worklet only when a composite native-node implementation is not credible.
5. Keep chain order honest. Do not fake one user-visible effect by silently inserting unrelated hidden slots.
6. Keep the batch inside the current transport and routing model. No BPM sync, no gesture semantics, no upstream special-casing.

## 3. Non-goals

- Exact SP-404MK2 circuit or algorithm parity
- New transport-aware or BPM-aware behavior
- New engine hooks or alternate render paths
- A dedicated `tapeEcho` effect in this phase
- A second pitch or time-stretch subsystem

## 4. Phase 1 Scope

### 4.1 Included effects

- `isolator`
- `equalizer`
- `filterDrive`
- `compressor`
- `loFi`

### 4.2 Explicitly excluded

- `tapeEcho`
- `syncDelay`
- `timeCtrlDly`
- `overdrive`
- `distortion`
- `wrmSaturator`

Those effects belong to later batches. `tapeEcho` is excluded on purpose because the repo already ships `echo`, and forcing a second delay-family effect into this phase would dilute the batch.

## 5. Architecture

Phase 1 does not change the engine contract. Each new effect follows the existing repo pattern:

- `src/audio/effects/<kind>/definition.ts`
- `src/audio/effects/<kind>/panel.tsx`
- optional worklet only when required
- registration through `src/audio/effects/_internal.ts` and `registry.ts`

No new route, store mode, or engine-level special case is allowed for this batch.

### 5.1 Shared internal helpers

Phase 1 may add small internal helpers when they remove clear duplication across multiple effects.

Allowed helper categories:

- shared EQ-band wiring for `isolator` and `equalizer`
- shared waveshaper curve utility for `filterDrive`
- shared dry/wet helper for `loFi`

Do not create a broad new abstraction layer unless at least two effects use it immediately.

## 6. Effect Designs

### 6.1 `isolator`

**Intent**

A fast three-band performance EQ that can cut or boost lows, mids, and highs.

**Implementation**

Use a native composite chain:

- `BiquadFilterNode(lowShelf)`
- `BiquadFilterNode(peaking)`
- `BiquadFilterNode(highShelf)`

**Parameters**

- `low`
- `mid`
- `high`

Map the SP manual's `-INF` UI position to an internal hard floor such as `-60 dB`. Boost values can follow the documented positive range directly.

**Neutral**

Neutral when all three gains are `0 dB`.

**Reasoning**

This is the cheapest effect in the batch and establishes reusable EQ scaffolding for later effects.

### 6.2 `equalizer`

**Intent**

A more precise three-band EQ than `isolator`, with adjustable band centers.

**Implementation**

Reuse the same basic native chain shape as `isolator`:

- `BiquadFilterNode(lowShelf)`
- `BiquadFilterNode(peaking)`
- `BiquadFilterNode(highShelf)`

Expose selectable center frequencies using the manual's discrete lists.

**Parameters**

- `lowGain`
- `midGain`
- `highGain`
- `lowFreq`
- `midFreq`
- `highFreq`

**Neutral**

Neutral when all three gains are `0 dB`. Frequency settings do not affect neutrality when gains are flat.

**Reasoning**

This reuses `isolator` infrastructure while covering the more deliberate corrective-EQ use case.

### 6.3 `filterDrive`

**Intent**

Combine resonant filtering with quick saturation in one slot.

**Implementation**

Use a native composite chain:

- `BiquadFilterNode` configured as `lowpass` or `highpass`
- `WaveShaperNode`
- `BiquadFilterNode(lowShelf)` for body compensation
- `GainNode` for output trim

**Parameters**

- `cutoffHz`
- `resonance`
- `drive`
- `filterType`
- `lowFreq`
- `lowGain`

`drive` controls the waveshaper amount. `lowFreq` and `lowGain` restore low-end after aggressive filtering or saturation.

**Neutral**

Neutral when:

- `filterType` defaults to `lowpass`
- `cutoffHz` defaults to `16000`
- `resonance` defaults to `0`
- `drive` defaults to `0`
- `lowGain` defaults to `0`

This is not mathematically identical to bypass, but it should be transparent enough to qualify as neutral in integration tests.

**Reasoning**

This gives the batch more character than a plain filter and does so without a custom processor.

### 6.4 `compressor`

**Intent**

Provide quick SP-style squash and level control without building a custom dynamics engine.

**Implementation**

Use a native composite chain:

- `DynamicsCompressorNode`
- `GainNode` for makeup and final level

**Parameters**

- `sustain`
- `attack`
- `ratio`
- `level`

Parameter mapping:

- `attack` maps to compressor attack
- `ratio` maps to compressor ratio
- `sustain` acts as a macro that lowers threshold and increases makeup gain together
- `level` is final output trim

**Neutral**

Default settings should map to a near-neutral compressor state:

- high threshold
- minimum useful ratio
- low or zero makeup gain
- no audible pumping on ordinary source material

The effect does not need a true bypass state. It does need a conservative default that avoids surprise coloration.

**Reasoning**

This is the fastest credible path. A custom compressor worklet would add complexity without helping the Phase 1 goal.

### 6.5 `loFi`

**Intent**

Provide an SP-style degraded texture that is more curated than placing `crusher` and `srhold` side by side.

**Implementation**

Start as a composite effect built from existing building blocks:

- pre-filter
- `srhold` worklet node
- `bitcrusher` worklet node
- tone filter
- cutoff filter
- dry/wet mix
- output gain

No new `loFi` worklet is added in the first pass unless the composite version is obviously weak in listening tests.

**Parameters**

- `preFilt`
- `lofiType`
- `tone`
- `cutoffHz`
- `balance`
- `level`

Implementation stance:

- `preFilt` selects one of a small set of fixed pre-filter voicings
- `lofiType` selects preset combinations of sample-rate reduction, bit depth, and fixed coloration
- `tone` applies a simple tilt or shelf balance
- `cutoffHz` applies a final low-pass contour
- `balance` controls dry/wet mix
- `level` controls output trim

**Neutral**

Neutral when:

- `balance` defaults to full dry
- `lofiType` defaults to the mildest preset
- `preFilt` defaults to the least colored pre-filter
- `tone` defaults flat
- `cutoffHz` defaults open

**Reasoning**

This preserves Phase 1 speed. If the result sounds too generic, only `loFi` gets promoted to a dedicated worklet in a later pass.

## 7. UI Design

All five effects follow the existing slot-card and slider-row patterns already used in `src/audio/effects/*/panel.tsx`.

Rules:

- keep labels short and legible
- keep sliders in SP-style order, not alphabetical order
- default new slots to expanded, consistent with the current rack behavior for new effect kinds
- keep value labels compact in `EffectsRack.tsx`

Value-label priority:

- `isolator`: show the band being edited or a compact `L/M/H`
- `equalizer`: show gain-focused summary, not all six values
- `filterDrive`: show cutoff or drive
- `compressor`: show sustain
- `loFi`: show `lofiType` or `balance`

## 8. File-Level Impact

Shared files:

- `src/audio/effects/types.ts`
- `src/audio/effects/registry.ts`
- `src/screens/EffectsRack.tsx`
- `src/audio/graph.ts` only if `loFi` gets a dedicated worklet later

New effect folders:

- `src/audio/effects/isolator/`
- `src/audio/effects/equalizer/`
- `src/audio/effects/filterDrive/`
- `src/audio/effects/compressor/`
- `src/audio/effects/loFi/`

Possible internal helper files:

- `src/audio/effects/_shared/eq.ts`
- `src/audio/effects/_shared/waveshaper.ts`
- `src/audio/effects/_shared/dryWet.ts`

Helper files are optional. They should appear only if they reduce real duplication.

## 9. Testing Strategy

Phase 1 must satisfy the repo's existing three-layer test model plus build verification.

### 9.1 Unit

Update existing regression tests:

- `tests/unit/effects/registry.test.ts`
- `tests/unit/add-effect-menu.test.tsx`
- `tests/unit/chain-store.test.ts`
- `tests/unit/persist.test.ts`

Add new unit tests:

- one per effect for `defaultParams`
- one per effect for `isNeutral()`
- targeted parameter-mapping tests for the composite builders where the mapping is nontrivial

Do not write brittle browserless DSP-response tests for native EQ or compressor behavior.

### 9.2 Integration

Add one Playwright integration spec for the Phase 1 pack.

It should verify:

- each new effect renders successfully offline
- each new effect is effectively transparent at neutral settings
- each new effect measurably alters output when pushed
- `loFi` dry/wet mix changes output character
- at least one new chain-order pair still proves order matters

### 9.3 E2E

Add one pedalboard-centered e2e that:

- adds all five new effects from the menu
- verifies the expected controls render
- tweaks at least one parameter per effect
- exports and restores a chain containing Phase 1 effects
- confirms restored values persist

### 9.4 Final verification

Before completion:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:integration`
- `npm run test:e2e`

Test output must stay clean.

## 10. Delivery Order

Ship the phase in three slices:

1. `isolator` + `equalizer`
2. `filterDrive` + `compressor`
3. `loFi`

This order establishes reusable EQ plumbing first, lands the safer tone and dynamics effects next, and leaves the most character-dependent effect for last.

## 11. Risks

### 11.1 Native compressor variance

`DynamicsCompressorNode` may vary enough across browsers that neutrality assertions need pragmatic thresholds in integration tests.

### 11.2 `loFi` may sound generic

The composite version may feel too close to `crusher` plus `srhold`. If that happens, only `loFi` should graduate to a dedicated worklet.

### 11.3 Weak `filterDrive` voicing

If the waveshaper curve and post-drive lowshelf are not tuned together, the effect will feel thin or bland.

## 12. Success Condition

Phase 1 succeeds if the app gains five new useful SP-inspired effects while preserving:

- the current slot model
- honest chain semantics
- shared live/offline behavior
- clean unit, integration, and e2e coverage
- fast iteration speed for later phases
