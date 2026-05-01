// ABOUTME: Shared native EQ helpers for multi-band effect definitions that reuse the same node topology.
// ABOUTME: Builds a lowshelf -> peaking -> highshelf chain and supports both immediate init and smoothed live updates.

export interface ThreeBandEqNodes {
  input: BiquadFilterNode
  low: BiquadFilterNode
  mid: BiquadFilterNode
  high: BiquadFilterNode
  output: BiquadFilterNode
}

export function createThreeBandEq(
  ctx: BaseAudioContext,
  freqs: { low: number; mid: number; high: number },
): ThreeBandEqNodes {
  const low = ctx.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = freqs.low

  const mid = ctx.createBiquadFilter()
  mid.type = 'peaking'
  mid.frequency.value = freqs.mid
  mid.Q.value = 0.707

  const high = ctx.createBiquadFilter()
  high.type = 'highshelf'
  high.frequency.value = freqs.high

  low.connect(mid)
  mid.connect(high)

  return { input: low, low, mid, high, output: high }
}

export function assignThreeBandEqGains(
  nodes: ThreeBandEqNodes,
  gains: { low: number; mid: number; high: number },
) {
  nodes.low.gain.value = gains.low
  nodes.mid.gain.value = gains.mid
  nodes.high.gain.value = gains.high
}

export function smoothThreeBandEqGains(
  nodes: ThreeBandEqNodes,
  gains: { low: number; mid: number; high: number },
  currentTime: number,
) {
  nodes.low.gain.setTargetAtTime(gains.low, currentTime, 0.01)
  nodes.mid.gain.setTargetAtTime(gains.mid, currentTime, 0.01)
  nodes.high.gain.setTargetAtTime(gains.high, currentTime, 0.01)
}
