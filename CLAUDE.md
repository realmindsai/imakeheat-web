# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`imakeheat-web` is a pocket-bitcrusher PWA: record or upload audio, apply lo-fi effects in a user-reorderable chain, preview live, render WAVs offline, archive in IndexedDB. React 18 + TypeScript + Vite + Tailwind, Web Audio + AudioWorklet, Zustand, idb, dnd-kit.

Design specs: `docs/superpowers/specs/`

## Commands

    npm run dev              # Vite dev server on http://localhost:5173
    npm run build            # tsc -b + vite build
    npm run preview          # serve dist/
    npm run typecheck        # tsc --noEmit
    npm test                 # vitest run (jsdom unit tests under tests/unit/)
    npm run test:watch       # vitest watch
    npm run test:integration # playwright, tests/integration/ — renderOffline in a real browser
    npm run test:e2e         # playwright, tests/e2e/

Single test runs:

    npx vitest run tests/unit/effects/echo.test.ts
    npx vitest run -t "name pattern"
    npx playwright test tests/e2e/pedalboard.spec.ts

CI runs typecheck → unit → build → integration → e2e on every PR; all four are required gates.

## Architecture

Four-screen hash-routed SPA: `home | preview | effects | exports`. Routing in `src/lib/router.ts`, reflected into Zustand store, `src/App.tsx` switches on `route`. `?gallery=1` swaps in the component gallery.

Three layers in dependency order:

### `src/audio/`

- **`engine.ts`** — singleton `engine`. Owns the `AudioContext`, WSOLA player worklet, a `GainNode` master, and an `AnalyserNode`. Key API:
  - `rebuildChain(chain)` — apply-on-release (35 ms gain ramp, coalesced): disposes live nodes, builds new ones from the registry in chain order, rewires `player → [nodes] → analyser → master`.
  - `updateSlotParams(slotId, params)` — cheap live param push; calls `node.apply(params)` without rebuilding the graph. Pitch params are also posted to the WSOLA player port.
  - `play(trim, chain)`, `pause()`, `seek()`, `setTrim()`, `render(buffer, trim, chain)`.

- **`graph.ts`** — `loadWorklets(ctx)` registers all worklet modules; `renderOffline(buffer, trim, chain)` creates an `OfflineAudioContext`, builds the same chain via the registry (with 4 s tail padding when echo/reverb is active), and returns the rendered `AudioBuffer`.

- **`effects/`** — the effect registry. Every effect is a self-contained folder:
  - `types.ts` — `Slot`, `Chain`, `EffectKind`, `EffectDefinition<K>`, `EffectNode<P>`.
  - `_internal.ts` — backing `Map` + `register()` function. **Definitions import `register` from `_internal`, not from `registry`** (avoids an ESM circular-import where `registry.ts` side-effect-imports the definitions).
  - `registry.ts` — public `registry: ReadonlyMap` + re-exports `register`; side-effect-imports each definition module.
  - `neutral.ts` — `isNeutral(slot)` dispatch helper.
  - `<kind>/definition.ts` — `EffectDefinition` for that kind: `build(ctx, params) → EffectNode`, `isNeutral(p)`, `defaultParams`, `Panel`.
  - `<kind>/panel.tsx` — React controls. **Each slider row must be wrapped in its own `<div className="relative">` because the invisible `<input type="range" className="absolute inset-0 opacity-0">` is scoped to the nearest `relative` ancestor.** Multiple bare `absolute inset-0` inputs in the same container will stack and only the last one receives clicks.
  - `pitch-control.ts` — WSOLA is the player (upstream of the chain), so the pitch slot's `build()` returns a passthrough `GainNode`; `apply()` is a no-op at the node level (engine routes pitch params to the player port directly). Pitch always applies before all chain effects — this is a known v2 limitation.

- **`worklets/`** — `AudioWorkletProcessor` implementations. Loaded via `?worker&url` so Vite bundles them separately. `processor-shim.ts` makes them runnable in Node for unit tests. Echo and reverb constructors guard the first argument with `typeof _sr === 'number'` because the AudioWorklet runtime passes `AudioWorkletNodeOptions` (not a number) there.

### `src/store/`

- **`session.ts`** — Zustand store (wrapped in `persist` middleware, key `imakeheat-chain`, persists only `chain`). Holds `source`, `chain: Chain`, `trim`, `playback`, `render`, `engineReady`, `route`, `srManuallyAdjusted`. Key chain mutators: `addSlot`, `removeSlot`, `reorderSlot`, `toggleEnabled`, `setSlotParams`, `setChain` (regenerates slot ids on restore), `resetChain`. `setSlotParams` contains the cross-slot 12-bit nudge: selecting `bitDepth=12` on the crusher slot auto-nudges the srhold slot to 24 kHz on first use.

- **`exports.ts`** — IndexedDB archive (`putExport`, `listExports`). Each record optionally carries `chainConfig: Chain` (deep-cloned snapshot at render time via `structuredClone`). `Restore` in the Exports screen calls `setChain(exp.chainConfig)` which regenerates slot ids before applying.

### `src/screens/` + `src/components/`

Screens dispatch into engine and store; components are pure visual. Don't reach into the engine from components.

- **`EffectsRack.tsx`** — pedalboard: `DndContext` + `SortableContext` (dnd-kit) wrapping `SlotCard` per slot, `AddEffectMenu` at the bottom. `onDragEnd` calls `reorderSlot` then `engine.rebuildChain`. All slots mount with `defaultExpanded=true` (echo/reverb only appear when the user adds them, so they should always open on first render).
- **`SlotCard.tsx`** — drag handle, `on`/`off` pill toggle (disabled cards dim to opacity-40), expand/collapse, ×remove. Panel body has `className="relative px-3 pb-3"` — required for slider inputs.

## Testing layers

- **unit (`tests/unit/`, vitest + jsdom)** — store mutators, worklet DSP (via `processor-shim`), WAV codec, component rendering. Chain-store, persist, registry, echo, reverb, slot-card, add-effect-menu tests live here.
- **integration (`tests/integration/`, playwright)** — real `OfflineAudioContext` via `runner.ts` / `window.__run`. Key specs: `v1-parity` (bit-equals a frozen fixture from tag `v1`), `chain-order` (proves order matters — RMS diff > 0.01), `tail-padding` (4 s added when echo/reverb active).
- **e2e (`tests/e2e/`, playwright)** — full app. Chromium with `--use-fake-ui-for-media-stream`. Key specs: `pedalboard` (drag/keyboard/toggle/reset), `restore-from-export`.

Vitest only matches `tests/unit/**/*.test.ts(x)`. Playwright matches `*.spec.ts` in `integration/` and `e2e/`. The `v1-parity` fixture lives at `tests/fixtures/v1-neutral-render.bin` — regenerate with `UPDATE_FIXTURES=1 npm run test:integration -- tests/integration/v1-parity.spec.ts` checked out at tag `v1`.

## Conventions

- TypeScript strict; React function components only.
- Files in `src/` start with two `// ABOUTME:` lines.
- Tailwind via `tailwind.config.ts`; no CSS modules.
- Adding a new effect kind: create `src/audio/effects/<kind>/{definition.ts, panel.tsx, worklet.ts if needed}`, import `register` from `../_internal`, add `void <kind>Url` if using `?worker&url`, add the worklet to `loadWorklets` in `graph.ts`, register the definition module in `registry.ts`.
- The audio clock is authoritative for playback position; the store mirrors it for UI.
- Live preview uses the live `AudioContext`; export uses `OfflineAudioContext`. Both paths use `EffectDefinition.build()` from the same registry — keep them in sync.
