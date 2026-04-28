import './processor-shim'

// Zero-order hold: every `holdFactor` input samples, take the first sample
// and repeat it for the rest. Output length equals input length.
// State (sampleCounter, heldSample) persists across process() blocks.
export class SRHoldProcessor extends AudioWorkletProcessor {
  private holdFactor = 1
  private sampleCounter = 0
  private heldSample: number[] = [] // per channel

  constructor() {
    super()
    ;(this as any).port.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { holdFactor?: number }
      if (typeof data.holdFactor === 'number') {
        const next = Math.max(1, Math.round(data.holdFactor))
        if (next !== this.holdFactor) {
          this.holdFactor = next
          this.sampleCounter = 0
          this.heldSample = []
        }
      }
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    if (this.holdFactor === 1) {
      for (let c = 0; c < input.length; c++) {
        if (output[c]) output[c].set(input[c])
      }
      return true
    }

    while (this.heldSample.length < input.length) this.heldSample.push(0)

    const N = input[0].length
    for (let i = 0; i < N; i++) {
      if (this.sampleCounter === 0) {
        for (let c = 0; c < input.length; c++) {
          this.heldSample[c] = input[c][i]
        }
      }
      for (let c = 0; c < input.length; c++) {
        if (output[c]) output[c][i] = this.heldSample[c]
      }
      this.sampleCounter = (this.sampleCounter + 1) % this.holdFactor
    }
    return true
  }
}

registerProcessor('srhold', SRHoldProcessor)
