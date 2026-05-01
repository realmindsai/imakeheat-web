// ABOUTME: Shared dry/wet crossfade helper for composite effects that run parallel branches.
// ABOUTME: Uses smoothed gain updates to avoid zipper noise while morphing between dry and wet paths.

export function setDryWet(
  dry: GainNode,
  wet: GainNode,
  balance: number,
  currentTime: number,
) {
  const wetGain = Math.max(0, Math.min(1, balance / 100))
  const dryGain = 1 - wetGain
  dry.gain.setTargetAtTime(dryGain, currentTime, 0.01)
  wet.gain.setTargetAtTime(wetGain, currentTime, 0.01)
}
