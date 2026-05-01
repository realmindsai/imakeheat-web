# Phase 2 Effects Design

## Scope
Implement five new effects using the existing Phase 1 architecture and conventions:
- `tapeEcho`
- `timeCtrlDly`
- `overdrive`
- `distortion`
- `wrmSaturator`

Each effect must follow the same registry/panel/test pattern already used in `src/audio/effects/*` and `tests/unit/effects/*`.

## Goals
- Add the five effects as independent slot kinds, not as modes inside existing effects.
- Preserve current engine/graph/store contracts and avoid cross-effect coupling.
- Maintain strict parity with existing panel and test conventions.
- Ship with full test coverage across unit, integration, and e2e layers.

## Non-Goals
- Reworking existing effect behavior.
- Introducing a new routing model or changing chain semantics.
- Refactoring unrelated effect modules.

## Architecture
### Type Surface
Update `src/audio/effects/types.ts`:
- Extend `EffectKind` with the five new kinds.
- Extend `Slot` union with explicit params per new kind.

Proposed params:
- `tapeEcho`: `{ timeMs: number; feedback: number; mix: number; wowFlutter: number; tone: number }`
- `timeCtrlDly`: `{ timeMs: number; feedback: number; mix: number; ducking: number }`
- `overdrive`: `{ drive: number; tone: number; level: number; mix: number }`
- `distortion`: `{ drive: number; tone: number; level: number; mix: number }`
- `wrmSaturator`: `{ amount: number; bias: number; tone: number; mix: number; level: number }`

### Effect Modules
Create per-kind modules:
- `src/audio/effects/tapeEcho/definition.ts`
- `src/audio/effects/tapeEcho/panel.tsx`
- `src/audio/effects/timeCtrlDly/definition.ts`
- `src/audio/effects/timeCtrlDly/panel.tsx`
- `src/audio/effects/overdrive/definition.ts`
- `src/audio/effects/overdrive/panel.tsx`
- `src/audio/effects/distortion/definition.ts`
- `src/audio/effects/distortion/panel.tsx`
- `src/audio/effects/wrmSaturator/definition.ts`
- `src/audio/effects/wrmSaturator/panel.tsx`

All definitions import `register` from `../_internal`, matching existing anti-cycle pattern.

### Registry
Update `src/audio/effects/registry.ts` to side-effect import each new definition in the canonical Add-menu order.

### DSP Strategy
- `timeCtrlDly` and `tapeEcho`: AudioWorklet-based delay implementations for deterministic feedback/time-domain behavior in both live and offline contexts.
- `overdrive`, `distortion`, `wrmSaturator`: node-chain implementations using existing shared shaping/mix helpers where applicable.

Reuse shared utilities first:
- `src/audio/effects/_shared/waveshaper.ts`
- `src/audio/effects/_shared/dryWet.ts`

Add new shared helpers only when duplication is real and measurable across at least two new effects.

### Neutral/Bias Rules
- Delay effects neutral when `mix < 0.05`.
- Drive/saturation effects neutral when wet contribution is effectively bypassed (`mix < 0.05`) and shaping amount is at floor.

## Panel Design
Each panel follows existing Phase 1 UI constraints:
- one slider row per `div.relative`
- invisible `input[type=range]` overlay per row
- `Slider` and `Range` visuals
- debounced param writes with `useDebouncedCallback(onChange, 300)`

No new panel architecture is introduced.

## Data Flow
No store or router model changes:
- Slots are created through existing add-flow from registry definitions.
- `setSlotParams` continues to be the only mutation path for panel param edits.
- Engine consumes updated slots through existing `updateSlotParams` / `rebuildChain` paths.

## Error Handling
- Clamp unsafe DSP values at effect boundaries (`timeMs`, `feedback`, `mix`, drive/amount ranges).
- Reject invalid worklet message payloads by fallback-clamping to safe defaults.
- Maintain stereo independence in all delay processors.

## Testing Strategy (TDD)
Every effect is developed with failing tests first.

### Unit Tests
Add five files:
- `tests/unit/effects/tapeEcho.test.ts`
- `tests/unit/effects/timeCtrlDly.test.ts`
- `tests/unit/effects/overdrive.test.ts`
- `tests/unit/effects/distortion.test.ts`
- `tests/unit/effects/wrmSaturator.test.ts`

Delay test cases:
- impulse appears at expected delay offset
- feedback produces geometric decay behavior
- `mix=0` bypass identity
- out-of-range params are clamped safely
- stereo independence

Drive/saturation test cases:
- transfer response is stable and bounded
- mix bypass identity
- parameter clamps prevent runaway levels
- left/right channels remain independent

### Registry and UI Tests
- Extend `tests/unit/effects/registry.test.ts` to assert registration for all five kinds.
- Add panel interaction tests where needed to verify slider patches and debounce behavior.

### Integration Tests
- Add one offline render sanity spec for new delay variants in `tests/integration/`.
- Verify rendered output is non-silent and deterministic under fixed params.

### E2E Tests
- Extend pedalboard e2e flow to add/toggle/remove at least one new Phase 2 effect.
- Keep assertions behavior-focused and deterministic.

## Rollout Order
1. `timeCtrlDly`
2. `tapeEcho`
3. `overdrive`
4. `distortion`
5. `wrmSaturator`
6. Registry ordering cleanup and test consolidation

## Risks and Mitigations
- Risk: duplicated shaping logic across three saturation effects.
  - Mitigation: centralize only repeated primitives into `_shared` helpers.
- Risk: delay worklets diverge between live/offline edge behavior.
  - Mitigation: keep parameter clamps and buffer math identical to existing echo/reverb conventions.
- Risk: regression in Add-menu ordering.
  - Mitigation: explicit registry test assertions on kind presence and order-sensitive snapshots if already used.

## Acceptance Criteria
- All five effects appear in Add menu with correct labels.
- Each effect has working panel controls and stable live preview behavior.
- Offline render includes each effect’s audible contribution.
- Unit, integration, and e2e test suites pass with no warnings/noise.
- Existing effects remain behaviorally unchanged.
