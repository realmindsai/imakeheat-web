# Vinyl & Cassette Effects — Design

**Date:** 2026-05-01
**Status:** Draft
**Repo:** `imakeheat-web`
**Depends on:** `docs/superpowers/specs/2026-04-30-pedalboard-effects-design.md`

## 1. Goal

Add three vintage effects to the pedalboard as separate slot types:

- `303 VinylSim`
- `404 VinylSim`
- `Cassette Sim`

Keep the existing pedalboard interaction model. Each effect gets its own card, its own panel, and its own worklet-backed DSP node. The job here is not to invent a second UI system. The job is to add three honest effects that behave like first-class pedalboard slots.

## 2. Non-goals

- Full circuit-accurate emulation of Roland hardware
- Rebuilding these sounds as presets from `crusher`, `srhold`, `filter`, and `pitch`
- Routing wow/flutter through the global WSOLA pitch slot
- Tempo-sync behavior
- Tail-padding rules like echo or reverb

## 3. Design Rules

1. **Three effects, three panels.** Do not merge `303 VinylSim`, `404 VinylSim`, and `Cassette Sim` into a generic "vintage" effect.
2. **Use the existing card pattern.** Each effect panel lives in a normal slot card and uses the same slider idioms as the current rack.
3. **Keep chain order honest.** Each effect owns its own DSP. Do not fake these sounds by composing existing slots behind the user's back.
4. **Make renders deterministic.** Noise, crackle, dropout, and catch behavior must come from a deterministic internal PRNG so offline tests stay repeatable.

## 4. Data Model

Extend `EffectKind` and `Slot` in `src/audio/effects/types.ts`:

```ts
// Add to EffectKind:
| 'vinyl303' | 'vinyl404' | 'cassette'

// Add to Slot:
| (SlotBase & {
    kind: 'vinyl303'
    params: { comp: number; noise: number; wowFlutter: number; level: number }
  })
| (SlotBase & {
    kind: 'vinyl404'
    params: { frequency: number; noise: number; wowFlutter: number }
  })
| (SlotBase & {
    kind: 'cassette'
    params: {
      tone: number
      hiss: number
      ageYears: number
      drive: number
      wowFlutter: number
      catch: number
    }
  })
```

Store params in SP-style integer ranges:

- `303 VinylSim`: `comp 0..100`, `noise 0..100`, `wowFlutter 0..100`, `level 0..100`
- `404 VinylSim`: `frequency 0..100`, `noise 0..100`, `wowFlutter 0..100`
- `Cassette Sim`: `tone 0..100`, `hiss 0..100`, `ageYears 0..60`, `drive 0..100`, `wowFlutter 0..100`, `catch 0..100`

Default params are the neutral states:

- `303 VinylSim`: `{ comp: 0, noise: 0, wowFlutter: 0, level: 100 }`
- `404 VinylSim`: `{ frequency: 100, noise: 0, wowFlutter: 0 }`
- `Cassette Sim`: `{ tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 }`

Neutral rules:

- `vinyl303`: `comp === 0 && noise === 0 && wowFlutter === 0 && level === 100`
- `vinyl404`: `frequency === 100 && noise === 0 && wowFlutter === 0`
- `cassette`: `tone === 50 && hiss === 0 && ageYears === 0 && drive === 0 && wowFlutter === 0 && catch === 0`

These effects should bypass by omission like the rest of the rack. Neutral params mean no worklet node in the active chain.

## 5. File Layout

Add the effects as normal registry entries:

```text
src/audio/effects/
  vinyl303/{definition.ts, panel.tsx}
  vinyl404/{definition.ts, panel.tsx}
  cassette/{definition.ts, panel.tsx}

src/audio/worklets/
  vinyl303.worklet.ts
  vinyl404.worklet.ts
  cassette.worklet.ts
```

`registry.ts` side-effect-imports the three definitions. `graph.ts` loads the three new worklet modules next to the existing processors.

Each `definition.ts` follows the current pattern:

- `displayName`
- `defaultParams`
- `isNeutral()`
- `build()` returning one `AudioWorkletNode`
- `Panel`

## 6. Panels

### 6.1 303 VinylSim

Controls:

- `Comp`
- `Noise`
- `Wow/flutter`
- `Level`

Slider labels:

- `Comp`: `open` → `squashed`
- `Noise`: `clean` → `dirty`
- `Wow/flutter`: `steady` → `warped`
- `Level`: `mute` → `unity`

### 6.2 404 VinylSim

Controls:

- `Frequency`
- `Noise`
- `Wow/flutter`

Slider labels:

- `Frequency`: `muffled` → `full`
- `Noise`: `clean` → `dirty`
- `Wow/flutter`: `steady` → `warped`

### 6.3 Cassette Sim

Controls:

- `Tone`
- `Hiss`
- `Age`
- `Drive`
- `Wow/flutter`
- `Catch`

Slider labels:

- `Tone`: `dark` → `bright`
- `Hiss`: `clean` → `dirty`
- `Age`: `fresh` → `dead`
- `Drive`: `clean` → `cooked`
- `Wow/flutter`: `steady` → `warped`
- `Catch`: `smooth` → `chewed`

Do not collapse `Age` and `Catch`. They model different failure modes. `Age` is persistent wear. `Catch` is intermittent transport failure.

## 7. DSP Model

### 7.1 Shared primitives

All three worklets should share the same small set of ideas:

- deterministic PRNG for noise, crackle, dropout, and catch timing
- modulated fractional delay for wow/flutter
- one-pole or biquad tone shaping
- soft saturation
- simple envelope-following dynamics for compression

This is enough to create distinct characters without building three giant processors.

### 7.2 303 VinylSim

Signal path:

```text
input -> compressor macro -> fixed vinyl EQ contour -> wow/flutter delay -> add record noise/crackle -> level trim
```

Behavior:

- `Comp` lowers threshold, raises ratio, and adds makeup gain
- `Noise` adds low rumble, light hiss, and sparse crackle pops
- `Wow/flutter` scales both slow wow and faster flutter from one knob
- `Level` trims the final output and tops out at unity

Character target:

- dirtier than `404 VinylSim`
- more obviously compressed
- more obvious effect coloration

### 7.3 404 VinylSim

Signal path:

```text
input -> playback-response filter -> wow/flutter delay -> add cleaner surface noise
```

Behavior:

- `Frequency` darkens playback and adds a small low-mid body shift as it moves left
- `Noise` adds steadier, cleaner record noise than `303 VinylSim`
- `Wow/flutter` stays subtler than cassette

Character target:

- cleaner than `303 VinylSim`
- more about playback tone than compression
- still recognizably vinyl, not tape

### 7.4 Cassette Sim

Signal path:

```text
input -> tone tilt EQ -> tape saturation -> age wear stage -> wow/flutter delay -> catch events -> add hiss
```

Behavior:

- `Tone` is a tilt EQ with neutral midpoint at `50`
- `Hiss` adds continuous tape noise
- `Age` adds high-end loss, softer transients, mild instability, and a low dropout probability
- `Drive` adds tape-like soft clipping and mild compression
- `Wow/flutter` is stronger and rougher than either vinyl effect
- `Catch` triggers short snag events: brief delay surges plus small level dents

Character target:

- the most animated of the three
- less about surface noise
- more about unstable transport and worn media

## 8. Chain Semantics

Wow/flutter must live inside each vintage worklet. Do not route it through the global pitch slot.

Reason: the current pitch slot is WSOLA-driven and sits upstream of the chain. If vintage wow/flutter uses that path, it stops being a per-slot effect and starts acting like a hidden global transport. That breaks the rack's order semantics and makes the UI lie.

These three effects are immediate processors. They do not need offline tail padding.

## 9. Testing

### 9.1 Unit

Add one unit suite per worklet:

- neutral params render transparently within a fixed RMS tolerance
- each control moves a measurable property in the expected direction
- deterministic random sources produce stable output for the same seed and params

### 9.2 Integration

Add offline render specs that prove:

- `Noise` and `Hiss` raise the broadband noise floor
- `Wow/flutter` increases short-window pitch instability
- `Drive` increases harmonic content or reduces crest factor
- `Catch` introduces intermittent speed dents or brief level drops

### 9.3 E2E

Add one rack-level spec that proves:

- each effect can be added from the menu
- each panel shows the expected controls
- export and restore preserve params for all three effects

## 10. Implementation Order

1. Add the three `EffectKind` variants and slot param types
2. Add panel components with the existing slot-card pattern
3. Add worklet loaders and registry entries
4. Implement `303 VinylSim`
5. Implement `404 VinylSim`
6. Implement `Cassette Sim`
7. Add unit, integration, and e2e coverage

This order ships the cleanest path: simple UI wiring first, then DSP, then evidence.
