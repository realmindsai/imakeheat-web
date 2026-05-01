# SP-404MK2 Effects Reference

**Date:** 2026-05-02  
**Source:** Roland SP-404MK2 Reference Manual (v2.00, English ed. 04)  
**Purpose:** planning-facing effect catalog and feasibility map for `imakeheat-web`

---

## Current Repo Status

The current pedalboard already ships these effect kinds:

- `crusher`
- `srhold`
- `pitch`
- `filter`
- `echo`
- `reverb`
- `vinyl303`
- `vinyl404`
- `cassette`

Notes:

- `pitch` already includes independent `semitones` and `speed`, backed by the upstream WSOLA/SoundTouch path. In product terms, this is already the app's `time stretch` implementation.
- `srhold` and `filter` are generic pedalboard effects, not literal SP-404MK2 effect names.
- `echo` is a generic delay. It is not a literal implementation of `Sync Delay` or `Tape Echo`.

---

## Catalog Normalization Notes

This document is intentionally a planning view, not a verbatim manual dump. The original draft list mixed canonical manual names, aliases, and a few names that do not line up cleanly with the local PDF.

Use these normalized names for implementation work:

- `WimSaturator` -> `WrmSaturator`
- `TimeClippy` -> `TimeCtrlDly`
- `Ko-Da Ma` -> `Ko-Da-Ma`
- `TR-303 vinyl simulation` -> `303 VinylSim`

Treat these entries from the earlier draft as non-canonical until proven against another manual source:

- `5X Delay`
- `Cloud Delay`
- `5X Reverb`
- `Back Spin`

For repo planning, prefer the manual-anchored names below.

---

## Manual-Anchored Effect Set

### Strongly confirmed from the local PDF

- `Filter+Drive`
- `Resonator`
- `Sync Delay`
- `Isolator`
- `DJFX Looper`
- `Scatter`
- `Downer`
- `Ha-Dou`
- `Ko-Da-Ma`
- `Zan-Zou`
- `To-Gu-Ro`
- `SBF`
- `Stopper`
- `Tape Echo`
- `TimeCtrlDly`
- `Super Filter`
- `WrmSaturator`
- `303 VinylSim`
- `404 VinylSim`
- `Cassette Sim`
- `Lo-fi`
- `Reverb`
- `Chorus`
- `JUNO Chorus`
- `Flanger`
- `Phaser`
- `Wah`
- `Slicer`
- `Tremolo/Pan`
- `Chromatic PS`
- `Hyper-Reso`
- `Ring Mod`
- `Crusher`
- `Overdrive`
- `Distortion`
- `Equalizer`
- `Compressor`

### Input-oriented or otherwise special-case from the earlier draft

- `Auto Pitch`
- `Vocoder`
- `Harmony`
- `Gt Amp Sim`

These should not be treated as normal pedalboard slots in the first expansion wave.

---

## Feasibility Model For imakeheat-web

The current architecture is best at effects that fit this shape:

- one user-visible slot kind
- one `definition.ts`
- one `panel.tsx`
- one deterministic DSP implementation
- offline-render-safe behavior
- no hidden transport ownership

Effects that need live input analysis, gesture-driven timing, BPM state, or transport re-authoring are materially less feasible in the current design.

---

## Time Stretch

`Time stretch` belongs in the roadmap, but not as a brand-new DSP subsystem.

The codebase already has:

- independent pitch and speed in the current `pitch` slot
- WSOLA/SoundTouch-backed transport processing upstream of the chain
- unit, integration, and e2e coverage around speed and pitch behavior

So the roadmap item is:

- productize the current slot as `Pitch / Stretch`
- improve presets and UX around speed control
- decide later whether stretch remains upstream/control-only or becomes a true in-chain effect

Do **not** build a second stretch engine in parallel.

---

## Feasible Roadmap

### Phase 0: Productize Pitch / Stretch

Goal:

- keep the existing WSOLA path
- rename or reframe the current `pitch` slot as `Pitch / Stretch`
- improve UI copy, presets, and tests

Why first:

- this is already implemented in substance
- it closes the biggest conceptual gap in the effect catalog cheaply
- it avoids building overlapping pitch-time systems later

### Phase 1: Utility / Tone Pack

Best next effects:

- `Filter+Drive`
- `Isolator`
- `Lo-fi`
- `Equalizer`
- `Compressor`

Why these are first:

- clean parameter surfaces
- deterministic offline behavior
- strong practical value
- low architectural risk

### Phase 2: Delay / Drive Pack

Best next effects:

- `Tape Echo`
- `Sync Delay` or `TimeCtrlDly`
- `Overdrive`
- `Distortion`
- `WrmSaturator`

Why these are second:

- they fill obvious SP-style tone gaps
- they are still slot-local effects
- they reuse patterns already present in `echo`, `reverb`, and the vinyl/cassette worklets

### Phase 3: Modulation Pack

Best next effects:

- `Chorus`
- `JUNO Chorus`
- `Flanger`
- `Phaser`
- `Tremolo/Pan`
- `Wah`

Why these are third:

- they fit the current model well
- they benefit from shared modulation helpers
- they add breadth without forcing transport redesign

### Phase 4: Resonance / Character Pack

Best next effects:

- `Super Filter`
- `Ring Mod`
- `Resonator`
- `SBF`

Why these are fourth:

- still feasible
- more tuning-heavy
- more likely to need iterative parameter design

### Phase 5: Borderline But Still Plausible

Candidate effects:

- `Downer`
- `Stopper`
- `Slicer`

Why these are later:

- more stateful
- more transport-adjacent
- more likely to reveal limitations in the current render model

### Phase 6: Defer Until Architecture Changes

Effects to defer:

- `DJFX Looper`
- `Scatter`
- `Ha-Dou`
- `Ko-Da-Ma`
- `Zan-Zou`
- `To-Gu-Ro`
- `Chromatic PS`
- `Hyper-Reso`

Why deferred:

- they pull harder on gesture semantics, BPM state, or transport ownership
- some overlap conceptually with the existing `pitch` / stretch system
- they are more likely to need a dedicated performance-effects architecture

### Out Of Scope For The Pedalboard Expansion

- `Auto Pitch`
- `Vocoder`
- `Harmony`
- `Gt Amp Sim`

Why out of scope:

- input-FX behavior
- live input analysis
- not a clean fit for the current offline render + sample chain product

---

## Recommended Implementation Order

If the goal is maximum product value per unit of engineering risk, build in this order:

1. `Pitch / Stretch` productization
2. `Filter+Drive`
3. `Lo-fi`
4. `Compressor`
5. `Equalizer`
6. `Tape Echo`
7. `Overdrive`
8. `Distortion`
9. `WrmSaturator`
10. `Chorus`
11. `JUNO Chorus`
12. `Flanger`
13. `Phaser`
14. `Tremolo/Pan`
15. `Wah`
16. `Super Filter`
17. `Ring Mod`
18. `Resonator`
19. `SBF`
20. `Downer`
21. `Stopper`
22. `Slicer`

Everything after that should be reconsidered in light of whether the app wants a separate performance-effects architecture.

