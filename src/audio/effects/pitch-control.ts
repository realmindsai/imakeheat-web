// ABOUTME: Passthrough EffectNode for pitch — WSOLA is upstream (the `player` node);
// ABOUTME: the pitch slot's chain position is decorative. apply() is a no-op here;
// ABOUTME: engine.updateSlotParams for the pitch slot routes to WSOLA via player.port.

import type { EffectNode } from './types'

export function buildPitchPassthrough(
  ctx: BaseAudioContext,
): EffectNode<{ semitones: number; speed: number }> {
  const gain = (ctx as AudioContext | OfflineAudioContext).createGain()
  gain.gain.value = 1
  return {
    input: gain,
    output: gain,
    apply() { /* engine handles via player.port.postMessage */ },
    dispose() { gain.disconnect() },
  }
}
